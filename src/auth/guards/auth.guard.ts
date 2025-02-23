import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Inject,
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

    const providedSecret = request.headers['x-secret-key'];
    const expectedSecret = this.configService.get<string>('SECRET_KEY');
    if (!providedSecret) {
      throw new UnauthorizedException('Secret key is missing in headers');
    }
    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Provided secret key is invalid');
    }

    try {
      const accessToken = this.extractToken(request, 'Authorization');
      if (!accessToken) {
        throw new UnauthorizedException(
          'Access token is missing in Authorization header',
        );
      }

      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      request.user = payload;
      return true;
    } catch (error) {
      try {
        const refreshToken = this.extractToken(request, 'Refresh-Token');
        if (!refreshToken) {
          throw new UnauthorizedException(
            'Both access token and refresh token are missing or invalid',
          );
        }

        const payload = await this.jwtService
          .verifyAsync(refreshToken, {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          })
          .catch(() => {
            throw new UnauthorizedException(
              'Refresh token is expired or invalid',
            );
          });

        // Fixed: Call refreshTokens with only the refresh token
        const tokens = await this.authService.refreshTokens(refreshToken);

        response.setHeader('New-Access-Token', tokens.accessToken);
        response.setHeader('New-Refresh-Token', tokens.refreshToken);

        request.user = payload;
        return true;
      } catch (refreshError) {
        if (refreshError instanceof UnauthorizedException) {
          throw refreshError;
        }
        throw new UnauthorizedException(
          'Failed to refresh tokens: ' + refreshError.message,
        );
      }
    }
  }

  private extractToken(request: any, headerName: string): string | null {
    const token = request.headers[headerName.toLowerCase()];
    if (!token) {
      return null;
    }

    const parts = token.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException(
        `Invalid ${headerName} format. Use: 'Bearer <token>'`,
      );
    }

    return parts[1];
  }
}
