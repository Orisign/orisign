import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/prisma/prisma.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ConversationsModule],
})
export class AppModule {}
