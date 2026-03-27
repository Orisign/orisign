import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DispatcherWorkerService } from './modules/delivery/dispatcher-worker.service';
import { WebhookDeliveryWorkerService } from './modules/delivery/webhook-delivery-worker.service';

export async function bootstrap(kind: 'dispatcher' | 'delivery') {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger(`bot-service:${kind}`);
  if (kind === 'dispatcher') {
    await app.get(DispatcherWorkerService).start();
  } else {
    await app.get(WebhookDeliveryWorkerService).start();
  }
  logger.log(`${kind} worker bootstrapped`);
  return app;
}
