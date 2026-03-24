import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let redis: {
    pipeline: jest.Mock;
    zrange: jest.Mock;
  };
  let reflector: Reflector;
  let pipelineMock: {
    zremrangebyscore: jest.Mock;
    zadd: jest.Mock;
    zcard: jest.Mock;
    expire: jest.Mock;
    exec: jest.Mock;
  };

  beforeEach(() => {
    pipelineMock = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };
    redis = {
      pipeline: jest.fn().mockReturnValue(pipelineMock),
      zrange: jest
        .fn()
        .mockResolvedValue(['timestamp:rand', String(Date.now())]),
    };
    reflector = new Reflector();

    guard = new RateLimitGuard(redis as any, reflector);
  });

  function createMockContext(
    user?: { sub: string; subscription_status: string },
    isPublic = false,
  ): ExecutionContext {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic as any);

    return mockContext;
  }

  it('should allow public routes', async () => {
    const context = createMockContext(undefined, true);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('should allow requests without a user', async () => {
    const context = createMockContext(undefined, false);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('should allow requests within rate limit', async () => {
    // Pipeline exec returns results: [zremrangebyscore, zadd, zcard, expire]
    // zcard result is the 3rd element — [null, count]
    pipelineMock.exec.mockResolvedValue([
      [null, 0], // zremrangebyscore
      [null, 1], // zadd
      [null, 5], // zcard — current request count
      [null, 1], // expire
    ]);

    const context = createMockContext({
      sub: 'user-1',
      subscription_status: 'FREE',
    });

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('should block requests exceeding FREE rate limit (20/min)', async () => {
    pipelineMock.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 21], // exceeds FREE limit of 20
      [null, 1],
    ]);

    const context = createMockContext({
      sub: 'user-1',
      subscription_status: 'FREE',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('should allow PAID users higher rate limit (100/min)', async () => {
    pipelineMock.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 50], // under PAID limit of 100
      [null, 1],
    ]);

    const context = createMockContext({
      sub: 'user-1',
      subscription_status: 'PAID',
    });

    expect(await guard.canActivate(context)).toBe(true);
  });
});
