import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  CreateUserRequest,
  GetUserRequest,
  PatchPrivacySettingsRequest,
  PatchUserRequest,
  UsersServiceClient,
} from '@repo/contracts/gen/ts/users';

@Injectable()
export class UsersClientGrpc implements OnModuleInit {
  private usersClient!: UsersServiceClient;

  public constructor(
    @Inject('USERS_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  public onModuleInit() {
    this.usersClient =
      this.client.getService<UsersServiceClient>('UsersService');
  }

  public getUser(request: GetUserRequest) {
    return this.usersClient.getUser(request);
  }

  public createUser(request: CreateUserRequest) {
    return this.usersClient.createUser(request);
  }

  public patchUser(request: PatchUserRequest) {
    return this.usersClient.patchUser(request);
  }

  public patchPrivacySettings(request: PatchPrivacySettingsRequest) {
    return this.usersClient.patchPrivacySettings(request);
  }
}
