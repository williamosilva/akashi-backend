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
    console.log('[DEBUG] Iniciando envio de email de agradecimento');
    console.log('[DEBUG] Parâmetros recebidos:', { email, planType });

    try {
      if (!email || !email.includes('@')) {
        console.error(`[ERRO] Formato de email inválido: ${email}`);
        return;
      }
      console.log('[DEBUG] Validação de email passou');

      console.log('[DEBUG] Preparando conteúdo do email');
      const planTitle = planType === 'basic' ? 'Basic Plan' : 'Premium Plan';
      console.log('[DEBUG] Plano determinado:', planTitle);

      const planFeatures =
        planType === 'basic'
          ? '<li>Basic features</li><li>Standard support</li><li>Limited access</li>'
          : '<li>All premium features</li><li>Priority support</li><li>Unlimited API access</li><li>Api Integration</li>';
      console.log('[DEBUG] Features do plano definidas');

      console.log('[DEBUG] Gerando HTML do email');
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <!-- Conteúdo do email aqui -->
        </div>
      `;
      console.log('[DEBUG] HTML do email gerado');

      console.log('[DEBUG] Preparando dados para envio');
      const emailData = {
        from: 'your-email@domain.com',
        to: email,
        subject: `Thank you for subscribing to ${planTitle}`,
        html: htmlContent,
      };
      console.log('[DEBUG] Dados do email preparados:', {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
      });

      console.log('[DEBUG] Enviando email via resend');
      const result = await this.resend.emails.send(emailData);
      console.log('[DEBUG] Email enviado com sucesso:', result);

      return true;
    } catch (error) {
      console.error(
        '[ERRO] Erro ao enviar email de agradecimento:',
        error.message,
      );
      console.error('[ERRO] Stack trace:', error.stack);
      console.error('[ERRO] Detalhes adicionais:', {
        name: error.name,
        code: error.code || 'N/A',
        responseStatus: error.response?.status || 'N/A',
        responseData: error.response?.data || 'Sem dados de resposta',
        requestData: {
          to: email,
          planType: planType,
        },
      });

      // Se a API Resend retornar detalhes do erro, exibir esses detalhes também
      if (error.response?.data) {
        console.error(
          '[ERRO] Resposta do serviço de email:',
          JSON.stringify(error.response.data, null, 2),
        );
      }
    }
  }
}
