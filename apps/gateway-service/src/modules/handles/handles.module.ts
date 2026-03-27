import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { GRPC_LOADER_OPTIONS } from 'src/shared/grpc-loader.options';
import { HandlesController } from './handles.controller';
import { HandlesClientGrpc } from './handles.grpc';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'HANDLES_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['handles.v1'],
            protoPath: [PROTO_PATHS.HANDLES],
            url: configService.getOrThrow<string>('HANDLES_GRPC_URL'),
            loader: GRPC_LOADER_OPTIONS,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [HandlesController],
  providers: [HandlesClientGrpc],
  exports: [HandlesClientGrpc],
})
export class HandlesModule {}
