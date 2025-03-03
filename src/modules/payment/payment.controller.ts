import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiHeader,
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
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
import { Public } from 'src/common/decorators/public.decorator';

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

class VerifyTokenDto {
  @ApiProperty({
    description: 'Session token to verify',
  })
  token: string;
}

class VerifyTokenResponseDto {
  @ApiProperty({
    description: 'Whether the token is valid',
  })
  valid: boolean;

  @ApiProperty({
    description: 'Message indicating token status',
    required: false,
  })
  message?: string;

  @ApiProperty({
    description: 'Email associated with the token',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: 'Plan type associated with the token',
    enum: ['basic', 'premium'],
    required: false,
  })
  planType?: 'basic' | 'premium';
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
    const email = req.user?.email || null;

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
  @Post('verify-token')
  @ApiOperation({ summary: 'Verify session token validity' })
  @ApiBody({ type: VerifyTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token verification result',
    type: VerifyTokenResponseDto,
  })
  async verifyToken(@Body('token') token: string) {
    return await this.paymentService.verifySessionToken(token);
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

    // console.log(result);

    return { received: true };
  }
}
