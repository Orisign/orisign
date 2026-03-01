import { Injectable, Logger } from '@nestjs/common'
import { RmqContext } from '@nestjs/microservices'
import type { Channel, ConsumeMessage } from 'amqplib'

@Injectable()
export class RmqService {
	private readonly SERVICE_NAME: string

	private readonly logger = new Logger(RmqService.name)

	public constructor() {
		this.SERVICE_NAME = 'notification'
	}

	public ack(context: RmqContext, event: string): void {
		const channel = context.getChannelRef() as Channel
		const msg = context.getMessage() as ConsumeMessage
		const tag = msg.fields.deliveryTag

		if (!tag) return

		channel.ack(msg)

		this.logger.debug(`ACK (pattern: ${context.getPattern()}, tag: ${tag})`)
	}

	public nack(context: RmqContext, event: string, requeue = false): void {
		const channel = context.getChannelRef() as Channel
		const msg = context.getMessage() as ConsumeMessage
		const tag = msg.fields.deliveryTag

		if (!tag) return

		channel.nack(msg, false, requeue)

		if (requeue) {
			this.logger.warn(
				`NACK response (pattern: ${context.getPattern()}, tag: ${tag})`
			)
		} else {
			this.logger.error(
				`NACK drop (pattern: ${context.getPattern()}, tag: ${tag})`
			)
		}
	}
}
