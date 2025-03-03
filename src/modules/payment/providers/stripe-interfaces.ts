import { Stripe } from 'stripe';

export interface StripeCheckoutSessionParams
  extends Stripe.Checkout.SessionCreateParams {
  metadata: {
    email: string;
    planType: string;
    sessionToken: string;
  };
}
