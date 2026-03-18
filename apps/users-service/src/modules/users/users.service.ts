import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  ChatFolderResponse,
  ClearSearchHistoryRequest,
  CreateUserRequest,
  CreateChatFolderRequest,
  DeleteSearchHistoryEntryRequest,
  DeleteChatFolderRequest,
  CreateUserResponse,
  GetUserRequest,
  GetUserResponse,
  ListChatFoldersRequest,
  ListChatFoldersResponse,
  ListSearchHistoryRequest,
  ListSearchHistoryResponse,
  ListUsersRequest,
  ListUsersResponse,
  PatchLastSeenAtRequest,
  PatchPrivacySettingsRequest,
  PatchResponse,
  PatchUserRequest,
  ReorderChatFoldersRequest,
  SearchHistoryResponse,
  UpsertSearchHistoryRequest,
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

  public async listSearchHistory(
    data: ListSearchHistoryRequest,
  ): Promise<ListSearchHistoryResponse> {
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

    return await this.usersRepository.listSearchHistory({
      userId,
      limit: data.limit,
    });
  }

  public async upsertSearchHistory(
    data: UpsertSearchHistoryRequest,
  ): Promise<SearchHistoryResponse> {
    const userId = data.userId?.trim();
    const query = data.query?.trim();

    if (!userId || !query) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id and query are required',
      });
    }

    const user = await this.usersRepository.getById(userId);
    if (!user) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'User not found',
      });
    }

    return await this.usersRepository.upsertSearchHistory({
      userId,
      query,
    });
  }

  public async deleteSearchHistoryEntry(
    data: DeleteSearchHistoryEntryRequest,
  ): Promise<PatchResponse> {
    const userId = data.userId?.trim();
    const entryId = data.entryId?.trim();

    if (!userId || !entryId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id and entry id are required',
      });
    }

    const user = await this.usersRepository.getById(userId);
    if (!user) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'User not found',
      });
    }

    await this.usersRepository.deleteSearchHistoryEntry({
      userId,
      entryId,
    });

    return { ok: true };
  }

  public async clearSearchHistory(
    data: ClearSearchHistoryRequest,
  ): Promise<PatchResponse> {
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

    await this.usersRepository.clearSearchHistory({ userId });

    return { ok: true };
  }

  public async patchLastSeenAt(
    data: PatchLastSeenAtRequest,
  ): Promise<PatchResponse> {
    const userId = data.userId?.trim();

    if (!userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id is required',
      });
    }

    await this.usersRepository.patchLastSeenAt({
      userId,
      lastSeenAt: data.lastSeenAt,
    });

    return { ok: true };
  }
}
