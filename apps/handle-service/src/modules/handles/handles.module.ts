import { Module } from '@nestjs/common';
import { HandlesController } from './handles.controller';
import { HandlesRepository } from './handles.repository';
import { HandlesService } from './handles.service';

@Module({
  controllers: [HandlesController],
  providers: [HandlesService, HandlesRepository],
  exports: [HandlesService],
})
export class HandlesModule {}
