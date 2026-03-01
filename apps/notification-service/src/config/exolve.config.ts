import { ConfigService } from '@nestjs/config'
import { SmsOptions } from 'src/infra/sms/types'

export function getExolveConfig(configService: ConfigService): SmsOptions {
	return {
		apiKey: configService.getOrThrow<string>('EXOLVE_API_KEY'),
		sender: configService.getOrThrow<string>('EXOLVE_SENDER')
	}
}
