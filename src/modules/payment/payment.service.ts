import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StripeService } from './providers/stripe.service';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'src/modules/payment/schemas/subscription.schema';
import { SessionToken } from 'src/modules/payment/schemas/sessionToken.schema';
import { User } from 'src/modules/auth/schemas/user.schema';
import { randomBytes } from 'crypto';
import { EmailService } from 'src/modules/payment/providers/email.service';

@Injectable()
export class PaymentService {
  @InjectModel(SessionToken.name)
  private sessionTokenModel: Model<SessionToken>;

  @InjectModel(User.name)
  private userModel: Model<User>;

  @InjectModel(Subscription.name)
  private subscriptionModel: Model<Subscription>;

  private generateUniqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
    private stripeService: StripeService,
  ) {}

  async createCheckoutSession(
    email: string | null,
    planType: 'basic' | 'premium',
  ) {
    const sessionToken = this.generateUniqueToken();

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price:
            planType === 'basic'
              ? 'price_1Qxz8wImbnhk3Vambc8poQCN'
              : 'price_1QxzBGImbnhk3Vam2RPC15fG',
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success/${sessionToken}`,
      cancel_url: `${process.env.FRONTEND_URL}/`,
      metadata: {
        email: email || '',
        planType,
        sessionToken,
      },
      ...(email && { customer_email: email }),
    };

    const session = await this.stripeService.createCheckoutSession(
      sessionParams as any,
    );

    await this.sessionTokenModel.create({
      token: sessionToken,
      email: email || '',
      planType,
      status: 'pending',
    });

    return {
      checkoutUrl: session.url,
      sessionToken,
    };
  }

  async handleWebhook(rawBody: string, signature: string) {
    try {
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );
      if (!webhookSecret) {
        throw new Error('Chave secreta do webhook não configurada');
      }

      const event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );

      const session = await this.stripeService.handleStripeWebhookEvent(event);

      if (session) {
        await this.processCompletedSession(session);
      }

      return { received: true };
    } catch (error) {
      console.error('Erro no processamento do webhook:', error.message);
      throw error;
    }
  }

  private async processCompletedSession(session: any) {
    if (!this.validateSessionMetadata(session.metadata)) {
      throw new Error('Metadados da sessão incompletos');
    }

    const sessionToken = await this.validateSessionToken(
      session.metadata.sessionToken,
    );

    await this.createSubscription(
      session.metadata.email,
      session.metadata.planType,
      session.subscription,
    );

    await this.updateUserPlan(
      session.metadata.email,
      session.metadata.planType,
    );

    await this.updateSessionTokenStatus(session.metadata.sessionToken);

    await this.emailService.sendThankYouEmail(
      session.metadata.email,
      session.metadata.planType,
    );
  }

  private validateSessionMetadata(metadata: any): boolean {
    return (
      !!metadata?.email && !!metadata?.planType && !!metadata?.sessionToken
    );
  }

  private async validateSessionToken(token: string) {
    const sessionToken = await this.sessionTokenModel.findOne({
      token,
      status: 'pending',
    });

    if (!sessionToken) {
      throw new Error('Token de sessão inválido ou já processado');
    }
    return sessionToken;
  }

  private async updateUserPlan(email: string, planType: string) {
    await this.userModel.updateOne({ email }, { plan: planType });
  }

  private async updateSessionTokenStatus(token: string) {
    await this.sessionTokenModel.updateOne(
      { token },
      { status: 'completed', processedAt: new Date() },
    );
  }

  async createSubscription(
    email: string,
    planType: string,
    stripeSubscriptionId: string,
  ) {
    const stripeSubscription =
      await this.stripeService.retrieveSubscription(stripeSubscriptionId);

    const subscription = new this.subscriptionModel({
      email,
      plan: planType,
      stripeSubscriptionId,
      endsAt: new Date(stripeSubscription.current_period_end * 1000),
    });

    return await subscription.save();
  }

  async verifySessionToken(token: string) {
    const sessionToken = await this.sessionTokenModel.findOne({
      token,
      status: 'completed',
    });

    return sessionToken
      ? {
          valid: true,
          email: sessionToken.email,
          planType: sessionToken.planType,
        }
      : {
          valid: false,
          message: 'Token inválido ou incompleto',
        };
  }

  async verifySubscription(email: string) {
    const subscription = await this.subscriptionModel.findOne(
      { email },
      {},
      { sort: { createdAt: -1 } },
    );

    return subscription && new Date() < subscription.endsAt
      ? { plan: subscription.plan as 'basic' | 'premium' | 'admin' }
      : false;
  }
}
