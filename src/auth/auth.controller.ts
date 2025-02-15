import {
  Controller,
  Post,
  Body,
  Headers,
  Get,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google Authentication' })
  async googleAuth() {}
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req, @Res() res) {
    try {
      const result = await this.authService.handleSocialLogin(
        req.user,
        'google',
      );

      // No controller, dentro do googleAuthCallback
      const html = `
          <html>
            <script>
              window.opener.postMessage({
                type: 'oauth-success',
                payload: {
                  accessToken: ${JSON.stringify(result.accessToken)},
                  refreshToken: ${JSON.stringify(result.refreshToken)},
                  user: {
                    id: ${JSON.stringify(result.id)},
                    email: ${JSON.stringify(result.email)},
                    fullName: ${JSON.stringify(result.fullName)},
                    photo: ${JSON.stringify(result.photo)}
                  }
                }
              }, '${process.env.FRONTEND_URL}');
              window.close();
            </script>
          </html>
          `;

      res.send(html);
    } catch (error) {
      const html = `
        <html>
          <script>
            window.opener.postMessage({
              type: 'oauth-error',
              payload: { message: 'Google login failed' }
            }, '${process.env.FRONTEND_URL}');
            window.close();
          </script>
        </html>
      `;
      res.send(html);
    }
  }
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub Authentication' })
  async githubAuth() {
    // Inicia o fluxo de autenticação do GitHub
  }
  // No controller, modifique o githubAuthCallback
  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(@Req() req, @Res() res) {
    try {
      const result = await this.authService.handleSocialLogin(
        req.user,
        'github',
      );

      const html = `
          <html>
            <script>
              window.opener.postMessage({
                type: 'oauth-success',
                payload: ${JSON.stringify({
                  accessToken: result.accessToken,
                  refreshToken: result.refreshToken,
                  user: {
                    id: result.id,
                    email: result.email,
                    fullName: result.fullName,
                    photo: result.photo,
                  },
                })}
              }, '${process.env.FRONTEND_URL}');
              window.close();
            </script>
          </html>

    `;

      res.send(html);
    } catch (error) {
      const html = `
      <html>
        <script>
          window.opener.postMessage({
            type: 'oauth-error',
            payload: { message: 'GitHub login failed' }
          }, '${process.env.FRONTEND_URL}');
          window.close();
        </script>
      </html>
    `;
      res.send(html);
    }
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiHeader({
    name: 'x-secret-key',
    description: 'API Secret Key',
    required: true,
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      example: {
        id: '60d5ecb54b3xxb2c001f3e1234',
        accessToken: 'jwt.token.here',
        refreshToken: 'refresh.token.here',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Email already registered or invalid API key',
    schema: {
      example: {
        statusCode: 401,
        message: 'Email already registered',
      },
    },
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('x-secret-key') apiKey: string,
  ) {
    return this.authService.register(registerDto, apiKey);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      example: {
        userId: '60d5ecb54b3xxb2c001f3e1234',
        email: 'user@example.com',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refreshTokens(@Body() body: { userId: string; email: string }) {
    return this.authService.refreshTokens(body.userId, body.email);
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Validate JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: { example: { ok: true } },
  })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async validateToken(@Req() req) {
    return { ok: true, userId: req.user.sub };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'User Login' })
  @ApiHeader({
    name: 'x-secret-key',
    description: 'API Secret Key',
    required: true,
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successfully',
    schema: {
      example: {
        id: '60d5ecb5xx4b3b2c001f3e1234',
        accessToken: 'jwt.token.here',
        refreshToken: 'refresh.token.here',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or invalid API key',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid credentials',
      },
    },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Headers('x-secret-key') apiKey: string,
  ) {
    return this.authService.login(loginDto, apiKey);
  }
}
