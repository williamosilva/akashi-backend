import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const errorMessage = exception.message;

    // Mapeamento de mensagens para códigos específicos
    const tokenErrors = [
      'access token',
      'refresh token',
      'Authorization format',
      'Refresh-Token format',
      'Token expired',
    ];

    const isTokenError = tokenErrors.some((keyword) =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase()),
    );

    if (isTokenError) {
      return response.status(498).json({
        statusCode: 498,
        message: errorMessage,
      });
    }

    response.status(401).json({
      statusCode: 401,
      message: errorMessage,
    });
  }
}
