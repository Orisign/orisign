import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { RmqModule } from './infra/rmq/rmq.module'
import { SmsModule } from './infra/sms/sms.module'
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true
		}),
		RmqModule,
		SmsModule,
		NotificationsModule
	]
})
export class AppModule {}
