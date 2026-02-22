import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  const url = `${config.getOrThrow<string>('GRPC_HOST')}:${config.getOrThrow<string>('GRPC_PORT')}`;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'call.v1',
      protoPath: PROTO_PATHS.CALL,
      url,
      loader: {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  app.startAllMicroservices();
  app.init();
}
bootstrap();
