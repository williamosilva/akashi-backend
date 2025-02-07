import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import { PaymentService } from './payment.service';
import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';

@Controller('payments')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @Body('planType') planType: 'basic' | 'premium',
    @Request() req,
  ) {
    return this.paymentService.createCheckoutSession(req.user.email, planType);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentService.handleWebhook(req.rawBody, signature);
  }
}
