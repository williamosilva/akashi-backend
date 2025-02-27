import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription } from './schemas/subscription.schema';
import { SessionToken } from './schemas/sessionToken.scema';
import { User } from '../auth/schemas/user.schema';
import { randomBytes } from 'crypto';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  @InjectModel(SessionToken.name)
  private sessionTokenModel: Model<SessionToken>;

  @InjectModel(User.name) // Inject the User model
  private userModel: Model<User>;

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
    // Generate unique token
    const sessionToken = this.generateUniqueToken();

    // Create Stripe session with token
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
        sessionToken, // Add unique token
      },
    });

    // Save session token
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
      console.log('Starting webhook processing');
      if (!secretKey) {
        throw new Error('Secret key is not configured');
      }
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
      }

      console.log('Constructing Stripe event...');
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        secretKey,
        webhookSecret,
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        // Additional token verification
        if (
          !session.metadata?.email ||
          !session.metadata?.planType ||
          !session.metadata?.sessionToken || // New field
          !session.subscription
        ) {
          throw new Error('Required data not found in session');
        }

        // Verify and update token status
        const sessionToken = await this.sessionTokenModel.findOne({
          token: session.metadata.sessionToken,
          status: 'pending',
        });

        if (!sessionToken) {
          throw new Error('Invalid or already processed session token');
        }

        // Create subscription
        await this.createSubscription(
          session.metadata.email,
          session.metadata.planType,
          session.subscription as string,
        );

        // Update user's plan
        await this.userModel.updateOne(
          { email: session.metadata.email },
          { plan: session.metadata.planType },
        );

        // Update token status
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
      console.error('Detailed error in webhook:', error.message);
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
          message: 'Invalid or already processed token',
        };
      }

      return {
        valid: true,
        email: sessionToken.email,
        planType: sessionToken.planType,
      };
    } catch (error) {
      console.error('Error verifying session token:', error);
      return {
        valid: false,
        message: 'Error verifying token',
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
  ): Promise<false | { plan: 'basic' | 'premium' | 'admin' }> {
    try {
      // Find the user's most recent subscription
      const subscription = await this.subscriptionModel.findOne(
        { email },
        {},
        { sort: { createdAt: -1 } },
      );

      // If no subscription exists, return false
      if (!subscription) {
        return false;
      }

      // Check if the subscription is still valid
      const now = new Date();
      const endsAt = new Date(subscription.endsAt);

      // If the current date is greater than the end date, the subscription has expired
      if (now > endsAt) {
        return false;
      }

      // Return the user's current plan
      return {
        plan: subscription.plan as 'basic' | 'premium' | 'admin',
      };
    } catch (error) {
      console.error('Error verifying subscription:', error);
      return false;
    }
  }
}
