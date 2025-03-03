import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeCheckoutSessionParams } from '../providers/stripe-interfaces';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get('STRIPE_SECRET_KEY') || '',
      {
        apiVersion: '2025-01-27.acacia',
      },
    );
  }

  async createCheckoutSession(params: StripeCheckoutSessionParams) {
    return this.stripe.checkout.sessions.create(params);
  }

  async retrieveSubscription(subscriptionId: string) {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  constructWebhookEvent(rawBody: string, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  async handleStripeWebhookEvent(event: Stripe.Event) {
    if (event.type === 'checkout.session.completed') {
      return event.data.object as Stripe.Checkout.Session;
    }
    return null;
  }
}
