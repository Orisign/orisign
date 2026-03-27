import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { UpdateWaitersService } from './update-waiters.service';

@Global()
@Module({
  providers: [RedisService, UpdateWaitersService],
  exports: [RedisService, UpdateWaitersService],
})
export class RedisModule {}
