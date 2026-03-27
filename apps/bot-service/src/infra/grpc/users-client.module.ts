import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { GRPC_LOADER_OPTIONS } from '@/shared/grpc-loader.options';
import { UsersClientService } from './users-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'USERS_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: ['users.v1'],
            protoPath: [PROTO_PATHS.USERS],
            url: configService.getOrThrow<string>('USERS_GRPC_URL'),
            loader: GRPC_LOADER_OPTIONS,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [UsersClientService],
  exports: [UsersClientService],
})
export class UsersClientModule {}
