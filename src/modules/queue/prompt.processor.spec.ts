import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { PromptProcessor } from './prompt.processor';
import { RedisService } from 'src/infrastructure/redis/redis.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

describe('PromptProcessor', () => {
  let processor: PromptProcessor;
  let prisma: {
    prompt: { update: jest.Mock; findUnique: jest.Mock };
    audio: { create: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let redis: {
    keys: jest.Mock;
    del: jest.Mock;
    publish: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      prompt: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
      audio: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    redis = {
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn(),
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    processor = module.get<PromptProcessor>(PromptProcessor);

    // Make setTimeout instant in all tests
    jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeJob = (overrides?: Partial<PromptJobData>) =>
    ({
      data: {
        promptId: 'prompt-1',
        userId: 'user-1',
        subscriptionStatus: 'PAID',
        ...overrides,
      },
    }) as Job;

  interface PromptJobData {
    promptId: string;
    userId: string;
    subscriptionStatus: string;
  }

  it('should process a prompt job successfully', async () => {
    prisma.prompt.findUnique.mockResolvedValue({
      id: 'prompt-1',
      text: 'Create a rock song',
      status: 'PENDING',
    });

    const createdAudio = {
      id: 'audio-1',
      title: 'Generated: Create a rock song',
      url: 'https://cdn.musicgpt.ai/audio/prompt-1.mp3',
    };

    // eslint-disable-next-line @typescript-eslint/ban-types
    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        audio: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(createdAudio),
        },
        prompt: { update: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    await processor.process(makeJob());

    // Verify status was set to PROCESSING
    expect(prisma.prompt.update).toHaveBeenCalledWith({
      where: { id: 'prompt-1' },
      data: { status: 'PROCESSING' },
    });

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();

    // Verify WebSocket notification was published
    expect(redis.publish).toHaveBeenCalledWith(
      'ws:notifications',
      expect.stringContaining('"event":"prompt:completed"'),
    );
  });

  it('should skip if prompt not found', async () => {
    prisma.prompt.findUnique.mockResolvedValue(null);

    await processor.process(makeJob({ promptId: 'nonexistent' }));

    // Should not attempt to update status
    expect(prisma.prompt.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should skip if prompt already completed', async () => {
    prisma.prompt.findUnique.mockResolvedValue({
      id: 'prompt-1',
      text: 'test',
      status: 'COMPLETED',
    });

    await processor.process(makeJob());

    expect(prisma.prompt.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should handle duplicate audio (idempotency)', async () => {
    prisma.prompt.findUnique.mockResolvedValue({
      id: 'prompt-1',
      text: 'Create a rock song',
      status: 'PENDING',
    });

    const existingAudio = {
      id: 'audio-existing',
      title: 'Generated: Create a rock song',
      url: 'https://cdn.musicgpt.ai/audio/prompt-1.mp3',
    };

    // eslint-disable-next-line @typescript-eslint/ban-types
    prisma.$transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        audio: {
          findUnique: jest.fn().mockResolvedValue(existingAudio),
          create: jest.fn(),
        },
        prompt: { update: jest.fn().mockResolvedValue({}) },
      };
      const result = await fn(tx);
      // Audio.create should NOT have been called
      expect(tx.audio.create).not.toHaveBeenCalled();
      return result;
    });

    await processor.process(makeJob());

    expect(redis.publish).toHaveBeenCalledWith(
      'ws:notifications',
      expect.stringContaining('"audioId":"audio-existing"'),
    );
  });

  it('should rollback status to PENDING on failure', async () => {
    prisma.prompt.findUnique.mockResolvedValue({
      id: 'prompt-1',
      text: 'Create a rock song',
      status: 'PENDING',
    });

    prisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

    await expect(processor.process(makeJob())).rejects.toThrow(
      'DB connection lost',
    );

    // Verify rollback to PENDING
    expect(prisma.prompt.update).toHaveBeenCalledWith({
      where: { id: 'prompt-1' },
      data: { status: 'PENDING' },
    });
  });
});
