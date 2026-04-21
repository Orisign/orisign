import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { ConversationsClientService } from './conversations-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'CONVERSATIONS_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['conversations.v1'],
            protoPath: [PROTO_PATHS.CONVERSATIONS],
            url: configService.getOrThrow<string>('CONVERSATIONS_GRPC_URL'),
            loader: {
              keepCase: false,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [ConversationsClientService],
  exports: [ConversationsClientService],
})
export class ConversationsClientModule {}
