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
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
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

  @Public()
  @Post('webhook')
  async handleWebhook(@Req() req, @Headers('x-secret-key') secretKey: string) {
    const expectedSecretKey = this.configService.get<string>('SECRET_KEY');
    console.log('Webhook Secret:', expectedSecretKey ? 'Presente' : 'Ausente');

    try {
      if (!expectedSecretKey) {
        console.error('SECRET_KEY não encontrada nas variáveis de ambiente');
        throw new Error('Secret key não configurada');
      }

      if (!secretKey) {
        console.error('x-secret-key não encontrado no header');
        throw new UnauthorizedException('Secret key is missing in headers');
      }

      if (secretKey !== expectedSecretKey) {
        console.error('x-secret-key inválida');
        throw new UnauthorizedException('Invalid secret key');
      }

      if (!req.rawBody) {
        console.error('rawBody não está presente na requisição');
        throw new Error('Raw body não encontrado');
      }

      const result = await this.paymentService.handleWebhook(
        req.rawBody,
        req.headers['stripe-signature'] as string,
      );

      return result;
    } catch (error) {
      console.error('Erro detalhado no webhook:', error.message);
      throw error;
    }
  }
}
