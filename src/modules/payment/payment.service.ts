import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StripeService } from './providers/stripe.service';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'src/modules/payment/schemas/subscription.schema';
import { SessionToken } from 'src/modules/payment/schemas/sessionToken.schema';
import { User } from 'src/modules/auth/schemas/user.schema';
import { randomBytes } from 'crypto';
import { EmailService } from 'src/modules/payment/providers/email.service';

@Injectable()
export class PaymentService {
  @InjectModel(SessionToken.name)
  private sessionTokenModel: Model<SessionToken>;

  @InjectModel(User.name)
  private userModel: Model<User>;

  @InjectModel(Subscription.name)
  private subscriptionModel: Model<Subscription>;

  private generateUniqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
    private stripeService: StripeService,
  ) {}

  async createCheckoutSession(
    email: string | null,
    planType: 'basic' | 'premium',
  ) {
    const sessionToken = this.generateUniqueToken();

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price:
            planType === 'basic'
              ? 'price_1Qxz8wImbnhk3Vambc8poQCN'
              : 'price_1QxzBGImbnhk3Vam2RPC15fG',
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success/${sessionToken}`,
      cancel_url: `${process.env.FRONTEND_URL}/`,
      metadata: {
        email: email || '',
        planType,
        sessionToken,
      },
      ...(email && { customer_email: email }),
    };

    const session = await this.stripeService.createCheckoutSession(
      sessionParams as any,
    );

    await this.sessionTokenModel.create({
      token: sessionToken,
      email: email || '',
      planType,
      status: 'pending',
    });

    return {
      checkoutUrl: session.url,
      sessionToken,
    };
  }

  async handleWebhook(rawBody: string, signature: string) {
    console.log('[DEBUG] Iniciando handleWebhook');
    console.log('[DEBUG] Parâmetros recebidos:', {
      rawBodyLength: rawBody?.length || 0,
      signature: signature ? 'Presente' : 'Ausente',
    });

    try {
      console.log('[DEBUG] Obtendo chave secreta do webhook');
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );

      if (!webhookSecret) {
        console.error('[ERRO] Chave secreta do webhook não configurada');
        throw new Error('Chave secreta do webhook não configurada');
      }
      console.log('[DEBUG] Chave secreta do webhook obtida com sucesso');

      console.log('[DEBUG] Construindo evento do webhook');
      const event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );
      console.log('[DEBUG] Evento construído com sucesso:', {
        eventId: event.id,
        eventType: event.type,
        apiVersion: event.api_version,
      });

      console.log('[DEBUG] Processando evento do webhook');
      const session = await this.stripeService.handleStripeWebhookEvent(event);
      console.log('[DEBUG] Resultado do processamento:', {
        sessionExists: !!session,
        sessionId: session?.id || 'N/A',
      });

      if (session) {
        console.log('[DEBUG] Iniciando processamento da sessão completada');
        await this.processCompletedSession(session);
        console.log('[DEBUG] Processamento da sessão completado com sucesso');
      } else {
        console.log('[DEBUG] Nenhuma sessão para processar');
      }

      console.log('[DEBUG] Webhook processado com sucesso');
      return { received: true };
    } catch (error) {
      console.error('[ERRO] Erro no processamento do webhook:', error.message);
      console.error('[ERRO] Stack trace:', error.stack);
      console.error('[ERRO] Detalhes adicionais:', {
        name: error.name,
        code: error.code,
        type: error.type,
        statusCode: error.statusCode,
        params: error.params,
      });

      throw error;
    }
  }
  private async processCompletedSession(session: any) {
    console.log('[DEBUG] Iniciando processCompletedSession');
    console.log('[DEBUG] Dados da sessão recebidos:', {
      sessionId: session?.id || 'N/A',
      customerId: session?.customer || 'N/A',
      subscriptionId: session?.subscription || 'N/A',
      hasMetadata: !!session?.metadata,
    });

    try {
      console.log('[DEBUG] Validando metadados da sessão');
      if (!this.validateSessionMetadata(session.metadata)) {
        console.error(
          '[ERRO] Metadados da sessão incompletos:',
          session.metadata,
        );
        throw new Error('Metadados da sessão incompletos');
      }
      console.log('[DEBUG] Metadados da sessão válidos:', {
        email: session.metadata.email,
        planType: session.metadata.planType,
        sessionToken: session.metadata.sessionToken ? 'Presente' : 'Ausente',
      });

      console.log('[DEBUG] Validando token da sessão');
      const sessionToken = await this.validateSessionToken(
        session.metadata.sessionToken,
      );
      console.log('[DEBUG] Token da sessão validado com sucesso:', {
        tokenId: sessionToken?.id || 'N/A',
        valid: !!sessionToken,
      });

      console.log('[DEBUG] Criando assinatura');
      await this.createSubscription(
        session.metadata.email,
        session.metadata.planType,
        session.subscription,
      );
      console.log('[DEBUG] Assinatura criada com sucesso para:', {
        email: session.metadata.email,
        planType: session.metadata.planType,
        subscriptionId: session.subscription,
      });

      console.log('[DEBUG] Atualizando plano do usuário');
      await this.updateUserPlan(
        session.metadata.email,
        session.metadata.planType,
      );
      console.log('[DEBUG] Plano do usuário atualizado com sucesso');

      console.log('[DEBUG] Atualizando status do token da sessão');
      await this.updateSessionTokenStatus(session.metadata.sessionToken);
      console.log('[DEBUG] Status do token da sessão atualizado com sucesso');

      console.log('[DEBUG] Enviando email de agradecimento');
      await this.emailService.sendThankYouEmail(
        session.metadata.email,
        session.metadata.planType,
      );
      console.log('[DEBUG] Email de agradecimento enviado com sucesso');

      console.log('[DEBUG] Processamento da sessão concluído com sucesso');
    } catch (error) {
      console.error(
        '[ERRO] Falha no processamento da sessão completada:',
        error.message,
      );
      console.error('[ERRO] Stack trace:', error.stack);
      console.error('[ERRO] Detalhes da sessão com erro:', {
        sessionId: session?.id || 'N/A',
        metadata: session?.metadata || 'N/A',
        email: session?.metadata?.email || 'N/A',
        planType: session?.metadata?.planType || 'N/A',
        step: 'Verificar logs anteriores para identificar a etapa específica',
      });

      // Re-lançar o erro para que seja tratado pelo chamador
      throw error;
    }
  }

  private validateSessionMetadata(metadata: any): boolean {
    return (
      !!metadata?.email && !!metadata?.planType && !!metadata?.sessionToken
    );
  }

  private async validateSessionToken(token: string) {
    const sessionToken = await this.sessionTokenModel.findOne({
      token,
      status: 'pending',
    });

    if (!sessionToken) {
      throw new Error('Token de sessão inválido ou já processado');
    }
    return sessionToken;
  }

  private async updateUserPlan(email: string, planType: string) {
    await this.userModel.updateOne({ email }, { plan: planType });
  }

  private async updateSessionTokenStatus(token: string) {
    await this.sessionTokenModel.updateOne(
      { token },
      { status: 'completed', processedAt: new Date() },
    );
  }

  async createSubscription(
    email: string,
    planType: string,
    stripeSubscriptionId: string,
  ) {
    const stripeSubscription =
      await this.stripeService.retrieveSubscription(stripeSubscriptionId);

    const subscription = new this.subscriptionModel({
      email,
      plan: planType,
      stripeSubscriptionId,
      endsAt: new Date(stripeSubscription.current_period_end * 1000),
    });

    return await subscription.save();
  }

  async verifySessionToken(token: string) {
    const sessionToken = await this.sessionTokenModel.findOne({
      token,
      status: 'completed',
    });

    return sessionToken
      ? {
          valid: true,
          email: sessionToken.email,
          planType: sessionToken.planType,
        }
      : {
          valid: false,
          message: 'Token inválido ou incompleto',
        };
  }

  async verifySubscription(email: string) {
    const subscription = await this.subscriptionModel.findOne(
      { email },
      {},
      { sort: { createdAt: -1 } },
    );

    return subscription && new Date() < subscription.endsAt
      ? { plan: subscription.plan as 'basic' | 'premium' | 'admin' }
      : false;
  }
}
