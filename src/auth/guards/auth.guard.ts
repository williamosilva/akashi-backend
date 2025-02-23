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
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

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

    // Validação da secret key
    this.validateApiKey(request.headers['x-secret-key']);

    try {
      // Extrai e valida o token de acesso
      const accessToken = this.extractToken(request, 'Authorization');
      const payload = await this.verifyAccessToken(accessToken);

      // Verifica a versão do token
      await this.validateTokenVersion(payload);

      request.user = payload;
      return true;
    } catch (error) {
      this.handleAuthError(error);
    }
  }

  private validateApiKey(providedSecret: string): void {
    const expectedSecret = this.configService.get<string>('SECRET_KEY');
    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid API secret');
    }
  }

  private async verifyAccessToken(token: string): Promise<any> {
    if (!token) {
      throw new UnauthorizedException('Access token missing');
    }

    try {
      return await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (error) {
      this.handleTokenError(error);
    }
  }

  private async validateTokenVersion(payload: any): Promise<void> {
    const user = await this.authService.getUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token revoked');
    }
  }

  private handleTokenError(error: any): never {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedException('Access token expired');
    }

    if (error instanceof JsonWebTokenError) {
      throw new UnauthorizedException('Invalid access token');
    }

    throw new UnauthorizedException('Authentication failed');
  }

  private extractToken(request: any, headerName: string): string {
    const header = request.headers[headerName.toLowerCase()];

    if (!header) {
      throw new UnauthorizedException(`Missing ${headerName} header`);
    }

    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        `Invalid ${headerName} format. Use: 'Bearer <token>'`,
      );
    }

    return token;
  }

  private handleAuthError(error: any): never {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    throw new UnauthorizedException(error.message || 'Authentication failed');
  }
}
