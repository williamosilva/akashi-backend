// auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { User } from '../schemas/user.schema';
import { Project } from '../../project/schemas/project.schema';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userModel: Model<User>;
  let projectModel: Model<Project>;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            countDocuments: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: getModelToken(Project.name),
          useValue: {
            countDocuments: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
    projectModel = module.get<Model<Project>>(getModelToken(Project.name));
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    (configService.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_SECRET':
          return 'secret';
        case 'JWT_EXPIRATION':
          return '60s';
        case 'JWT_REFRESH_SECRET':
          return 'refresh-secret';
        case 'JWT_REFRESH_EXPIRATION':
          return '7d';
        default:
          return null;
      }
    });

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password',
      fullName: 'Test User',
    };

    it('should register a new user', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.create as jest.Mock).mockResolvedValue({
        id: '1',
        email: registerDto.email,
        fullName: registerDto.fullName,
        plan: 'free',
        provider: 'local',
      });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register(registerDto);

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: registerDto.email,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(userModel.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: 'hashed-password',
        fullName: registerDto.fullName,
        plan: 'free',
        provider: 'local',
      });
      expect(result).toEqual({
        id: '1',
        email: registerDto.email,
        fullName: registerDto.fullName,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw conflict if email already registered with local provider', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue({
        provider: 'local',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        new UnauthorizedException('Email already registered'),
      );
    });

    it('should throw conflict if email registered with different provider', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue({
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
    const loginDto = { email: 'test@example.com', password: 'password' };
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      fullName: 'Test User',
      password: 'hashed-password',
      provider: 'local',
    };

    it('should login successfully', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: loginDto.email,
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(result).toEqual({
        id: '1',
        email: mockUser.email,
        fullName: mockUser.fullName,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw unauthorized if user not found', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: '1' });
      (userModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserFromToken('valid-token')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should throw unauthorized if wrong provider', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        provider: 'google',
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException(
          'This account is registered via google. Log in using google.',
        ),
      );
    });

    it('should throw unauthorized if invalid password', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });
  });

  describe('refreshTokens', () => {
    it('should generate new access token', async () => {
      const mockPayload = { sub: '1', email: 'test@example.com' };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);
      (jwtService.signAsync as jest.Mock).mockResolvedValue('new-access-token');

      const result = await service.refreshTokens('valid-refresh-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-refresh-token',
        { secret: 'refresh-secret' },
      );
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('should throw unauthorized for invalid refresh token', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid token'),
      );

      await expect(
        service.refreshTokens('invalid-refresh-token'),
      ).rejects.toThrow(
        new UnauthorizedException('Refresh token inválido ou expirado'),
      );
    });
  });

  describe('getUserFromToken', () => {
    it('should return user info with project count', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        fullName: 'Test User',
        photo: 'photo.jpg',
        plan: 'pro',
      };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        sub: '1',
      });
      (userModel.findById as jest.Mock).mockResolvedValue(mockUser);
      (projectModel.countDocuments as jest.Mock).mockResolvedValue(3);

      const result = await service.getUserFromToken('valid-token');

      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        fullName: 'Test User',
        photo: 'photo.jpg',
        plan: 'pro',
        projectCount: 3,
      });
    });

    it('should throw unauthorized for invalid token', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue({
        name: 'JsonWebTokenError',
      });

      await expect(service.getUserFromToken('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });
    it('should throw unauthorized if user not found', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: '1' });
      (userModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserFromToken('valid-token')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });
  });

  describe('handleSocialLogin', () => {
    const mockProfile = {
      email: 'social@example.com',
      displayName: 'Social User',
      id: 'social-123',
      photos: [{ value: 'social-photo.jpg' }],
    };

    it('should create new user for social login', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue(null);
      (userModel.create as jest.Mock).mockResolvedValue({
        id: '2',
        email: mockProfile.email,
        fullName: mockProfile.displayName,
        provider: 'google',
        photo: mockProfile.photos[0].value,
        plan: 'free',
      });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('social-access')
        .mockResolvedValueOnce('social-refresh');

      const result = await service.handleSocialLogin(mockProfile, 'google');

      expect(userModel.create).toHaveBeenCalledWith({
        email: mockProfile.email,
        fullName: mockProfile.displayName,
        provider: 'google',
        providerId: mockProfile.id,
        photo: mockProfile.photos[0].value,
        plan: 'free',
      });
      expect(result).toMatchObject({
        email: mockProfile.email,
        fullName: mockProfile.displayName,
        photo: mockProfile.photos[0].value,
      });
    });

    it('should update existing user for same provider', async () => {
      const existingUser = {
        id: '2',
        email: mockProfile.email,
        fullName: 'Old Name',
        provider: 'google',
        photo: 'old-photo.jpg',
        save: jest.fn().mockResolvedValue(true),
      };
      (userModel.findOne as jest.Mock).mockResolvedValue(existingUser);

      await service.handleSocialLogin(mockProfile, 'google');

      expect(existingUser.fullName).toBe(mockProfile.displayName);
      expect(existingUser.photo).toBe(mockProfile.photos[0].value);
      expect(existingUser.save).toHaveBeenCalled();
    });

    it('should throw conflict for different provider', async () => {
      (userModel.findOne as jest.Mock).mockResolvedValue({
        provider: 'github',
      });

      await expect(
        service.handleSocialLogin(mockProfile, 'google'),
      ).rejects.toThrow(
        new ConflictException(
          'This email is already associated with an account github. Please log in using github.',
        ),
      );
    });
  });
});
