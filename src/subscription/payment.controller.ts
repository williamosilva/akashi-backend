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
import { ConfigService } from '@nestjs/config';

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

  @Post('webhook')
  async handleWebhook(
    @Req() req,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    console.log('Webhook Secret:', webhookSecret ? 'Presente' : 'Ausente');
    console.log('Stripe Signature recebido:', signature);

    try {
      if (!webhookSecret) {
        console.error(
          'STRIPE_WEBHOOK_SECRET não encontrado nas variáveis de ambiente',
        );
        throw new Error('Webhook secret não configurado');
      }

      if (!signature) {
        console.error('stripe-signature não encontrado no header');
        throw new Error('Stripe signature não encontrado');
      }

      if (!req.rawBody) {
        console.error('rawBody não está presente na requisição');
        throw new Error('Raw body não encontrado');
      }

      const result = await this.paymentService.handleWebhook(
        req.rawBody,
        signature,
      );

      return result;
    } catch (error) {
      console.error('Erro detalhado no webhook:', error.message);
      throw error;
    }
  }
}
