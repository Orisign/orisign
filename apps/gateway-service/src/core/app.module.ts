import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, Reflector } from '@nestjs/core'
import { AccountModule } from 'src/modules/account/account.module'
import { AuthModule } from 'src/modules/auth/auth.module'
import { ConversationsModule } from 'src/modules/conversations/conversations.module'
import { MessagesModule } from 'src/modules/messages/messages.module'
import { ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler"
import { UsersModule } from 'src/modules/users/users.module'

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		ThrottlerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const nodeEnv = configService.get<string>('NODE_ENV')
				const defaultLimit = nodeEnv === 'development' ? 1000 : 60
				const defaultTtl = 60000

				const limit = Number(configService.get<string>('THROTTLE_LIMIT') ?? defaultLimit)
				const ttl = Number(configService.get<string>('THROTTLE_TTL_MS') ?? defaultTtl)

				return {
					throttlers: [
						{
							ttl: Number.isFinite(ttl) ? ttl : defaultTtl,
							limit: Number.isFinite(limit) ? limit : defaultLimit
						}
					]
				}
			}
		}),
		AccountModule,
		AuthModule,
		ConversationsModule,
		MessagesModule,
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
