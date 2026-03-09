import { PassportModule } from '@lumina-cinema/passport';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { ConversationsController } from './conversations.controller';
import { ConversationsClientGrpc } from './conversations.grpc';
import { MediaClientGrpc } from './media.grpc';

@Module({
  imports: [
    PassportModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secretKey: configService.getOrThrow<string>('PASSPORT_SECRET_KEY'),
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
      {
        name: 'CONVERSATIONS_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['conversations.v1'],
            protoPath: [PROTO_PATHS.CONVERSATIONS],
            url: configService.getOrThrow<string>('CONVERSATIONS_GRPC_URL'),
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
  controllers: [ConversationsController],
  providers: [ConversationsClientGrpc, MediaClientGrpc],
  exports: [ConversationsClientGrpc],
})
export class ConversationsModule {}
