import { Module } from '@nestjs/common';
import { HandlesClientModule } from '@/infra/grpc/handles-client.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';

@Module({
  imports: [HandlesClientModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
