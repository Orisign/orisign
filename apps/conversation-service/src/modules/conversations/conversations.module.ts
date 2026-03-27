import { Module } from '@nestjs/common';
import { HandlesClientModule } from '@/infra/grpc/handles-client.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [HandlesClientModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsRepository],
})
export class ConversationsModule {}
