import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from 'src/infrastructure/redis/redis.service';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private subscriber!: Redis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  afterInit(): void {
    // Create a separate Redis connection for subscribing
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.subscriber = new Redis(redisUrl);

    this.subscriber.subscribe('ws:notifications', (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to ws:notifications', err);
        return;
      }
      this.logger.log('Subscribed to ws:notifications channel');
    });

    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const payload = JSON.parse(message);
        const { event, userId, data } = payload;

        // Emit to the specific user's room
        this.server.to(`user:${userId}`).emit(event, data);
        this.logger.debug(`Emitted ${event} to user:${userId}`);
      } catch (error) {
        this.logger.error('Failed to parse ws notification', error);
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      // Store userId on the socket for later reference
      (client as any).userId = userId;

      // Join user-specific room
      await client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} connected as user ${userId}`);
    } catch {
      this.logger.warn(`Client ${client.id} failed authentication`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = (client as any).userId;
    this.logger.log(
      `Client ${client.id} disconnected${userId ? ` (user ${userId})` : ''}`,
    );
  }
}
