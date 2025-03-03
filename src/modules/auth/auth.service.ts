import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Project } from 'src/modules/project/schemas/project.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
  async register(registerDto: RegisterDto) {
    const { email, password, fullName } = registerDto;

    const existingUser = await this.userModel.findOne({ email });

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

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.provider !== 'local') {
      throw new UnauthorizedException(
        `This account is registered via ${user.provider}. Log in using ${user.provider}.`,
      );
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
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

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const newAccessToken = await this.jwtService.signAsync(
        {
          sub: payload.sub,
          email: payload.email,
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRATION'),
        },
      );

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  async getUserFromToken(accessToken: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    photo: string | undefined;
    plan: string;
    projectCount: number;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const projectCount = await this.projectModel.countDocuments({
        user: user._id,
      });

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        photo: user.photo,
        plan: user.plan || 'free',
        projectCount,
      };
    } catch (error) {
      if (
        error?.name === 'JsonWebTokenError' ||
        error?.name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      throw new InternalServerErrorException('Error processing token');
    }
  }

  async handleSocialLogin(profile: any, provider: 'google' | 'github') {
    try {
      const email = profile.email || `${profile.id}@${provider}.social`;

      const existingUser = await this.userModel.findOne({
        email: email,
      });

      if (existingUser) {
        if (existingUser.provider !== provider) {
          throw new ConflictException(
            `This email is already associated with an account ${existingUser.provider}. Please log in using ${existingUser.provider}.`,
          );
        }

        existingUser.fullName = profile.displayName;
        existingUser.providerId = profile.id;
        if (profile.photos?.[0]?.value)
          existingUser.photo = profile.photos[0].value;
        await existingUser.save();

        const tokens = await this.generateTokens(
          existingUser.id,
          existingUser.email,
        );
        return {
          id: existingUser.id,
          email: existingUser.email,
          fullName: existingUser.fullName,
          photo: existingUser.photo,
          ...tokens,
        };
      }

      const newUser = await this.userModel.create({
        email,
        fullName: profile.displayName,
        provider,
        providerId: profile.id,
        photo: profile.photos?.[0]?.value,
        plan: 'free',
      });

      const tokens = await this.generateTokens(newUser.id, newUser.email);

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
