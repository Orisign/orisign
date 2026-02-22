import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CallModule } from './modules/call/call.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CallModule],
})
export class AppModule {}
