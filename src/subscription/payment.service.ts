import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription } from './schemas/subscription.schema';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private readonly logger = new Logger(PaymentService.name);

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
    try {
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
    } catch (error) {
      this.logger.error(
        `Error creating checkout session: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async handleWebhook(rawBody: string, signature: string) {
    try {
      this.logger.log('Iniciando processamento do webhook');
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );

      if (!webhookSecret) {
        throw new Error('Webhook secret não está configurado');
      }

      this.logger.log('Construindo evento do Stripe...');
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );

      this.logger.log(`Evento Stripe construído: ${event.type}`);

      if (event.type === 'checkout.session.completed') {
        this.logger.log('Checkout session completed:', event.data.object);
        const session = event.data.object as Stripe.Checkout.Session;

        if (
          !session.metadata?.email ||
          !session.metadata?.planType ||
          !session.subscription
        ) {
          throw new Error('Dados necessários não encontrados na sessão');
        }

        this.logger.log('Metadata:', session.metadata);
        this.logger.log('Customer:', session.customer);
        this.logger.log('Subscription:', session.subscription);

        await this.createSubscription(
          session.metadata.email,
          session.metadata.planType,
          session.subscription as string,
        );
      }

      return { received: true };
    } catch (error) {
      this.logger.error(
        `Erro detalhado no webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createSubscription(
    email: string,
    planType: string,
    stripeSubscriptionId: string,
  ) {
    this.logger.log('Creating subscription:', {
      email,
      planType,
      stripeSubscriptionId,
    });

    try {
      const stripeSubscription =
        await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
      this.logger.log('Retrieved Stripe subscription:', stripeSubscription);

      const subscription = new this.subscriptionModel({
        email,
        plan: planType,
        stripeSubscriptionId,
        endsAt: new Date(stripeSubscription.current_period_end * 1000),
      });

      const savedSubscription = await subscription.save();
      this.logger.log('Saved subscription:', savedSubscription);
      return savedSubscription;
    } catch (error) {
      this.logger.error(
        `Error in createSubscription: ${error.message}`,
        error.stack,
      );
      // Instead of throwing, we'll return an error object
      return { error: error.message };
    }
  }
}
