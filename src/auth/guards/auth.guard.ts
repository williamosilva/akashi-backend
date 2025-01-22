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

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    try {
      const accessToken = this.extractToken(request, 'Authorization');
      if (accessToken) {
        const payload = await this.jwtService.verifyAsync(accessToken, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        request.user = payload;
        return true;
      }
    } catch (error) {
      try {
        const refreshToken = this.extractToken(request, 'Refresh-Token');
        if (!refreshToken) {
          throw new UnauthorizedException('No valid tokens provided');
        }

        const payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        });

        const tokens = await this.authService.refreshTokens(
          payload.sub,
          payload.email,
        );

        response.setHeader('New-Access-Token', tokens.accessToken);
        response.setHeader('New-Refresh-Token', tokens.refreshToken);

        request.user = payload;
        return true;
      } catch (refreshError) {
        throw new UnauthorizedException('Invalid tokens');
      }
    }

    return false;
  }

  private extractToken(request: any, headerName: string): string | null {
    const token = request.headers[headerName.toLowerCase()];
    if (!token) return null;

    const parts = token.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

    return parts[1];
  }
}
