import { Module } from '@nestjs/common';
import { ConversationsClientModule } from '@/infra/grpc/conversations-client.module';
import { HandlesClientModule } from '@/infra/grpc/handles-client.module';
import { MessagesClientModule } from '@/infra/grpc/messages-client.module';
import { UsersClientModule } from '@/infra/grpc/users-client.module';
import { GatewayRealtimeService } from '@/infra/http/gateway-realtime.service';
import { BotsController } from './bots.controller';
import { BotsRepository } from './bots.repository';
import { BotsService } from './bots.service';

@Module({
  imports: [
    HandlesClientModule,
    UsersClientModule,
    MessagesClientModule,
    ConversationsClientModule,
  ],
  controllers: [BotsController],
  providers: [BotsRepository, GatewayRealtimeService, BotsService],
  exports: [BotsService],
})
export class BotsModule {}
