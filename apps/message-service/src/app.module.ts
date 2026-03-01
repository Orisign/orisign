import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConversationsClientModule } from './infra/grpc/conversations-client.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { MessagesModule } from './modules/messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ConversationsClientModule,
    MessagesModule,
  ],
})
export class AppModule {}
