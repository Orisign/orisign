import { PassportModule } from '@lumina-cinema/passport'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { PROTO_PATHS } from '@repo/contracts'
import { GRPC_LOADER_OPTIONS } from 'src/shared/grpc-loader.options'

import { BotsModule } from '../bots/bots.module'
import { ConversationsModule } from '../conversations/conversations.module'
import { UsersClientGrpc } from '../users/users.grpc'

import { ChatRealtimeService } from './chat-realtime.service'
import { MessagesController } from './messages.controller'
import { MessagesInternalController } from './messages-internal.controller'
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
						),
						loader: GRPC_LOADER_OPTIONS
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
						url: configService.getOrThrow<string>('USERS_GRPC_URL'),
						loader: GRPC_LOADER_OPTIONS
					}
				}),
				inject: [ConfigService]
			}
		]),
		BotsModule,
		ConversationsModule
	],
	controllers: [MessagesController, MessagesInternalController],
	providers: [MessagesClientGrpc, UsersClientGrpc, ChatRealtimeService],
	exports: [ChatRealtimeService]
})
export class MessagesModule {}
