import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  CreateUserRequest,
  CreateUserResponse,
  GetUserRequest,
  GetUserResponse,
  PatchPrivacySettingsRequest,
  PatchResponse,
  PatchUserRequest,
} from '@repo/contracts/gen/ts/users';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod('UsersService', 'GetUser')
  public async getUser(data: GetUserRequest): Promise<GetUserResponse> {
    return await this.usersService.getUser(data);
  }

  @GrpcMethod('UsersService', 'CreateUser')
  public async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    return await this.usersService.createUser(data);
  }

  @GrpcMethod('UsersService', 'PatchUser')
  public async patchUser(data: PatchUserRequest): Promise<PatchResponse> {
    return await this.usersService.patchUser(data);
  }

  @GrpcMethod('UsersService', 'PatchPrivacySettings')
  public async patchPrivacySettings(
    data: PatchPrivacySettingsRequest,
  ): Promise<PatchResponse> {
    return await this.usersService.patchPrivacySettings(data);
  }
}
