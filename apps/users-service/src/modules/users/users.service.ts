import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  ChatFolderResponse,
  CreateUserRequest,
  CreateChatFolderRequest,
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

import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  public constructor(private readonly usersRepository: UsersRepository) {}

  public async getUser(data: GetUserRequest): Promise<GetUserResponse> {
    const { id, username } = data;

    if (!id && !username) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id or username is required',
      });
    }

    return await this.usersRepository.getUser(data);
  }

  public async listUsers(data: ListUsersRequest): Promise<ListUsersResponse> {
    return await this.usersRepository.listUsers(data);
  }

  public async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    const id = data.id?.trim();

    if (!id) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id is required',
      });
    }

    const existingUser = await this.usersRepository.getById(id);
    if (existingUser) {
      return { ok: true };
    }

    await this.usersRepository.create({
      id,
      firstName: 'User',
      avatars: [],
      privacySettings: {
        create: {},
      },
    });

    return { ok: true };
  }

  public async patchUser(data: PatchUserRequest): Promise<PatchResponse> {
    const userId = data.userId;
    if (!userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id is required',
      });
    }

    const user = await this.usersRepository.getById(userId);
    if (!user) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'User not found',
      });
    }

    await this.usersRepository.patchUser(data);

    return { ok: true };
  }

  public async patchPrivacySettings(
    data: PatchPrivacySettingsRequest,
  ): Promise<PatchResponse> {
    const { userId } = data;

    if (!userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id is required',
      });
    }

    const user = await this.usersRepository.getById(userId);
    if (!user) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'User not found',
      });
    }

    await this.usersRepository.patchPrivacySettings(data);

    return { ok: true };
  }

  public async listChatFolders(
    data: ListChatFoldersRequest,
  ): Promise<ListChatFoldersResponse> {
    const userId = data.userId?.trim();
    if (!userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id is required',
      });
    }

    const user = await this.usersRepository.getById(userId);
    if (!user) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'User not found',
      });
    }

    return await this.usersRepository.listChatFolders({ userId });
  }

  public async createChatFolder(
    data: CreateChatFolderRequest,
  ): Promise<ChatFolderResponse> {
    const userId = data.userId?.trim();
    if (!userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id is required',
      });
    }

    const user = await this.usersRepository.getById(userId);
    if (!user) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'User not found',
      });
    }

    return await this.usersRepository.createChatFolder({
      ...data,
      userId,
    });
  }

  public async updateChatFolder(
    data: UpdateChatFolderRequest,
  ): Promise<ChatFolderResponse> {
    if (!data.userId?.trim() || !data.folderId?.trim()) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id and folder id are required',
      });
    }

    return await this.usersRepository.updateChatFolder({
      ...data,
      userId: data.userId.trim(),
      folderId: data.folderId.trim(),
    });
  }

  public async deleteChatFolder(
    data: DeleteChatFolderRequest,
  ): Promise<PatchResponse> {
    const userId = data.userId?.trim();
    const folderId = data.folderId?.trim();

    if (!userId || !folderId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id and folder id are required',
      });
    }

    await this.usersRepository.deleteChatFolder({ userId, folderId });

    return { ok: true };
  }

  public async reorderChatFolders(
    data: ReorderChatFoldersRequest,
  ): Promise<PatchResponse> {
    const userId = data.userId?.trim();

    if (!userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id is required',
      });
    }

    await this.usersRepository.reorderChatFolders({
      userId,
      folderIds: data.folderIds ?? [],
    });

    return { ok: true };
  }
}
