import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
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

    // Verifica se o email já está registrado com outro provider
    if (existingUser) {
      if (existingUser.provider !== 'local') {
        throw new UnauthorizedException(
          `This account is registered via ${existingUser.provider}. Log in using ${existingUser.provider}.`,
        );
      } else {
        throw new UnauthorizedException('Email already registered');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userModel.create({
      email,
      password: hashedPassword,
      fullName,
      plan: 'free',
      provider: 'local',
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.tokenVersion,
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, apiKey: string) {
    this.validateApiKey(apiKey);
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });

    // Verifica se o usuário existe
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verifica se o usuário não é local
    if (user.provider !== 'local') {
      throw new UnauthorizedException(
        `This account is registered via ${user.provider}. Log in using ${user.provider}.`,
      );
    }

    // Verifica se a senha está definida
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.tokenVersion,
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      ...tokens,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    tokenVersion: number,
  ) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRATION'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, tokenVersion }, // Inclui tokenVersion no refresh
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userModel.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verifica a versão do token
      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Token revoked');
      }

      return this.generateTokens(
        user.id.toString(),
        user.email,
        user.tokenVersion,
      );
    } catch (error) {
      let errorMessage = 'Invalid refresh token';

      if (error instanceof TokenExpiredError) {
        errorMessage = 'Refresh token expired';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Malformed refresh token';
      }

      throw new UnauthorizedException(errorMessage);
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId);
  }

  async handleSocialLogin(profile: any, provider: 'google' | 'github') {
    console.log('Profile:', profile);

    console.log('Dados do Perfil:', {
      email: profile.email,
      displayName: profile.displayName,
      photo: profile.photo,
    });

    try {
      const email = profile.email || `${profile.id}@${provider}.social`;

      // Primeiro, procura por qualquer usuário com este email, independente do provider
      const existingUser = await this.userModel.findOne({
        email: email,
      });

      if (existingUser) {
        // Se encontrou um usuário com este email, verifica se o provider é diferente
        if (existingUser.provider !== provider) {
          throw new ConflictException(
            `This email is already associated with an account ${existingUser.provider}. Please log in using ${existingUser.provider}.`,
          );
        }

        // Se chegou aqui, o provider é o mesmo, então atualiza os dados
        existingUser.fullName = profile.displayName;
        existingUser.providerId = profile.id;
        if (profile.photo) existingUser.photo = profile.photo;
        await existingUser.save();

        const tokens = await this.generateTokens(
          existingUser.id,
          existingUser.email,
          existingUser.tokenVersion,
        );
        return {
          id: existingUser.id,
          email: existingUser.email,
          fullName: existingUser.fullName,
          photo: existingUser.photo,
          ...tokens,
        };
      }

      // Se não encontrou usuário, cria um novo
      const newUser = await this.userModel.create({
        email,
        fullName: profile.displayName,
        provider,
        providerId: profile.id,
        photo: profile.photo,
        plan: 'free',
      });

      const tokens = await this.generateTokens(
        newUser.id,
        newUser.email,
        newUser.tokenVersion,
      );
      return {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        photo: newUser.photo,
        ...tokens,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('Error in handleSocialLogin:', error);
      throw new InternalServerErrorException('Error processing social login');
    }
  }
}
