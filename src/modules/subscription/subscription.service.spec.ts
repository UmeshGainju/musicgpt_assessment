import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  describe('subscribe', () => {
    it('should upgrade user to PAID tier', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        subscription_status: 'FREE',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        display_name: 'Test User',
        subscription_status: 'PAID',
      });

      const result = await service.subscribe('user-1');

      expect(result.subscription_status).toBe('PAID');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { subscription_status: 'PAID' },
      });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.subscribe('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if already PAID', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        subscription_status: 'PAID',
      });

      await expect(service.subscribe('user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('cancel', () => {
    it('should downgrade user to FREE tier', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        subscription_status: 'PAID',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        display_name: 'Test User',
        subscription_status: 'FREE',
      });

      const result = await service.cancel('user-1');

      expect(result.subscription_status).toBe('FREE');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { subscription_status: 'FREE' },
      });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.cancel('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if already FREE', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        subscription_status: 'FREE',
      });

      await expect(service.cancel('user-1')).rejects.toThrow(ConflictException);
    });
  });
});
