import { PassportModule } from '@lumina-cinema/passport'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { PROTO_PATHS } from '@repo/contracts'

import { ConversationsModule } from '../conversations/conversations.module'
import { UsersClientGrpc } from '../users/users.grpc'

import { ChatRealtimeService } from './chat-realtime.service'
import { MessagesController } from './messages.controller'
import { MessagesClientGrpc } from './messages.grpc'

@Module({
	imports: [
		PassportModule.registerAsync({
			useFactory: (configService: ConfigService) => ({
				secretKey: configService.getOrThrow<string>(
					'PASSPORT_SECRET_KEY'
				)
			}),
			inject: [ConfigService]
		}),
		ClientsModule.registerAsync([
			{
				name: 'MESSAGES_PACKAGE',
				useFactory: (configService: ConfigService) => ({
					transport: Transport.GRPC,
					options: {
						package: ['messages.v1'],
						protoPath: [PROTO_PATHS.MESSAGES],
						url: configService.getOrThrow<string>(
							'MESSAGES_GRPC_URL'
						)
					}
				}),
				inject: [ConfigService]
			},
			{
				name: 'USERS_PACKAGE',
				useFactory: (configService: ConfigService) => ({
					transport: Transport.GRPC,
					options: {
						package: ['users.v1'],
						protoPath: [PROTO_PATHS.USERS],
						url: configService.getOrThrow<string>('USERS_GRPC_URL')
					}
				}),
				inject: [ConfigService]
			}
		]),
		ConversationsModule
	],
	controllers: [MessagesController],
	providers: [MessagesClientGrpc, UsersClientGrpc, ChatRealtimeService],
	exports: [ChatRealtimeService]
})
export class MessagesModule {}
