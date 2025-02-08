import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import type { PaymentService } from './payment.service';
import {
  Body,
  Controller,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

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
  async handleWebhook(@Req() req) {
    const webhookSecret = this.configService.get<string>('SECRET_KEY');
    console.log('Webhook Secret:', webhookSecret ? 'Presente' : 'Ausente');

    try {
      if (!webhookSecret) {
        console.error('SECRET_KEY não encontrada nas variáveis de ambiente');
        throw new Error('Secret key não configurada');
      }

      if (!req.rawBody) {
        console.error('rawBody não está presente na requisição');
        throw new Error('Raw body não encontrado');
      }

      const result = await this.paymentService.handleWebhook(
        req.rawBody,
        webhookSecret,
      );

      return result;
    } catch (error) {
      console.error('Erro detalhado no webhook:', error.message);
      throw error;
    }
  }
}
