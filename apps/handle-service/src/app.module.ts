import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/prisma/prisma.module';
import { HandlesModule } from './modules/handles/handles.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, HandlesModule],
})
export class AppModule {}
