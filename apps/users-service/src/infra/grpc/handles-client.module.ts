import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { HandlesClientService } from './handles-client.service';

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
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [HandlesClientService],
  exports: [HandlesClientService],
})
export class HandlesClientModule {}
