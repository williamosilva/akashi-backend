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
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  async createCheckoutSession(email: string, planType: 'basic' | 'premium') {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price:
            planType === 'basic'
              ? 'price_basic_mensalidade'
              : 'price_premium_mensalidade', // Criar esses preços no Stripe
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

  async handleWebhook(rawBody: string, signature: string) {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { email, planType } = session.metadata;

      await this.createSubscription(
        email,
        planType,
        session.subscription as string,
      );
    }
  }

  async createSubscription(
    email: string,
    planType: string,
    stripeSubscriptionId: string,
  ) {
    const stripeSubscription =
      await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    const subscription = new this.subscriptionModel({
      email,
      plan: planType,
      stripeSubscriptionId,
      endsAt: new Date(stripeSubscription.current_period_end * 1000),
    });

    return subscription.save();
  }
}
