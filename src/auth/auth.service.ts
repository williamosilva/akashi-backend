import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private validateApiKey(providedSecret: string | undefined): void {
    const expectedSecret = this.configService.get<string>('SECRET_KEY');

    if (!providedSecret) {
      throw new UnauthorizedException('Secret key is missing in headers');
    }

    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Provided secret key is invalid');
    }
  }

  async register(registerDto: RegisterDto, apiKey: string) {
    this.validateApiKey(apiKey);
    const { email, password, fullName } = registerDto;

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userModel.create({
      email,
      password: hashedPassword,
      fullName,
      plan: 'free',
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      id: user.id,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, apiKey: string) {
    this.validateApiKey(apiKey);
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || '');
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      id: user.id,
      // email: user.email,
      // fullName: user.fullName,
      ...tokens,
    };
  }

  async generateTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRATION'),
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async handleSocialLogin(profile: any, provider: 'google' | 'github') {
    console.log('Dados do Perfil (GitHub):', {
      email: profile.email,
      displayName: profile.displayName,
      photo: profile.photo,
    });

    try {
      const email = profile.email || `${profile.id}@${provider}.social`;

      let user = await this.userModel.findOne({ email });

      // Criar ou atualizar usuário
      if (!user) {
        user = await this.userModel.create({
          email,
          fullName: profile.displayName, // Usa displayName do perfil
          provider,
          providerId: profile.id,
          photo: profile.photo,
          plan: 'free',
        });
      } else {
        // Atualiza dados mesmo se o provider for o mesmo
        user.fullName = profile.displayName; // ← Atualiza sempre
        user.provider = provider;
        user.providerId = profile.id;
        if (profile.photo) user.photo = profile.photo;
        await user.save();
      }

      // Gerar tokens e retornar
      const tokens = await this.generateTokens(user.id, user.email);
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        photo: user.photo,
        ...tokens,
      };
    } catch (error) {
      console.error('Error in handleSocialLogin:', error);
      throw error;
    }
  }

  async refreshTokens(userId: string, email: string) {
    return this.generateTokens(userId, email);
  }
}
