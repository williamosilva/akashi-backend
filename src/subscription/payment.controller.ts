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

@Controller('payments')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private configService: ConfigService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @Body('planType') planType: 'basic' | 'premium',
    @Request() req,
  ) {
    try {
      console.log('Usuário:', req.user);
      console.log('Tipo de plano:', planType);

      const session = await this.paymentService.createCheckoutSession(
        req.user.email,
        planType,
      );

      console.log('Sessão criada:', session);
      return session;
    } catch (error) {
      console.error('Erro no checkout:', error);
      throw error;
    }
  }

  @Get('verify-subscription')
  @UseGuards(JwtAuthGuard)
  async verifySubscription(@Request() req) {
    try {
      const subscription = await this.paymentService.verifySubscription(
        req.user.email,
      );

      return {
        hasActiveSubscription: subscription !== false,
        subscription: subscription || null,
      };
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      throw error;
    }
  }

  @Public()
  @Post('webhook')
  async handleWebhook(
    @Req() req,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    console.log('Webhook Secret:', webhookSecret ? 'Presente' : 'Ausente');
    try {
      console.log('Webhook recebido');
      console.log('Signature:', signature);
      console.log('Raw body:', req.rawBody);

      const result = await this.paymentService.handleWebhook(
        req.rawBody,
        signature,
      );
      console.log('Webhook processado com sucesso:', result);

      return { received: true };
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      throw error;
    }
  }
}
