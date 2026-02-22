import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const config = app.get(ConfigService)

  const url = `${config.getOrThrow<string>('GRPC_HOST')}:${config.getOrThrow<number>('GRPC_PORT')}`

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ['users.v1'],
    }
  })
}
bootstrap();
