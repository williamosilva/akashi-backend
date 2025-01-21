import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName } = registerDto;

    // Verificar se o usuário já existe
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar novo usuário
    const user = await this.userModel.create({
      email,
      password: hashedPassword,
      fullName,
    });

    // Gerar tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return tokens;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Buscar usuário
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Gerar tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return tokens;
  }

  async generateTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: 'your-access-token-secret',
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: 'your-refresh-token-secret',
          expiresIn: '7d',
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(userId: string, email: string) {
    return this.generateTokens(userId, email);
  }
}
