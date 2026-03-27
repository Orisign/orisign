import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { RmqModule } from './infra/rmq/rmq.module';
import { HandlesClientModule } from './infra/grpc/handles-client.module';
import { MessagesClientModule } from './infra/grpc/messages-client.module';
import { UsersClientModule } from './infra/grpc/users-client.module';
import { ConversationsClientModule } from './infra/grpc/conversations-client.module';
import { BotsModule } from './modules/bots/bots.module';
import { DeliveryModule } from './modules/delivery/delivery.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    RmqModule,
    HandlesClientModule,
    MessagesClientModule,
    UsersClientModule,
    ConversationsClientModule,
    BotsModule,
    DeliveryModule,
  ],
})
export class AppModule {}
