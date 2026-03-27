import { Injectable, Logger } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import {
  WEBHOOK_DELIVERY_QUEUE,
  WEBHOOK_DLQ_ROUTING_KEY,
  WEBHOOK_RETRY_SCHEDULE,
} from '@/infra/rmq/rmq.constants';
import { RmqService } from '@/infra/rmq/rmq.service';
import { BotsService } from '../bots/bots.service';
import type { WebhookDeliveryJob } from './delivery.types';

@Injectable()
export class WebhookDeliveryWorkerService {
  private readonly logger = new Logger(WebhookDeliveryWorkerService.name);
  private consumer: ChannelWrapper | null = null;

  public constructor(
    private readonly rmqService: RmqService,
    private readonly botsService: BotsService,
  ) {}

  public async start() {
    if (!this.rmqService.isConfigured()) {
      this.logger.warn('RabbitMQ is disabled. Webhook delivery worker will stay idle.');
      return;
    }

    // This worker owns webhook delivery and retry progression.
    // Ordering remains per bot because update cursors are stored durably in PostgreSQL.
    this.consumer = await this.rmqService.consumeJson<WebhookDeliveryJob>(
      WEBHOOK_DELIVERY_QUEUE,
      'bot-platform:webhook-delivery',
      async (payload, message, channel) => {
        await this.process(payload, message, channel);
      },
    );
    this.logger.log('Webhook delivery worker is consuming delivery jobs');
  }

  private async process(payload: WebhookDeliveryJob, message: ConsumeMessage, channel: Channel) {
    const result = await this.botsService.deliverWebhookJob(payload);
    if (result.ok) {
      channel.ack(message);
      return;
    }

    const nextRetry = WEBHOOK_RETRY_SCHEDULE.find((entry) => entry.attemptNo === payload.attemptNo);
    if (nextRetry) {
      await this.rmqService.publishJson(nextRetry.routingKey, {
        ...payload,
        attemptNo: payload.attemptNo + 1,
      });
      channel.ack(message);
      return;
    }

    this.logger.warn(
      `Webhook delivery job moved to DLQ: bot=${payload.botId} update=${payload.updateId}`,
    );
    await this.rmqService.publishJson(WEBHOOK_DLQ_ROUTING_KEY, payload);
    channel.ack(message);
  }
}
