import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { DispatcherWorkerService } from './dispatcher-worker.service';
import { WebhookDeliveryWorkerService } from './webhook-delivery-worker.service';

@Module({
  imports: [BotsModule],
  providers: [DispatcherWorkerService, WebhookDeliveryWorkerService],
  exports: [DispatcherWorkerService, WebhookDeliveryWorkerService],
})
export class DeliveryModule {}
