import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, Reflector } from '@nestjs/core'
import { AccountModule } from 'src/modules/account/account.module'
import { AuthModule } from 'src/modules/auth/auth.module'
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler"
import { UsersModule } from 'src/modules/users/users.module'

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		ThrottlerModule.forRoot({
			throttlers: [
				{
					ttl: 60000,
					limit: 5
				}
			]
		}),
		AccountModule,
		AuthModule,
		UsersModule
	],
	providers: [
		Reflector,
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard
		}
	]
})
export class AppModule {}
