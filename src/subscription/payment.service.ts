import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription } from './schemas/subscription.schema';
import { SessionToken } from './schemas/sessionToken.scema';
import { randomBytes } from 'crypto';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  @InjectModel(SessionToken.name)
  private sessionTokenModel: Model<SessionToken>;

  private generateUniqueToken(): string {
    return randomBytes(32).toString('hex');
  }

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
    // Gerar token único
    const sessionToken = this.generateUniqueToken();

    // Criar sessão no Stripe com token
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
      success_url: `${process.env.FRONTEND_URL}/success/${sessionToken}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel/${sessionToken}`,
      metadata: {
        email,
        planType,
        sessionToken, // Adicionar token único
      },
    });

    // Salvar token de sessão
    await this.sessionTokenModel.create({
      token: sessionToken,
      email,
      planType,
      status: 'pending',
    });

    return {
      checkoutUrl: session.url,
      sessionToken,
    };
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

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        // Verificação adicional de token
        if (
          !session.metadata?.email ||
          !session.metadata?.planType ||
          !session.metadata?.sessionToken || // Novo campo
          !session.subscription
        ) {
          throw new Error('Dados necessários não encontrados na sessão');
        }

        // Verificar e atualizar status do token
        const sessionToken = await this.sessionTokenModel.findOne({
          token: session.metadata.sessionToken,
          status: 'pending',
        });

        if (!sessionToken) {
          throw new Error('Token de sessão inválido ou já processado');
        }

        // Criar assinatura
        await this.createSubscription(
          session.metadata.email,
          session.metadata.planType,
          session.subscription as string,
        );

        // Atualizar status do token
        await this.sessionTokenModel.updateOne(
          { token: session.metadata.sessionToken },
          {
            status: 'completed',
            processedAt: new Date(),
          },
        );
      }

      return { received: true };
    } catch (error) {
      console.error('Erro detalhado no webhook:', error.message);
      throw error;
    }
  }

  async verifySessionToken(token: string) {
    try {
      const sessionToken = await this.sessionTokenModel.findOne({
        token,
        status: 'pending',
      });

      if (!sessionToken) {
        return {
          valid: false,
          message: 'Token inválido ou já processado',
        };
      }

      return {
        valid: true,
        email: sessionToken.email,
        planType: sessionToken.planType,
      };
    } catch (error) {
      console.error('Erro ao verificar token de sessão:', error);
      return {
        valid: false,
        message: 'Erro ao verificar token',
      };
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
