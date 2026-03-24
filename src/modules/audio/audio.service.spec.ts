import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AUDIO_REPOSITORY } from './interfaces/audio-repository.interface';
import { RedisService } from 'src/infrastructure/redis/redis.service';

describe('AudioService', () => {
  let service: AudioService;
  let audioRepo: {
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

  const mockAudio = {
    id: 'audio-1',
    prompt_id: 'prompt-1',
    user_id: 'user-1',
    title: 'Lo-fi Beat',
    url: 'https://cdn.example.com/audio/prompt-1.mp3',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    audioRepo = {
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
        AudioService,
        { provide: AUDIO_REPOSITORY, useValue: audioRepo },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<AudioService>(AudioService);
  });

  describe('findAll', () => {
    it('should return paginated audio from repository', async () => {
      const result = { data: [mockAudio], meta: { next_cursor: null } };
      audioRepo.findAll.mockResolvedValue(result);

      const response = await service.findAll({ limit: 10 });

      expect(response).toEqual(result);
      expect(audioRepo.findAll).toHaveBeenCalledWith({ limit: 10 });
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      const result = { data: [mockAudio], meta: { next_cursor: null } };
      redis.get.mockResolvedValue(JSON.stringify(result));

      const response = await service.findAll({ limit: 10 });

      expect(response).toEqual(JSON.parse(JSON.stringify(result)));
      expect(audioRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return audio by id', async () => {
      audioRepo.findById.mockResolvedValue(mockAudio);

      const result = await service.findById('audio-1');

      expect(result).toEqual(mockAudio);
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should return cached audio when available', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockAudio));

      const result = await service.findById('audio-1');

      expect(result).toEqual(JSON.parse(JSON.stringify(mockAudio)));
      expect(audioRepo.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when audio not found', async () => {
      audioRepo.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update audio and invalidate cache', async () => {
      const updated = { ...mockAudio, title: 'New Title' };
      audioRepo.findById.mockResolvedValue(mockAudio);
      audioRepo.update.mockResolvedValue(updated);

      const result = await service.update('audio-1', { title: 'New Title' });

      expect(result.title).toBe('New Title');
      expect(redis.del).toHaveBeenCalledWith('cache:audio:audio-1');
    });

    it('should throw NotFoundException when updating non-existent audio', async () => {
      audioRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate list cache after update', async () => {
      audioRepo.findById.mockResolvedValue(mockAudio);
      audioRepo.update.mockResolvedValue(mockAudio);
      redis.keys.mockResolvedValue(['cache:audio:list:start:10']);

      await service.update('audio-1', { title: 'New' });

      expect(redis.keys).toHaveBeenCalledWith('cache:audio:list:*');
      expect(redis.del).toHaveBeenCalledWith('cache:audio:list:start:10');
    });
  });
});
