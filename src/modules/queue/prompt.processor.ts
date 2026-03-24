import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PROMPT_QUEUE } from './prompt.producer';
import { RedisService } from 'src/infrastructure/redis/redis.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

interface PromptJobData {
  promptId: string;
  userId: string;
  subscriptionStatus: string;
}

@Processor(PROMPT_QUEUE)
export class PromptProcessor extends WorkerHost {
  private readonly logger = new Logger(PromptProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<PromptJobData>): Promise<void> {
    const { promptId, userId, subscriptionStatus } = job.data;
    this.logger.log(`Processing prompt ${promptId} for user ${userId}`);

    // 1. Fetch the prompt and validate it's eligible for processing
    const prompt = await this.prisma.prompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      this.logger.warn(`Prompt ${promptId} not found, skipping job`);
      return;
    }

    if (prompt.status === 'COMPLETED') {
      this.logger.warn(`Prompt ${promptId} already completed, skipping`);
      return;
    }

    // 2. Set status to PROCESSING
    await this.prisma.prompt.update({
      where: { id: promptId },
      data: { status: 'PROCESSING' },
    });

    try {
      // 3. Simulate generation delay: PAID = 2s, FREE = 5s
      const delay = subscriptionStatus === 'PAID' ? 2000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // 4. Create audio + mark COMPLETED in a transaction
      const title = `Generated: ${prompt.text.substring(0, 80)}${prompt.text.length > 80 ? '...' : ''}`;

      const audio = await this.prisma.$transaction(async (tx) => {
        // Guard against duplicate audio (idempotency)
        const existing = await tx.audio.findUnique({
          where: { prompt_id: promptId },
        });
        if (existing) {
          await tx.prompt.update({
            where: { id: promptId },
            data: { status: 'COMPLETED' },
          });
          return existing;
        }

        const created = await tx.audio.create({
          data: {
            prompt_id: promptId,
            user_id: userId,
            title,
            url: `https://cdn.musicgpt.ai/audio/${promptId}.mp3`,
          },
        });

        await tx.prompt.update({
          where: { id: promptId },
          data: { status: 'COMPLETED' },
        });

        return created;
      });

      // 5. Invalidate caches (non-critical, outside transaction)
      await this.invalidateCaches(userId);

      // 6. Publish WebSocket notification via Redis pub/sub
      await this.redis.publish(
        'ws:notifications',
        JSON.stringify({
          event: 'prompt:completed',
          userId,
          data: {
            promptId,
            audioId: audio.id,
            title: audio.title,
            url: audio.url,
          },
        }),
      );

      this.logger.log(
        `Completed prompt ${promptId}, created audio ${audio.id}`,
      );
    } catch (error) {
      // Rollback status to PENDING so the job can be retried
      await this.prisma.prompt
        .update({
          where: { id: promptId },
          data: { status: 'PENDING' },
        })
        .catch((rollbackErr) =>
          this.logger.error(
            `Failed to rollback prompt ${promptId}: ${rollbackErr instanceof Error ? rollbackErr.message : 'Unknown'}`,
          ),
        );

      this.logger.error(
        `Failed to process prompt ${promptId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private async invalidateCaches(userId: string): Promise<void> {
    const audioListKeys = await this.redis.keys('cache:audio:list:*');
    if (audioListKeys.length > 0) {
      await this.redis.del(...audioListKeys);
    }
    const promptCacheKeys = await this.redis.keys(`cache:prompts:${userId}:*`);
    if (promptCacheKeys.length > 0) {
      await this.redis.del(...promptCacheKeys);
    }
  }
}
