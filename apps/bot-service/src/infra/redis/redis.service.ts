import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  public constructor(configService: ConfigService) {
    super({
      username: configService.get<string>('REDIS_USER') || undefined,
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      host: configService.getOrThrow<string>('REDIS_HOST'),
      port: configService.getOrThrow<number>('REDIS_PORT'),
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  public async onModuleInit() {
    const startedAt = Date.now();
    this.logger.log('Connecting to Redis...');
    await this.connect();
    this.logger.log(`Redis connection established (time=${Date.now() - startedAt}ms)`);
  }

  public async onModuleDestroy() {
    await this.quit();
  }
}
