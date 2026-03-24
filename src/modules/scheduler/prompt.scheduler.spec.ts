import { Test, TestingModule } from '@nestjs/testing';
import { PromptScheduler } from './prompt.scheduler';
import { PROMPT_REPOSITORY } from '../prompt/interfaces/prompt-repository.interface';
import { PromptProducer } from '../queue/prompt.producer';

describe('PromptScheduler', () => {
  let scheduler: PromptScheduler;
  let promptRepo: {
    findPending: jest.Mock;
    updateStatus: jest.Mock;
  };
  let promptProducer: { enqueue: jest.Mock };

  beforeEach(async () => {
    promptRepo = {
      findPending: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue({}),
    };
    promptProducer = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptScheduler,
        { provide: PROMPT_REPOSITORY, useValue: promptRepo },
        { provide: PromptProducer, useValue: promptProducer },
      ],
    }).compile();

    scheduler = module.get<PromptScheduler>(PromptScheduler);
  });

  it('should do nothing when no pending prompts', async () => {
    await scheduler.pollPendingPrompts();

    expect(promptRepo.findPending).toHaveBeenCalledWith(50);
    expect(promptProducer.enqueue).not.toHaveBeenCalled();
  });

  it('should enqueue pending prompts and set status to PROCESSING', async () => {
    const pending = [
      { id: 'p-1', user_id: 'u-1', subscription_status: 'PAID' },
      { id: 'p-2', user_id: 'u-2', subscription_status: 'FREE' },
    ];
    promptRepo.findPending.mockResolvedValue(pending);

    await scheduler.pollPendingPrompts();

    expect(promptRepo.updateStatus).toHaveBeenCalledWith('p-1', 'PROCESSING');
    expect(promptRepo.updateStatus).toHaveBeenCalledWith('p-2', 'PROCESSING');
    expect(promptProducer.enqueue).toHaveBeenCalledWith('p-1', 'u-1', 'PAID');
    expect(promptProducer.enqueue).toHaveBeenCalledWith('p-2', 'u-2', 'FREE');
  });

  it('should not run concurrently (guard with isRunning)', async () => {
    // Simulate a long-running findPending
    let resolvePending: (value: any) => void;
    promptRepo.findPending.mockReturnValue(
      new Promise((resolve) => {
        resolvePending = resolve;
      }),
    );

    // Start first poll (will block on findPending)
    const firstPoll = scheduler.pollPendingPrompts();

    // Start second poll — should return immediately because isRunning
    await scheduler.pollPendingPrompts();

    // findPending should have been called only once
    expect(promptRepo.findPending).toHaveBeenCalledTimes(1);

    // Resolve the first poll
    resolvePending!([]);
    await firstPoll;
  });

  it('should handle errors gracefully and reset isRunning', async () => {
    promptRepo.findPending.mockRejectedValue(new Error('DB down'));

    await scheduler.pollPendingPrompts();

    // Should not throw, and isRunning should be reset (next call works)
    promptRepo.findPending.mockResolvedValue([]);
    await scheduler.pollPendingPrompts();

    expect(promptRepo.findPending).toHaveBeenCalledTimes(2);
  });

  it('should default to FREE when subscription_status not present', async () => {
    const pending = [{ id: 'p-1', user_id: 'u-1' }];
    promptRepo.findPending.mockResolvedValue(pending);

    await scheduler.pollPendingPrompts();

    expect(promptProducer.enqueue).toHaveBeenCalledWith('p-1', 'u-1', 'FREE');
  });
});
