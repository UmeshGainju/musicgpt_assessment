import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';
import { RedisService } from '../../infrastructure/redis/redis.service';

describe('UserService', () => {
  let service: UserService;
  let userRepo: {
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
  };
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    display_name: 'Test User',
    subscription_status: 'FREE',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    userRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: USER_REPOSITORY, useValue: userRepo },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('findAll', () => {
    it('should return paginated users from repository', async () => {
      const result = { data: [mockUser], meta: { next_cursor: null } };
      userRepo.findAll.mockResolvedValue(result);

      const response = await service.findAll({ limit: 10 });

      expect(response).toEqual(result);
      expect(userRepo.findAll).toHaveBeenCalledWith({ limit: 10 });
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      const result = { data: [mockUser], meta: { next_cursor: null } };
      redis.get.mockResolvedValue(JSON.stringify(result));

      const response = await service.findAll({ limit: 10 });

      expect(response).toEqual(JSON.parse(JSON.stringify(result)));
      expect(userRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      userRepo.findById.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should return cached user when available', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockUser));

      const result = await service.findById('user-1');

      expect(result).toEqual(JSON.parse(JSON.stringify(mockUser)));
      expect(userRepo.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update user and invalidate cache', async () => {
      const updated = { ...mockUser, display_name: 'Updated Name' };
      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(updated);

      const result = await service.update('user-1', {
        display_name: 'Updated Name',
      });

      expect(result.display_name).toBe('Updated Name');
      expect(redis.del).toHaveBeenCalledWith('cache:user:user-1');
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { display_name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate list cache after update', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(mockUser);
      redis.keys.mockResolvedValue(['cache:users:list:start:10']);

      await service.update('user-1', { display_name: 'New' });

      expect(redis.keys).toHaveBeenCalledWith('cache:users:list:*');
      expect(redis.del).toHaveBeenCalledWith('cache:users:list:start:10');
    });
  });
});
