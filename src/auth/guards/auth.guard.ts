import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
    private reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 🔐 Verificação da Secret Key no Header
    const providedSecret = request.headers['x-secret-key'];
    const expectedSecret = this.configService.get<string>('SECRET_KEY');
    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing secret key');
    }

    try {
      // 🛠️ Tenta validar o Access Token primeiro
      const accessToken = this.extractToken(request, 'Authorization');
      if (!accessToken) throw new Error('Missing access token');

      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      request.user = payload;
      return true;
    } catch (error) {
      if (error.name !== 'TokenExpiredError') {
        throw new UnauthorizedException('Invalid access token');
      }

      // 🔄 Tenta renovar o token usando o Refresh Token
      try {
        const refreshToken = this.extractToken(request, 'Refresh-Token');
        if (!refreshToken) {
          throw new UnauthorizedException('Missing refresh token');
        }

        // 🛠️ Valida o Refresh Token
        const refreshPayload = await this.jwtService.verifyAsync(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        });

        // 🔄 Gera um novo Access Token
        const newAccessToken =
          await this.authService.refreshTokens(refreshToken);

        // 📌 Atualiza os Headers para o Frontend pegar o novo Token
        response.setHeader('New-Access-Token', newAccessToken);

        // ✅ Atualiza o usuário na Request
        request.user = refreshPayload;
        return true;
      } catch (refreshError) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
    }
  }

  private extractToken(request: any, headerName: string): string | null {
    const token = request.headers[headerName.toLowerCase()];
    if (!token) return null;

    const parts = token.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException(
        `Invalid ${headerName} format. Use: 'Bearer <token>'`,
      );
    }

    return parts[1];
  }
}
