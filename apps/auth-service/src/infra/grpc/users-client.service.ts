import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  CreateUserRequest,
  UsersServiceClient,
} from '@repo/contracts/gen/ts/users';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class UsersClientService implements OnModuleInit {
  private usersClient!: UsersServiceClient;

  public constructor(
    @Inject('USERS_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  public onModuleInit() {
    this.usersClient = this.client.getService<UsersServiceClient>('UsersService');
  }

  public async createUser(request: CreateUserRequest) {
    return await lastValueFrom(this.usersClient.createUser(request));
  }
}
