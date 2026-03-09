import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { ConversationsModule } from '../conversations/conversations.module';

import { MediaClientGrpc } from './media.grpc';
import { UsersController } from './users.controller';
import { UsersClientGrpc } from './users.grpc';

@Module({
  imports: [
    ConversationsModule,
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
