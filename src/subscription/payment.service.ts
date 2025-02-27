import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { Subscription } from './schemas/subscription.schema';
import { SessionToken } from './schemas/sessionToken.scema';
import { User } from '../auth/schemas/user.schema';
import { randomBytes } from 'crypto';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private resend: Resend;

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

    const resendApiKey = this.configService.get('RESEND_API_KEY') || '';
    console.log(
      `Initializing Resend with API key: ${resendApiKey ? 'Present (hidden)' : 'Missing!'}`,
    );
    this.resend = new Resend(resendApiKey);
  }

  async createCheckoutSession(
    email: string | null,
    planType: 'basic' | 'premium',
  ) {
    // Generate unique token
    const sessionToken = this.generateUniqueToken();

    // Create Stripe session object
    const sessionParams: any = {
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
      success_url: `${process.env.FRONTEND_URL}/success/${sessionToken}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel/${sessionToken}`,
      metadata: {
        email: email || '',
        planType,
        sessionToken, // Add unique token
      },
    };

    // Se o email for válido, adiciona à sessão do Stripe
    if (email) {
      sessionParams.customer_email = email;
    }

    // Create Stripe session
    const session = await this.stripe.checkout.sessions.create(sessionParams);

    // Save session token in DB
    await this.sessionTokenModel.create({
      token: sessionToken,
      email: email || '', // Salva email vazio no banco se não existir
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
        console.log('chamando verificação de email');
        await this.sendThankYouEmail(
          session.metadata.email,
          session.metadata.planType,
        );
      }

      return { received: true };
    } catch (error) {
      console.error('Detailed error in webhook:', error.message);
      throw error;
    }
  }

  async sendThankYouEmail(email: string, planType: string) {
    try {
      console.log(`Sending thank you email to ${email} for ${planType} plan`);

      // Verify email address format
      if (!email || !email.includes('@')) {
        console.error(`Invalid email format: ${email}`);
        return;
      }

      const planTitle = planType === 'basic' ? 'Basic Plan' : 'Premium Plan';
      const planFeatures =
        planType === 'basic'
          ? '<li>Basic features</li><li>Standard support</li><li>Limited access</li>'
          : '<li>All premium features</li><li>Priority support</li><li>Unlimited access</li><li>Advanced analytics</li>';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #3f51b5;">Thank You for Your Purchase!</h1>
          </div>
          
          <div style="margin-bottom: 30px;">
            <p>Dear Customer,</p>
            <p>Thank you for subscribing to our <strong>${planTitle}</strong>. We're excited to have you on board!</p>
            <p>Your subscription includes:</p>
            <ul>
              ${planFeatures}
            </ul>
            <p>Your subscription is now active and you can start enjoying all the benefits immediately.</p>
          </div>
          
          <div style="margin-bottom: 30px;">
            <p>If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
          </div>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666;">
            <p>Follow us on social media:</p>
            <div style="margin-bottom: 20px;">
              <a href="https://twitter.com/yourhandle" style="text-decoration: none; margin: 0 10px; color: #1da1f2;">Twitter</a>
              <a href="https://instagram.com/yourhandle" style="text-decoration: none; margin: 0 10px; color: #c13584;">Instagram</a>
              <a href="https://linkedin.com/in/yourprofile" style="text-decoration: none; margin: 0 10px; color: #0077b5;">LinkedIn</a>
            </div>
            <p>Need help? Contact us at <a href="mailto:support@yourdomain.com" style="color: #3f51b5;">support@yourdomain.com</a></p>
          </div>
        </div>
      `;

      console.log('Email parameters:', {
        from: 'onboarding@resend.dev',
        to: email,
        subject: `Thank You for Subscribing to Our ${planTitle}!`,
        // Don't log the full HTML content
      });

      const result = await this.resend.emails.send({
        from: 'onboarding@resend.dev', // Consider changing to a verified domain
        to: email,
        subject: `Thank You for Subscribing to Our ${planTitle}!`,
        html: htmlContent,
      });

      // Log the result from Resend
      console.log('Resend API response:', result);
      console.log('Thank you email sent successfully');

      console.log('Thank you email sent successfully');
    } catch (error) {
      console.error('Error sending thank you email:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        responseData: error.response?.data || 'No response data',
      });
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
