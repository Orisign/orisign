import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';

import { MediaClientGrpc } from './media.grpc';
import { UsersController } from './users.controller';
import { UsersClientGrpc } from './users.grpc';

const ONE_GB_IN_BYTES = 1024 * 1024 * 1024;

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    ClientsModule.registerAsync([
      {
        name: 'USERS_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['users.v1'],
            protoPath: [PROTO_PATHS.USERS],
            url: configService.getOrThrow<string>('USERS_GRPC_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'MEDIA_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['media.v1'],
            protoPath: [PROTO_PATHS.MEDIA],
            url: configService.getOrThrow<string>('MEDIA_GRPC_URL'),
            maxReceiveMessageLength: ONE_GB_IN_BYTES,
            maxSendMessageLength: ONE_GB_IN_BYTES,
            channelOptions: {
              'grpc.max_receive_message_length': ONE_GB_IN_BYTES,
              'grpc.max_send_message_length': ONE_GB_IN_BYTES,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersClientGrpc, MediaClientGrpc],
})
export class UsersModule {}
