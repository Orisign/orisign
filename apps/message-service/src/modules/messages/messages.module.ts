import { Module } from '@nestjs/common';
import { ConversationsClientModule } from '@/infra/grpc/conversations-client.module';
import { MessagesController } from './messages.controller';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
  imports: [ConversationsClientModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
