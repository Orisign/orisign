import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { PROTO_PATHS } from '@repo/contracts';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const url = `${config.getOrThrow<string>('GRPC_HOST')}:${config.getOrThrow<string>('GRPC_PORT')}`;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ['bots.v1'],
      protoPath: [PROTO_PATHS.BOTS],
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

  await app.startAllMicroservices();
  await app.init();
}

bootstrap();
