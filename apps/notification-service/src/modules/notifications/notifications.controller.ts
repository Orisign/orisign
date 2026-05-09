import { Controller, Logger } from '@nestjs/common'
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices'
import { OtpRequestedEvent } from '@repo/contracts'
import { RmqService } from 'src/infra/rmq/rmq.service'

import { NotificationsService } from './notifications.service'

@Controller()
export class NotificationsController {
	private readonly logger = new Logger(NotificationsController.name)

	constructor(
		private readonly notificationsService: NotificationsService,
		private readonly rmqService: RmqService
	) {}

	@EventPattern('auth.otp.requested')
	public async otpRequested(
		@Payload() data: OtpRequestedEvent,
		@Ctx() ctx: RmqContext
	) {
		const event = 'auth.otp.requested'

		try {
			await this.notificationsService.sendOtp(data)

			this.rmqService.ack(ctx, event)
		} catch (error) {
			this.logger.error(
				`Send OTP failed (type=${data.type}): ${getErrorMessage(error)}`
			)

			this.rmqService.nack(ctx, event)

			throw error
		}
	}
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	return 'unknown error'
}
