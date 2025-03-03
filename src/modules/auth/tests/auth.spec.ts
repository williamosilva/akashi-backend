import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AuthService } from 'src/modules/auth/auth.service';
import { User } from 'src/modules/auth/schemas/user.schema';
import { Project } from 'src/modules/project/schemas/project.schema';
import {
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: Model<User>;
  let projectModel: Model<Project>;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockProjectModel = {
    countDocuments: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      const values = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRATION: '1h',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRATION: '7d',
      };
      return values[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Project.name),
          useValue: mockProjectModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
    projectModel = module.get<Model<Project>>(getModelToken(Project.name));
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock bcrypt
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementation(() => Promise.resolve('hashed-password'));
    jest.spyOn(bcrypt, 'compare').mockImplementation((plaintext, hash) => {
      return Promise.resolve(plaintext === 'correct-password');
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };

      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({
        id: 'user-id',
        email: registerDto.email,
        fullName: registerDto.fullName,
      });

      jest.spyOn(service, 'generateTokens').mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      const result = await service.register(registerDto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: registerDto.email,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockUserModel.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: 'hashed-password',
        fullName: registerDto.fullName,
        plan: 'free',
        provider: 'local',
      });
      expect(service.generateTokens).toHaveBeenCalledWith(
        'user-id',
        registerDto.email,
      );
      expect(result).toEqual({
        id: 'user-id',
        email: registerDto.email,
        fullName: registerDto.fullName,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
    });

    it('should throw error if email already registered with local provider', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };

      mockUserModel.findOne.mockResolvedValue({
        email: registerDto.email,
        provider: 'local',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        new UnauthorizedException('Email already registered'),
      );
    });

    it('should throw error if email registered with another provider', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };

      mockUserModel.findOne.mockResolvedValue({
        email: registerDto.email,
        provider: 'google',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        new UnauthorizedException(
          'This account is registered via google. Log in using google.',
        ),
      );
    });
  });

  describe('login', () => {
    it('should login user successfully with correct credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      };

      mockUserModel.findOne.mockResolvedValue({
        id: 'user-id',
        email: loginDto.email,
        fullName: 'Test User',
        password: 'hashed-password',
        provider: 'local',
      });

      jest.spyOn(service, 'generateTokens').mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      const result = await service.login(loginDto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: loginDto.email,
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        'hashed-password',
      );
      expect(service.generateTokens).toHaveBeenCalledWith(
        'user-id',
        loginDto.email,
      );
      expect(result).toEqual({
        id: 'user-id',
        email: loginDto.email,
        fullName: 'Test User',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
    });

    it('should throw error if user not found', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockUserModel.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw error if password is incorrect', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      mockUserModel.findOne.mockResolvedValue({
        id: 'user-id',
        email: loginDto.email,
        password: 'hashed-password',
        provider: 'local',
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw error if user registered with different provider', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockUserModel.findOne.mockResolvedValue({
        id: 'user-id',
        email: loginDto.email,
        provider: 'google',
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException(
          'This account is registered via google. Log in using google.',
        ),
      );
    });

    it('should throw error if password is not set', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockUserModel.findOne.mockResolvedValue({
        id: 'user-id',
        email: loginDto.email,
        provider: 'local',
        password: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const userId = 'user-id';
      const email = 'test@example.com';

      mockJwtService.signAsync.mockResolvedValueOnce('access-token');
      mockJwtService.signAsync.mockResolvedValueOnce('refresh-token');

      const result = await service.generateTokens(userId, email);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: userId, email },
        {
          secret: 'test-secret',
          expiresIn: '1h',
        },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: userId, email },
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        },
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('refreshTokens', () => {
    it('should refresh access token with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockJwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refreshTokens(refreshToken);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(payload, {
        secret: 'test-secret',
        expiresIn: '1h',
      });
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('should throw error with invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token inválido ou expirado'),
      );
    });
  });

  describe('getUserFromToken', () => {
    it('should return user data from valid token', async () => {
      const accessToken = 'valid-access-token';
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
      };
      const user = {
        _id: 'user-id',
        id: 'user-id',
        email: 'test@example.com',
        fullName: 'Test User',
        photo: 'photo-url',
        plan: 'premium',
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockUserModel.findById.mockResolvedValue(user);
      mockProjectModel.countDocuments.mockResolvedValue(5);

      const result = await service.getUserFromToken(accessToken);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(accessToken, {
        secret: 'test-secret',
      });
      expect(userModel.findById).toHaveBeenCalledWith(payload.sub);
      expect(projectModel.countDocuments).toHaveBeenCalledWith({
        user: user._id,
      });
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        photo: user.photo,
        plan: user.plan,
        projectCount: 5,
      });
    });

    it('should throw error if user not found', async () => {
      const accessToken = 'valid-access-token';
      const payload = {
        sub: 'non-existent-id',
        email: 'test@example.com',
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockUserModel.findById.mockResolvedValue(null);

      await expect(service.getUserFromToken(accessToken)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should throw UnauthorizedException on JWT error', async () => {
      const accessToken = 'invalid-access-token';
      const jwtError = new Error('Invalid token');
      jwtError.name = 'JsonWebTokenError';

      mockJwtService.verifyAsync.mockRejectedValue(jwtError);

      await expect(service.getUserFromToken(accessToken)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      const accessToken = 'valid-access-token';

      mockJwtService.verifyAsync.mockRejectedValue(new Error('Unknown error'));

      await expect(service.getUserFromToken(accessToken)).rejects.toThrow(
        new InternalServerErrorException('Error processing token'),
      );
    });
  });

  describe('handleSocialLogin', () => {
    it('should login existing user with same provider', async () => {
      const profile = {
        id: 'social-id',
        email: 'test@example.com',
        displayName: 'Social User',
        photo: 'photo-url',
      };
      const provider = 'google';
      const existingUser = {
        id: 'user-id',
        email: profile.email,
        fullName: 'Old Name',
        photo: 'old-photo',
        provider,
        providerId: 'old-social-id',
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockResolvedValue(existingUser);
      jest.spyOn(service, 'generateTokens').mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      const result = await service.handleSocialLogin(profile, provider);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: profile.email,
      });
      expect(existingUser.save).toHaveBeenCalled();
      expect(existingUser.fullName).toBe(profile.displayName);
      expect(existingUser.providerId).toBe(profile.id);
      expect(existingUser.photo).toBe(profile.photo);
      expect(service.generateTokens).toHaveBeenCalledWith(
        existingUser.id,
        existingUser.email,
      );
      expect(result).toEqual({
        id: existingUser.id,
        email: existingUser.email,
        fullName: existingUser.fullName,
        photo: existingUser.photo,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
    });

    it('should throw error if email registered with different provider', async () => {
      const profile = {
        id: 'social-id',
        email: 'test@example.com',
        displayName: 'Social User',
      };
      const provider = 'google';
      const existingUser = {
        id: 'user-id',
        email: profile.email,
        provider: 'github',
      };

      mockUserModel.findOne.mockResolvedValue(existingUser);

      await expect(
        service.handleSocialLogin(profile, provider),
      ).rejects.toThrow(
        new ConflictException(
          'This email is already associated with an account github. Please log in using github.',
        ),
      );
    });

    it('should create new user if email not registered', async () => {
      const profile = {
        id: 'social-id',
        email: 'new@example.com',
        displayName: 'New User',
        photo: 'photo-url',
      };
      const provider = 'github';
      const newUser = {
        id: 'new-user-id',
        email: profile.email,
        fullName: profile.displayName,
        photo: profile.photo,
      };

      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(newUser);
      jest.spyOn(service, 'generateTokens').mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      const result = await service.handleSocialLogin(profile, provider);

      expect(mockUserModel.create).toHaveBeenCalledWith({
        email: profile.email,
        fullName: profile.displayName,
        provider,
        providerId: profile.id,
        photo: profile.photo,
        plan: 'free',
      });
      expect(service.generateTokens).toHaveBeenCalledWith(
        newUser.id,
        newUser.email,
      );
      expect(result).toEqual({
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        photo: newUser.photo,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
    });

    it('should handle profile without email by creating one', async () => {
      const profile = {
        id: 'social-id-no-email',
        displayName: 'No Email User',
      };
      const provider = 'github';
      const expectedEmail = 'social-id-no-email@github.social';
      const newUser = {
        id: 'new-user-id',
        email: expectedEmail,
        fullName: profile.displayName,
        photo: undefined,
      };

      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(newUser);
      jest.spyOn(service, 'generateTokens').mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      const result = await service.handleSocialLogin(profile, provider);

      expect(mockUserModel.create).toHaveBeenCalledWith({
        email: expectedEmail,
        fullName: profile.displayName,
        provider,
        providerId: profile.id,
        photo: undefined,
        plan: 'free',
      });
      expect(result.email).toBe(expectedEmail);
    });

    it('should throw InternalServerErrorException on unexpected errors', async () => {
      const profile = {
        id: 'social-id',
        email: 'test@example.com',
        displayName: 'Test User',
      };
      const provider = 'google';

      mockUserModel.findOne.mockRejectedValue(new Error('Database error'));

      await expect(
        service.handleSocialLogin(profile, provider),
      ).rejects.toThrow(
        new InternalServerErrorException('Error processing social login'),
      );
    });
  });
});
