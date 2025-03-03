import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const resendApiKey = this.configService.get('RESEND_API_KEY') || '';
    this.resend = new Resend(resendApiKey);
  }

  async sendThankYouEmail(email: string, planType: string) {
    try {
      if (!email || !email.includes('@')) {
        console.error(`Invalid email format: ${email}`);
        return;
      }

      const planTitle = planType === 'basic' ? 'Basic Plan' : 'Premium Plan';
      const planFeatures =
        planType === 'basic'
          ? '<li>Basic features</li><li>Standard support</li><li>Limited access</li>'
          : '<li>All premium features</li><li>Priority support</li><li>Unlimited API access</li><li>Api Integration</li>';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color:rgb(34, 116, 36);">Welcome to Akashi!</h1>
            <p style="color: #666;">Thank you for trusting Akashi – your journey starts now!</p>
          </div>
          
          <div style="margin-bottom: 30px;">
            <p>Dear Customer,</p>
            <p>Thank you for subscribing to our <strong>${planTitle}</strong>. We're excited to have you on board at <strong>Akashi</strong>!</p>
            <p>Your subscription includes:</p>
            <ul>
              ${planFeatures}
            </ul>
            <p>Your subscription is now active, and you can start enjoying all the benefits immediately.</p>
          </div>
          
          <div style="margin-bottom: 30px;">
            <p>If you have any questions or need assistance, the Akashi support team is always ready to help.</p>
          </div>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666;">
            <p>Follow Akashi on social media:</p>
            <div style="margin-bottom: 20px;">
              <a href="https://www.linkedin.com/in/williamsilva2005" style="text-decoration: none; margin: 0 10px; color: #0077b5;">LinkedIn</a>
              <a href="http://williamsilva.dev" style="text-decoration: none; margin: 0 10px; color: #2c3e50;">Website</a>
              <a href="https://github.com/williamosilva" style="text-decoration: none; margin: 0 10px; color: #333333;">GitHub</a>
            </div>
            <p>Need help? Contact Akashi at <a href="mailto:support@yourdomain.com" style="color: #3f51b5;">williamsilva20062005@gmail.com</a></p>
          </div>
        </div>
      `;

      await this.resend.emails.send({
        from: 'your-email@domain.com',
        to: email,
        subject: `Thank you for subscribing to ${planTitle}`,
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error sending thank you email:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        responseData: error.response?.data || 'No response data',
      });
    }
  }
}
