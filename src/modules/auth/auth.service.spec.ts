import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { RefreshTokenRepository } from './refresh-token.repository';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwtService: { sign: jest.Mock };
  let refreshTokenRepo: {
    create: jest.Mock;
    findByToken: jest.Mock;
    revokeToken: jest.Mock;
    revokeAllForUser: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('mock-access-token') };
    refreshTokenRepo = {
      create: jest.fn(),
      findByToken: jest.fn(),
      revokeToken: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                JWT_ACCESS_EXPIRY: '15m',
                JWT_REFRESH_EXPIRY: '30d',
              };
              return map[key] || '';
            }),
          },
        },
        { provide: RefreshTokenRepository, useValue: refreshTokenRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        display_name: 'Test User',
        subscription_status: 'FREE',
        password: 'hashed',
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        display_name: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.display_name).toBe('Test User');
      expect(result.tokens.access_token).toBe('mock-access-token');
      expect(result.tokens.refresh_token).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(refreshTokenRepo.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123!',
          display_name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return user and tokens for valid credentials', async () => {
      const hashed = await bcrypt.hash('Password123!', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        display_name: 'Test User',
        subscription_status: 'FREE',
        password: hashed,
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.user.id).toBe('user-1');
      expect(result.tokens.access_token).toBeDefined();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash('Password123!', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: hashed,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      refreshTokenRepo.findByToken.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should detect token reuse and revoke all tokens', async () => {
      refreshTokenRepo.findByToken.mockResolvedValue({
        user_id: 'user-1',
        revoked: true,
      });

      await expect(service.refresh('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('should throw UnauthorizedException for expired token', async () => {
      refreshTokenRepo.findByToken.mockResolvedValue({
        user_id: 'user-1',
        revoked: false,
        expires_at: new Date(Date.now() - 1000), // expired
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens', async () => {
      await service.logout('user-1');
      expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
