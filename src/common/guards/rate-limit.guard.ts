import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const RATE_LIMITS: Record<string, number> = {
  FREE: 20,
  PAID: 100,
};

const WINDOW_SECONDS = 60;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return true;
    }

    const userId = user.sub || user.id;
    const subscriptionStatus: string = user.subscription_status || 'FREE';
    const limit = RATE_LIMITS[subscriptionStatus] || RATE_LIMITS.FREE;
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, WINDOW_SECONDS);
    const results = await pipeline.exec();

    const count = results?.[2]?.[1] as number;

    if (count > limit) {
      const oldestInWindow = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfter =
        oldestInWindow.length >= 2
          ? Math.ceil(
              (parseInt(oldestInWindow[1], 10) + WINDOW_SECONDS * 1000 - now) /
                1000,
            )
          : WINDOW_SECONDS;

      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', retryAfter.toString());

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. ${subscriptionStatus} tier allows ${limit} requests per minute.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
