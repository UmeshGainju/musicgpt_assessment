import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PromptProducer, PROMPT_QUEUE } from './prompt.producer';

describe('PromptProducer', () => {
  let producer: PromptProducer;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptProducer,
        { provide: getQueueToken(PROMPT_QUEUE), useValue: queue },
      ],
    }).compile();

    producer = module.get<PromptProducer>(PromptProducer);
  });

  it('should enqueue a PAID job with priority 1', async () => {
    await producer.enqueue('prompt-1', 'user-1', 'PAID');

    expect(queue.add).toHaveBeenCalledWith(
      'process-prompt',
      { promptId: 'prompt-1', userId: 'user-1', subscriptionStatus: 'PAID' },
      {
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  });

  it('should enqueue a FREE job with priority 10', async () => {
    await producer.enqueue('prompt-2', 'user-2', 'FREE');

    expect(queue.add).toHaveBeenCalledWith(
      'process-prompt',
      { promptId: 'prompt-2', userId: 'user-2', subscriptionStatus: 'FREE' },
      {
        priority: 10,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  });
});
