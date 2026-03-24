import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenRepository } from './refresh-token.repository';
import {
  AuthenticatedUser,
  JwtPayload,
  TokenPair,
} from './interfaces/auth.interfaces';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        display_name: dto.display_name,
      },
    });

    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.subscription_status,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        subscription_status: user.subscription_status,
      },
      tokens,
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.subscription_status,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        subscription_status: user.subscription_status,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const stored = await this.refreshTokenRepo.findByToken(refreshToken);

    if (!stored || stored.revoked) {
      // Token reuse detection: if a revoked token is used, revoke ALL tokens
      if (stored?.revoked) {
        this.logger.warn(
          `Refresh token reuse detected for user ${stored.user_id}`,
        );
        await this.refreshTokenRepo.revokeAllForUser(stored.user_id);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke old token, issue new pair
    await this.refreshTokenRepo.revokeToken(refreshToken);

    return this.generateTokenPair(
      stored.user.id,
      stored.user.email,
      stored.user.subscription_status,
    );
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllForUser(userId);
  }

  private async generateTokenPair(
    userId: string,
    email: string,
    subscriptionStatus: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      subscription_status: subscriptionStatus,
    };

    const accessToken = this.jwtService.sign(
      { ...payload } as Record<string, unknown>,
      {
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_EXPIRY',
        ) as any,
      },
    );

    const refreshToken = randomBytes(64).toString('hex');

    // Parse refresh expiry to calculate date
    const refreshExpiryStr =
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY');
    const days = parseInt(refreshExpiryStr, 10) || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.refreshTokenRepo.create(userId, refreshToken, expiresAt);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
