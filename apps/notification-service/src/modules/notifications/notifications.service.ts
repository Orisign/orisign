import { Injectable } from '@nestjs/common'
import { OtpRequestedEvent } from '@repo/contracts'
import { SmsService } from 'src/infra/sms/sms.service'

@Injectable()
export class NotificationsService {
	public constructor(private readonly smsService: SmsService) {}

	public async sendOtp(data: OtpRequestedEvent) {
		const { identifier, code, type } = data

		if (type === 'phone') await this.smsService.sendOtp(identifier, code)
	}
}
