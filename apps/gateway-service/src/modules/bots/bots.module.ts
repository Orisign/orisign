import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { GRPC_LOADER_OPTIONS } from 'src/shared/grpc-loader.options';
import { BotsController } from './bots.controller';
import { BotsClientGrpc } from './bots.grpc';
import { MediaClientGrpc } from './media.grpc';

const ONE_GB_IN_BYTES = 1024 * 1024 * 1024;

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'BOTS_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['bots.v1'],
            protoPath: [PROTO_PATHS.BOTS],
            url: configService.getOrThrow<string>('BOTS_GRPC_URL'),
            loader: GRPC_LOADER_OPTIONS,
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
            loader: GRPC_LOADER_OPTIONS,
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
  controllers: [BotsController],
  providers: [BotsClientGrpc, MediaClientGrpc],
  exports: [BotsClientGrpc],
})
export class BotsModule {}
