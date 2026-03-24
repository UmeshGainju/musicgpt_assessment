import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: string, token: string, expiresAt: Date) {
    return this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: this.hashToken(token),
        expires_at: expiresAt,
      },
    });
  }

  async findByToken(token: string) {
    return this.prisma.refreshToken.findUnique({
      where: { token_hash: this.hashToken(token) },
      include: { user: true },
    });
  }

  async revokeToken(token: string) {
    const hash = this.hashToken(token);
    return this.prisma.refreshToken.updateMany({
      where: { token_hash: hash },
      data: { revoked: true },
    });
  }

  async revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked: false },
      data: { revoked: true },
    });
  }

  async deleteExpired() {
    return this.prisma.refreshToken.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
  }
}
