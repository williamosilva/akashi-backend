import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription } from './schemas/subscription.schema';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
  ) {
    this.stripe = new Stripe(
      this.configService.get('STRIPE_SECRET_KEY') || '',
      {
        apiVersion: '2025-01-27.acacia',
      },
    );
  }

  async createCheckoutSession(email: string, planType: 'basic' | 'premium') {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price:
            planType === 'basic'
              ? 'price_1QqJktImbnhk3Vamex5pRZla'
              : 'price_1QqJkYImbnhk3VamParAbIol',
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        email,
        planType,
      },
    });

    return { checkoutUrl: session.url };
  }

  async handleWebhook(rawBody: string, secretKey: string) {
    try {
      console.log('Iniciando processamento do webhook');
      if (!secretKey) {
        throw new Error('Secret key não está configurada');
      }
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET não está configurado');
      }

      console.log('Construindo evento do Stripe...');
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        secretKey,
        webhookSecret,
      );

      console.log('Evento Stripe construído:', event.type);

      if (event.type === 'checkout.session.completed') {
        console.log('Checkout session completed:', event.data.object);
        const session = event.data.object as Stripe.Checkout.Session;

        if (
          !session.metadata?.email ||
          !session.metadata?.planType ||
          !session.subscription
        ) {
          throw new Error('Dados necessários não encontrados na sessão');
        }

        console.log('Metadata:', session.metadata);
        console.log('Customer:', session.customer);
        console.log('Subscription:', session.subscription);

        await this.createSubscription(
          session.metadata.email,
          session.metadata.planType,
          session.subscription as string,
        );
      }

      return { received: true };
    } catch (error) {
      console.error('Erro detalhado no webhook:', error.message);
      throw error;
    }
  }

  async createSubscription(
    email: string,
    planType: string,
    stripeSubscriptionId: string,
  ) {
    console.log('Creating subscription:', {
      email,
      planType,
      stripeSubscriptionId,
    });

    try {
      const stripeSubscription =
        await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
      console.log('Retrieved Stripe subscription:', stripeSubscription);

      const subscription = new this.subscriptionModel({
        email,
        plan: planType,
        stripeSubscriptionId,
        endsAt: new Date(stripeSubscription.current_period_end * 1000),
      });

      const savedSubscription = await subscription.save();
      console.log('Saved subscription:', savedSubscription);
      return savedSubscription;
    } catch (error) {
      console.error('Error in createSubscription:', error);
      throw error;
    }
  }
  async verifySubscription(
    email: string,
  ): Promise<false | { plan: 'basic' | 'premium' }> {
    try {
      // Busca a assinatura mais recente do usuário
      const subscription = await this.subscriptionModel.findOne(
        { email },
        {},
        { sort: { createdAt: -1 } },
      );

      // Se não existir assinatura, retorna false
      if (!subscription) {
        return false;
      }

      // Verifica se a assinatura ainda está válida
      const now = new Date();
      const endsAt = new Date(subscription.endsAt);

      // Se a data atual for maior que a data de término, a assinatura expirou
      if (now > endsAt) {
        return false;
      }

      // Retorna o plano atual do usuário
      return {
        plan: subscription.plan as 'basic' | 'premium',
      };
    } catch (error) {
      console.error('Error verifying subscription:', error);
      return false;
    }
  }
}
