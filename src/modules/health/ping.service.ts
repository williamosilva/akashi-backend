import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class PingService {
  private readonly logger = new Logger(PingService.name);
  private baseUrl: string;

  constructor() {
    const port = process.env.PORT ?? 3000;
    this.baseUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
    this.logger.log(
      `🚀 Ping service iniciado! Configurado para URL: ${this.baseUrl}`,
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pingServer() {
    this.logger.log(`📡 Executando ping para: ${this.baseUrl}/health`);

    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.baseUrl}/health`);
      const endTime = Date.now();

      this.logger.log(
        `✅ Ping realizado com sucesso! Status: ${response.status}, Tempo: ${endTime - startTime}ms, Data: ${new Date().toISOString()}`,
      );
    } catch (error) {
      this.logger.error(`❌ ERRO ao realizar ping: ${error.message}`);
    }
  }
}
