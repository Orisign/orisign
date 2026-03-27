import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type ChannelWrapper, type AmqpConnectionManager } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage, Options } from 'amqplib';
import {
  BOT_PLATFORM_EXCHANGE,
  DISPATCH_QUEUE,
  DISPATCH_ROUTING_KEY,
  WEBHOOK_DELIVERY_QUEUE,
  WEBHOOK_DLQ_QUEUE,
  WEBHOOK_DLQ_ROUTING_KEY,
  WEBHOOK_RETRY_120S_QUEUE,
  WEBHOOK_RETRY_120S_ROUTING_KEY,
  WEBHOOK_RETRY_30S_QUEUE,
  WEBHOOK_RETRY_30S_ROUTING_KEY,
  WEBHOOK_RETRY_5S_QUEUE,
  WEBHOOK_RETRY_5S_ROUTING_KEY,
  WEBHOOK_RETRY_600S_QUEUE,
  WEBHOOK_RETRY_600S_ROUTING_KEY,
  WEBHOOK_ROUTING_KEY,
} from './rmq.constants';

type MessageHandler<TPayload> = (
  payload: TPayload,
  rawMessage: ConsumeMessage,
  channel: Channel,
) => Promise<void>;

@Injectable()
export class RmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RmqService.name);
  private connection: AmqpConnectionManager | null = null;
  private publisher: ChannelWrapper | null = null;

  public constructor(private readonly configService: ConfigService) {}

  public onModuleInit() {
    if (!this.isConfigured()) {
      this.logger.warn('RMQ_URL is not configured. Falling back to inline processing.');
      return;
    }

    const url = this.configService.getOrThrow<string>('RMQ_URL');
    this.connection = amqp.connect([url]);
    this.publisher = this.connection.createChannel({
      name: 'bot-platform:publisher',
      setup: async (channel) => {
        await this.setupTopology(channel);
      },
    });

    this.connection.on('connect', () => {
      this.logger.log('RabbitMQ connection established');
    });
    this.connection.on('disconnect', (params) => {
      this.logger.warn(`RabbitMQ disconnected: ${params.err?.message ?? 'unknown error'}`);
    });
  }

  public async onModuleDestroy() {
    if (this.publisher) {
      await this.publisher.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  public isConfigured() {
    return Boolean(this.configService.get<string>('RMQ_URL'));
  }

  /**
   * Publishes a durable JSON payload into the bot platform exchange.
   */
  public async publishJson<TPayload>(
    routingKey: string,
    payload: TPayload,
    options?: Options.Publish,
  ) {
    if (!this.publisher) {
      throw new Error('RabbitMQ is not configured');
    }

    await this.publisher.publish(
      BOT_PLATFORM_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        contentType: 'application/json',
        persistent: true,
        ...options,
      },
    );
  }

  /**
   * Creates a JSON consumer with the shared bot-platform topology already declared.
   * Each worker owns its own channel so prefetch and consumer tags stay isolated.
   */
  public async consumeJson<TPayload>(
    queue: string,
    consumerTag: string,
    handler: MessageHandler<TPayload>,
    prefetch = 1,
  ) {
    if (!this.connection) {
      throw new Error('RabbitMQ is not configured');
    }

    const channelWrapper = this.connection.createChannel({
      name: consumerTag,
      setup: async (channel) => {
        await this.setupTopology(channel);
        await channel.prefetch(prefetch);
        await channel.consume(queue, async (message) => {
          if (!message) {
            return;
          }

          try {
            const payload = JSON.parse(message.content.toString('utf8')) as TPayload;
            await handler(payload, message, channel);
          } catch (error) {
            this.logger.error(
              `Unhandled consumer error for ${queue}: ${
                error instanceof Error ? error.message : 'unknown error'
              }`,
            );
            channel.nack(message, false, false);
          }
        });
      },
    });

    return channelWrapper;
  }

  private async setupTopology(channel: Channel) {
    // One direct exchange keeps routing explicit:
    // dispatcher jobs, primary webhook jobs, retry tiers and the DLQ are all bound here.
    await channel.assertExchange(BOT_PLATFORM_EXCHANGE, 'direct', { durable: true });

    await channel.assertQueue(DISPATCH_QUEUE, { durable: true });
    await channel.bindQueue(DISPATCH_QUEUE, BOT_PLATFORM_EXCHANGE, DISPATCH_ROUTING_KEY);

    await channel.assertQueue(WEBHOOK_DELIVERY_QUEUE, { durable: true });
    await channel.bindQueue(WEBHOOK_DELIVERY_QUEUE, BOT_PLATFORM_EXCHANGE, WEBHOOK_ROUTING_KEY);

    await this.assertRetryQueue(channel, WEBHOOK_RETRY_5S_QUEUE, WEBHOOK_RETRY_5S_ROUTING_KEY, 5_000);
    await this.assertRetryQueue(channel, WEBHOOK_RETRY_30S_QUEUE, WEBHOOK_RETRY_30S_ROUTING_KEY, 30_000);
    await this.assertRetryQueue(channel, WEBHOOK_RETRY_120S_QUEUE, WEBHOOK_RETRY_120S_ROUTING_KEY, 120_000);
    await this.assertRetryQueue(channel, WEBHOOK_RETRY_600S_QUEUE, WEBHOOK_RETRY_600S_ROUTING_KEY, 600_000);

    await channel.assertQueue(WEBHOOK_DLQ_QUEUE, { durable: true });
    await channel.bindQueue(WEBHOOK_DLQ_QUEUE, BOT_PLATFORM_EXCHANGE, WEBHOOK_DLQ_ROUTING_KEY);
  }

  private async assertRetryQueue(
    channel: Channel,
    queue: string,
    routingKey: string,
    delayMs: number,
  ) {
    // Retry queues implement delayed redelivery without a separate scheduler.
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-message-ttl': delayMs,
        'x-dead-letter-exchange': BOT_PLATFORM_EXCHANGE,
        'x-dead-letter-routing-key': WEBHOOK_ROUTING_KEY,
      },
    });
    await channel.bindQueue(queue, BOT_PLATFORM_EXCHANGE, routingKey);
  }
}
