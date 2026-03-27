import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { GRPC_LOADER_OPTIONS } from '@/shared/grpc-loader.options';
import { MessagesClientService } from './messages-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'MESSAGES_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['messages.v1'],
            protoPath: [PROTO_PATHS.MESSAGES],
            url: configService.getOrThrow<string>('MESSAGES_GRPC_URL'),
            loader: GRPC_LOADER_OPTIONS,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [MessagesClientService],
  exports: [MessagesClientService],
})
export class MessagesClientModule {}
