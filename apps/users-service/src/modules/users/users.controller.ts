import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  ChatFolderResponse,
  CreateChatFolderRequest,
  CreateUserRequest,
  DeleteChatFolderRequest,
  CreateUserResponse,
  GetUserRequest,
  GetUserResponse,
  ListChatFoldersRequest,
  ListChatFoldersResponse,
  ListUsersRequest,
  ListUsersResponse,
  PatchPrivacySettingsRequest,
  PatchResponse,
  PatchUserRequest,
  ReorderChatFoldersRequest,
  UpdateChatFolderRequest,
} from '@repo/contracts/gen/ts/users';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod('UsersService', 'GetUser')
  public async getUser(data: GetUserRequest): Promise<GetUserResponse> {
    return await this.usersService.getUser(data);
  }

  @GrpcMethod('UsersService', 'ListUsers')
  public async listUsers(data: ListUsersRequest): Promise<ListUsersResponse> {
    return await this.usersService.listUsers(data);
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

  @GrpcMethod('UsersService', 'ListChatFolders')
  public async listChatFolders(
    data: ListChatFoldersRequest,
  ): Promise<ListChatFoldersResponse> {
    return await this.usersService.listChatFolders(data);
  }

  @GrpcMethod('UsersService', 'CreateChatFolder')
  public async createChatFolder(
    data: CreateChatFolderRequest,
  ): Promise<ChatFolderResponse> {
    return await this.usersService.createChatFolder(data);
  }

  @GrpcMethod('UsersService', 'UpdateChatFolder')
  public async updateChatFolder(
    data: UpdateChatFolderRequest,
  ): Promise<ChatFolderResponse> {
    return await this.usersService.updateChatFolder(data);
  }

  @GrpcMethod('UsersService', 'DeleteChatFolder')
  public async deleteChatFolder(
    data: DeleteChatFolderRequest,
  ): Promise<PatchResponse> {
    return await this.usersService.deleteChatFolder(data);
  }

  @GrpcMethod('UsersService', 'ReorderChatFolders')
  public async reorderChatFolders(
    data: ReorderChatFoldersRequest,
  ): Promise<PatchResponse> {
    return await this.usersService.reorderChatFolders(data);
  }
}
