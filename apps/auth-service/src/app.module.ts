import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { PrismaModule } from './infra/prisma/prisma.module'
import { RedisModule } from './infra/redis/redis.module'
import { AuthModule } from './modules/auth/auth.module'
import { OtpModule } from './modules/otp/otp.module'
import { TokenModule } from './modules/token/token.module'
import { AccountModule } from './modules/account/account.module';
import { MessagingModule } from './infra/messaging/messaging.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true
		}),
		PrismaModule,
		RedisModule,
		AuthModule,
		OtpModule,
		TokenModule,
		AccountModule,
		MessagingModule
	]
})
export class AppModule {}
