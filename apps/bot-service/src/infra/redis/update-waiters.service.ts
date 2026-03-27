import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

const STREAM_MAX_LENGTH = 256;

@Injectable()
export class UpdateWaitersService {
  private readonly logger = new Logger(UpdateWaitersService.name);

  public constructor(private readonly redisService: RedisService) {}

  /**
   * Wakes up long-polling consumers for a specific bot. We use Redis Streams
   * instead of pub/sub so a waiter can block on a durable stream key without
   * losing the notification during short reconnect windows.
   */
  public async notify(botId: string, updateId: number): Promise<void> {
    try {
      await this.redisService.xadd(
        this.streamKey(botId),
        'MAXLEN',
        '~',
        STREAM_MAX_LENGTH,
        '*',
        'updateId',
        `${updateId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Unable to notify polling waiters for bot ${botId}: ${
          error instanceof Error ? error.message : 'unknown redis error'
        }`,
      );
    }
  }

  /**
   * Blocks until a new update is available or the polling timeout elapses.
   */
  public async waitForUpdate(botId: string, timeoutMs: number): Promise<boolean> {
    if (timeoutMs <= 0) {
      return false;
    }

    try {
      const result = await this.redisService.xread(
        'BLOCK',
        timeoutMs,
        'STREAMS',
        this.streamKey(botId),
        '$',
      );
      return Array.isArray(result) && result.length > 0;
    } catch (error) {
      this.logger.warn(
        `Unable to wait for polling update on bot ${botId}: ${
          error instanceof Error ? error.message : 'unknown redis error'
        }`,
      );
      return false;
    }
  }

  private streamKey(botId: string) {
    return `bot:updates:wakeup:${botId}`;
  }
}
