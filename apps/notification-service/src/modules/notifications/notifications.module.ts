import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getExolveConfig } from 'src/config/exolve.config'
import { SmsModule } from 'src/infra/sms/sms.module'

import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'

@Module({
	imports: [
		SmsModule.registerAsync({
			useFactory: getExolveConfig,
			inject: [ConfigService]
		})
	],
	controllers: [NotificationsController],
	providers: [NotificationsService]
})
export class NotificationsModule {}
