import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../modules/auth/auth.service';
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

    try {
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

      try {
        const accessToken = this.extractToken(request, 'Authorization');
        if (!accessToken)
          throw new UnauthorizedException('Missing access token');
        const payload = await this.jwtService.verifyAsync(accessToken, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        request.user = payload;
        return true;
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Access token expired');
        }
        if (error.name === 'JsonWebTokenError') {
          throw new UnauthorizedException('Invalid access token');
        }
        throw new UnauthorizedException('Authentication failed');
      }
    }
  }
  private extractToken(request: any, headerName: string): string | null {
    const token = request.headers[headerName.toLowerCase()];
    if (!token) return null;
    const parts = token.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException(
        `Invalid ${headerName} header format. Use: 'Bearer <token>'`,
      );
    }
    return parts[1];
  }
}
