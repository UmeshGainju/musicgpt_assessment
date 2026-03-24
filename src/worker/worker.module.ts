import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { validate } from '../env.validation';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { QueueModule } from 'src/modules/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>(
            'REDIS_URL',
            'redis://localhost:6379',
          ),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
  ],
})
export class WorkerModule {}
