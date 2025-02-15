import {
  Controller,
  Post,
  Body,
  Headers,
  Get,
  UseGuards,
  Req,
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
  async googleAuthCallback(@Req() req) {
    try {
      console.log('Google callback data:', req.user);
      return await this.authService.handleSocialLogin(req.user, 'google');
    } catch (error) {
      console.error('Google callback error:', error);
      throw error;
    }
  }
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub Authentication' })
  async githubAuth() {
    // Inicia o fluxo de autenticação do GitHub
  }
  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(@Req() req) {
    return this.authService.handleSocialLogin(req.user, 'github');
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
