import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisService } from 'src/infrastructure/redis/redis.service';

const SESSION_PREFIX = 'session:';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly sessionTtlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    const refreshExpiryDays =
      parseInt(
        this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY'),
        10,
      ) || 30;
    this.sessionTtlSeconds = refreshExpiryDays * 24 * 60 * 60;
  }

  /** Create a new session in Redis and return the session_id */
  async create(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const key = `${SESSION_PREFIX}${sessionId}`;
    await this.redis.set(key, userId, 'EX', this.sessionTtlSeconds);
    this.logger.debug(`Session ${sessionId} created for user ${userId}`);
    return sessionId;
  }

  /** Validate that a session exists and belongs to the given user */
  async validate(sessionId: string, userId: string): Promise<boolean> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    const storedUserId = await this.redis.get(key);
    return storedUserId === userId;
  }

  /** Check if a session exists (without user check) */
  async exists(sessionId: string): Promise<boolean> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /** Destroy a specific session */
  async destroy(sessionId: string): Promise<void> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    await this.redis.del(key);
    this.logger.debug(`Session ${sessionId} destroyed`);
  }

  /** Destroy all sessions for a user (scan-based) */
  async destroyAllForUser(userId: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${SESSION_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const storedUserId = await this.redis.get(key);
        if (storedUserId === userId) {
          await this.redis.del(key);
        }
      }
    } while (cursor !== '0');

    this.logger.debug(`All sessions destroyed for user ${userId}`);
  }
}
