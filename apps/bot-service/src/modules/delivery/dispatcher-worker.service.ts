import { Injectable, Logger } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { BotsService } from '../bots/bots.service';
import { RmqService } from '@/infra/rmq/rmq.service';
import { DISPATCH_QUEUE } from '@/infra/rmq/rmq.constants';
import type { ExternalEventJob } from './delivery.types';

@Injectable()
export class DispatcherWorkerService {
  private readonly logger = new Logger(DispatcherWorkerService.name);
  private consumer: ChannelWrapper | null = null;

  public constructor(
    private readonly rmqService: RmqService,
    private readonly botsService: BotsService,
  ) {}

  public async start() {
    if (!this.rmqService.isConfigured()) {
      this.logger.warn('RabbitMQ is disabled. Dispatcher worker will stay idle.');
      return;
    }

    // This worker is the ingress lane for external messenger events.
    // It normalizes them into bot update envelopes and schedules further delivery.
    this.consumer = await this.rmqService.consumeJson<ExternalEventJob>(
      DISPATCH_QUEUE,
      'bot-platform:dispatcher',
      async (payload, message, channel) => {
        await this.process(payload, message, channel);
      },
    );
    this.logger.log('Dispatcher worker is consuming external bot events');
  }

  private async process(payload: ExternalEventJob, message: ConsumeMessage, channel: Channel) {
    try {
      await this.botsService.processExternalEvent(payload);
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Failed to process external event ${payload.eventName}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      channel.nack(message, false, false);
    }
  }
}
