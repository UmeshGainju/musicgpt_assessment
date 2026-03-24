import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  private async findUserOrFail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async subscribe(userId: string) {
    const user = await this.findUserOrFail(userId);

    if (user.subscription_status === SubscriptionStatus.PAID) {
      throw new ConflictException('Already subscribed to PAID tier');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { subscription_status: SubscriptionStatus.PAID },
    });

    return {
      id: updated.id,
      email: updated.email,
      display_name: updated.display_name,
      subscription_status: updated.subscription_status,
    };
  }

  async cancel(userId: string) {
    const user = await this.findUserOrFail(userId);

    if (user.subscription_status === SubscriptionStatus.FREE) {
      throw new ConflictException('Already on FREE tier');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { subscription_status: SubscriptionStatus.FREE },
    });

    return {
      id: updated.id,
      email: updated.email,
      display_name: updated.display_name,
      subscription_status: updated.subscription_status,
    };
  }
}
