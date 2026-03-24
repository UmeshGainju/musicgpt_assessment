import { Test, TestingModule } from '@nestjs/testing';
import { PromptService } from './prompt.service';
import { PROMPT_REPOSITORY } from './interfaces/prompt-repository.interface';
import { RedisService } from '../../infrastructure/redis/redis.service';

describe('PromptService', () => {
  let service: PromptService;
  let promptRepo: {
    create: jest.Mock;
    findByUserId: jest.Mock;
  };
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
  };

  const mockPrompt = {
    id: 'prompt-1',
    user_id: 'user-1',
    text: 'Generate a lo-fi beat',
    status: 'PENDING',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    promptRepo = {
      create: jest.fn(),
      findByUserId: jest.fn(),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptService,
        { provide: PROMPT_REPOSITORY, useValue: promptRepo },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<PromptService>(PromptService);
  });

  describe('create', () => {
    it('should create a prompt and invalidate cache', async () => {
      promptRepo.create.mockResolvedValue(mockPrompt);

      const result = await service.create('user-1', 'Generate a lo-fi beat');

      expect(result).toEqual(mockPrompt);
      expect(promptRepo.create).toHaveBeenCalledWith(
        'user-1',
        'Generate a lo-fi beat',
      );
      expect(redis.keys).toHaveBeenCalledWith('cache:prompts:user-1:*');
    });

    it('should delete matching cache keys on create', async () => {
      promptRepo.create.mockResolvedValue(mockPrompt);
      redis.keys.mockResolvedValue(['cache:prompts:user-1:start:10']);

      await service.create('user-1', 'test');

      expect(redis.del).toHaveBeenCalledWith('cache:prompts:user-1:start:10');
    });
  });

  describe('findByUserId', () => {
    it('should return paginated prompts from repository', async () => {
      const result = { data: [mockPrompt], meta: { next_cursor: null } };
      promptRepo.findByUserId.mockResolvedValue(result);

      const response = await service.findByUserId('user-1', { limit: 10 });

      expect(response).toEqual(result);
      expect(promptRepo.findByUserId).toHaveBeenCalledWith('user-1', {
        limit: 10,
      });
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      const result = { data: [mockPrompt], meta: { next_cursor: null } };
      redis.get.mockResolvedValue(JSON.stringify(result));

      const response = await service.findByUserId('user-1', { limit: 10 });

      expect(response).toEqual(JSON.parse(JSON.stringify(result)));
      expect(promptRepo.findByUserId).not.toHaveBeenCalled();
    });
  });
});
