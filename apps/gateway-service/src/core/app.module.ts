import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, Reflector } from '@nestjs/core'
import { AuthModule } from 'src/modules/auth/auth.module'
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler"

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
		AuthModule
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
