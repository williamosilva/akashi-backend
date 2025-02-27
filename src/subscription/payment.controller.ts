import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiHeader,
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { PaymentService } from './payment.service';
import {
  Body,
  Controller,
  Headers,
  Post,
  Get,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/auth/decorators/public.decorator';

class CheckoutDto {
  @ApiProperty({
    description: 'Subscription plan type',
    enum: ['basic', 'premium'],
  })
  planType: 'basic' | 'premium';
}

class CheckoutResponseDto {
  @ApiProperty({ description: 'Stripe checkout URL' })
  checkoutUrl: string;

  @ApiProperty({ description: 'Unique session token' })
  sessionToken: string;
}

class SubscriptionVerificationDto {
  @ApiProperty({ description: 'Whether user has an active subscription' })
  hasActiveSubscription: boolean;

  @ApiProperty({
    description: 'Subscription details',
    nullable: true,
    type: () => SubscriptionDetails,
  })
  subscription: SubscriptionDetails | null;
}

class SubscriptionDetails {
  @ApiProperty({
    description: 'Subscription plan',
    enum: ['basic', 'premium'],
  })
  plan: 'basic' | 'premium';
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private configService: ConfigService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({
    status: 200,
    description: 'Checkout session created',
    type: CheckoutResponseDto,
  })
  async createCheckout(
    @Body('planType') planType: 'basic' | 'premium',
    @Request() req,
  ) {
    const email = req.user?.email || null; // Garante que o email seja null se não existir

    const session = await this.paymentService.createCheckoutSession(
      email,
      planType,
    );

    return session;
  }

  @Get('verify-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify user subscription status' })
  @ApiResponse({
    status: 200,
    description: 'Subscription verification result',
    type: SubscriptionVerificationDto,
  })
  async verifySubscription(@Request() req) {
    const subscription = await this.paymentService.verifySubscription(
      req.user.email,
    );

    return {
      hasActiveSubscription: subscription !== false,
      subscription: subscription || null,
    };
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handleWebhook(
    @Req() req,
    @Headers('stripe-signature') signature: string,
  ) {
    const result = await this.paymentService.handleWebhook(
      req.rawBody,
      signature,
    );

    return { received: true };
  }
}
