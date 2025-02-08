import { JwtAuthGuard } from 'src/auth/guards/auth.guard';
import type { PaymentService } from './payment.service';
import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  Request,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

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
      this.logger.log('Usuário:', req.user);
      this.logger.log('Tipo de plano:', planType);

      const session = await this.paymentService.createCheckoutSession(
        req.user.email,
        planType,
      );

      this.logger.log('Sessão criada:', session);
      return session;
    } catch (error) {
      this.logger.error('Erro no checkout:', error);
      throw new HttpException(
        'Erro ao criar sessão de checkout',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
    this.logger.log('Webhook Secret:', webhookSecret ? 'Presente' : 'Ausente');
    this.logger.log('Stripe Signature recebido:', signature);

    try {
      if (!webhookSecret) {
        this.logger.error(
          'STRIPE_WEBHOOK_SECRET não encontrado nas variáveis de ambiente',
        );
        throw new Error('Webhook secret não configurado');
      }

      if (!signature) {
        this.logger.error('stripe-signature não encontrado no header');
        throw new Error('Stripe signature não encontrado');
      }

      if (!req.rawBody) {
        this.logger.error('rawBody não está presente na requisição');
        throw new Error('Raw body não encontrado');
      }

      const result = await this.paymentService.handleWebhook(
        req.rawBody,
        signature,
      );
      // @ts-ignore
      if (result.error) {
        // @ts-ignore
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      this.logger.error('Erro detalhado no webhook:', error.message);
      // Return a 200 status to acknowledge receipt of the webhook
      // This prevents Stripe from retrying the webhook
      return { received: true, error: error.message };
    }
  }
}
