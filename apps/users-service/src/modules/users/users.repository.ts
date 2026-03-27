import { PrismaService } from '@/infra/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  ChatFolder,
  ChatFolderResponse,
  ClearSearchHistoryRequest,
  CreateChatFolderRequest,
  DeleteSearchHistoryEntryRequest,
  DeleteChatFolderRequest,
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
  PatchUserRequest,
  PrivacySettings,
  ReorderChatFoldersRequest,
  SearchHistoryEntry,
  SearchHistoryResponse,
  UpsertSearchHistoryRequest,
  UpdateChatFolderRequest,
  User,
} from '@repo/contracts/gen/ts/users';
import { PrivacyType } from '@repo/contracts/gen/ts/users';

const PRIVACY_KEYS: Array<keyof PrivacySettings> = [
  'phone',
  'lastSeenTime',
  'photo',
  'bio',
  'call',
  'reply',
  'invite',
  'mediaMessage',
  'message',
  'birthDate',
];

@Injectable()
export class UsersRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async getUser(data: GetUserRequest): Promise<GetUserResponse> {
    const { id, username } = data;

    if (!id && !username) {
      return { user: undefined };
    }

    const user = await this.prismaService.user.findUnique({
      where: id ? { id } : { username },
      include: { privacySettings: true } as any,
    } as any);

    if (!user) {
      return { user: undefined };
    }

    return {
      user: this.mapUserEntity(user),
    };
  }

  public async getById(id: string): Promise<User | null> {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      include: { privacySettings: true } as any,
    } as any);

    if (!user) {
      return null;
    }

    return this.mapUserEntity(user);
  }

  public async listUsers(data: ListUsersRequest): Promise<ListUsersResponse> {
    const query = data.query?.trim();
    const limit = data.limit > 0 ? Math.min(data.limit, 100) : 30;
    const offset = data.offset > 0 ? data.offset : 0;
    const excludeIds = [...new Set((data.excludeIds ?? []).filter(Boolean))];
    const includeIds = [...new Set((data.includeIds ?? []).filter(Boolean))];

    if ((data.includeIds?.length ?? 0) > 0 && includeIds.length === 0) {
      return { users: [] };
    }

    const idFilter: Record<string, string[]> = {};
    if (includeIds.length > 0) {
      idFilter.in = includeIds;
    }
    if (excludeIds.length > 0) {
      idFilter.notIn = excludeIds;
    }

    const users = await this.prismaService.user.findMany({
      where: {
        ...(Object.keys(idFilter).length > 0 ? { id: idFilter } : {}),
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      } as any,
      include: { privacySettings: true } as any,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    } as any);

    return {
      users: users.map((user) => this.mapUserEntity(user)),
    };
  }

  public async listChatFolders(
    data: ListChatFoldersRequest,
  ): Promise<ListChatFoldersResponse> {
    const userId = data.userId?.trim();
    if (!userId) {
      return { folders: [] };
    }

    const folders = await this.prismaService.chatFolder.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      folders: folders.map((folder) => this.mapChatFolderEntity(folder)),
    };
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

    const sortOrder =
      data.sortOrder >= 0
        ? Math.floor(data.sortOrder)
        : await this.getNextChatFolderSortOrder(userId);

    const folder = await this.prismaService.chatFolder.create({
      data: {
        userId,
        name: data.name?.trim() || 'New Folder',
        includedChatIds: this.normalizeStringArray(data.includedChatIds),
        excludedChatIds: this.normalizeStringArray(data.excludedChatIds),
        includedTypes: this.normalizeStringArray(data.includedTypes),
        excludedTypes: this.normalizeStringArray(data.excludedTypes),
        inviteLink: this.normalizeOptionalString(data.inviteLink),
        sortOrder,
      },
    });

    return {
      folder: this.mapChatFolderEntity(folder),
    };
  }

  public async updateChatFolder(
    data: UpdateChatFolderRequest,
  ): Promise<ChatFolderResponse> {
    const userId = data.userId?.trim();
    const folderId = data.folderId?.trim();

    if (!userId || !folderId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id and folder id are required',
      });
    }

    const existing = await this.prismaService.chatFolder.findFirst({
      where: { id: folderId, userId },
    });

    if (!existing) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Chat folder not found',
      });
    }

    const sortOrder = data.sortOrder >= 0 ? Math.floor(data.sortOrder) : existing.sortOrder;

    const folder = await this.prismaService.chatFolder.update({
      where: { id: folderId },
      data: {
        name: data.name?.trim() || existing.name,
        includedChatIds: this.normalizeStringArray(data.includedChatIds),
        excludedChatIds: this.normalizeStringArray(data.excludedChatIds),
        includedTypes: this.normalizeStringArray(data.includedTypes),
        excludedTypes: this.normalizeStringArray(data.excludedTypes),
        inviteLink: this.normalizeOptionalString(data.inviteLink),
        sortOrder,
      },
    });

    return {
      folder: this.mapChatFolderEntity(folder),
    };
  }

  public async deleteChatFolder(data: DeleteChatFolderRequest): Promise<void> {
    const userId = data.userId?.trim();
    const folderId = data.folderId?.trim();

    if (!userId || !folderId) {
      return;
    }

    const deleteResult = await this.prismaService.chatFolder.deleteMany({
      where: { id: folderId, userId },
    });

    if (deleteResult.count === 0) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Chat folder not found',
      });
    }
  }

  public async reorderChatFolders(data: ReorderChatFoldersRequest): Promise<void> {
    const userId = data.userId?.trim();
    if (!userId) {
      return;
    }

    const orderedIds = this.normalizeStringArray(data.folderIds);
    if (orderedIds.length === 0) {
      return;
    }

    const existingFolders = await this.prismaService.chatFolder.findMany({
      where: { userId },
      select: { id: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (existingFolders.length === 0) {
      return;
    }

    const existingIdSet = new Set(existingFolders.map((folder) => folder.id));
    const listedIds = orderedIds.filter((id) => existingIdSet.has(id));
    const listedIdSet = new Set(listedIds);
    const restIds = existingFolders
      .map((folder) => folder.id)
      .filter((id) => !listedIdSet.has(id));
    const nextOrder = [...listedIds, ...restIds];

    if (nextOrder.length === 0) {
      return;
    }

    await this.prismaService.$transaction(
      nextOrder.map((id, index) =>
        this.prismaService.chatFolder.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  public async listSearchHistory(
    data: ListSearchHistoryRequest,
  ): Promise<ListSearchHistoryResponse> {
    const userId = data.userId?.trim();
    if (!userId) {
      return { entries: [] };
    }

    const limit =
      typeof data.limit === 'number' && data.limit > 0
        ? Math.min(Math.floor(data.limit), 30)
        : 20;

    const entries = await this.prismaService.searchHistory.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return {
      entries: entries.map((entry) => this.mapSearchHistoryEntity(entry)),
    };
  }

  public async upsertSearchHistory(
    data: UpsertSearchHistoryRequest,
  ): Promise<SearchHistoryResponse> {
    const userId = data.userId?.trim();
    const query = this.normalizeSearchQuery(data.query);

    if (!userId || !query) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'User id and query are required',
      });
    }

    const normalizedQuery = query.toLowerCase();

    const entry = await this.prismaService.searchHistory.upsert({
      where: {
        userId_normalizedQuery: {
          userId,
          normalizedQuery,
        },
      },
      create: {
        userId,
        query,
        normalizedQuery,
      },
      update: {
        query,
      },
    });

    const staleEntries = await this.prismaService.searchHistory.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip: 50,
      select: { id: true },
    });

    if (staleEntries.length > 0) {
      await this.prismaService.searchHistory.deleteMany({
        where: {
          id: {
            in: staleEntries.map((item) => item.id),
          },
        },
      });
    }

    return {
      entry: this.mapSearchHistoryEntity(entry),
    };
  }

  public async deleteSearchHistoryEntry(
    data: DeleteSearchHistoryEntryRequest,
  ): Promise<void> {
    const userId = data.userId?.trim();
    const entryId = data.entryId?.trim();

    if (!userId || !entryId) {
      return;
    }

    await this.prismaService.searchHistory.deleteMany({
      where: {
        id: entryId,
        userId,
      },
    });
  }

  public async clearSearchHistory(data: ClearSearchHistoryRequest): Promise<void> {
    const userId = data.userId?.trim();
    if (!userId) {
      return;
    }

    await this.prismaService.searchHistory.deleteMany({
      where: { userId },
    });
  }

  public async patchLastSeenAt(data: PatchLastSeenAtRequest): Promise<void> {
    const userId = data.userId?.trim();
    const lastSeenAt = this.parseLastSeenAt(data.lastSeenAt);

    if (!userId || !lastSeenAt) {
      return;
    }

    await this.prismaService.user.updateMany({
      where: { id: userId },
      data: { lastSeenAt },
    });
  }

  public async create(data: Record<string, unknown>): Promise<void> {
    await this.prismaService.user.create({ data: data as any });
  }

  public async update(id: string, data: Record<string, unknown>): Promise<void> {
    await this.prismaService.user.update({ where: { id }, data: data as any });
  }

  public async patchUser(data: PatchUserRequest): Promise<void> {
    const { userId } = data;

    if (!userId) {
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (data.username !== undefined) {
      updateData.username = data.username || null;
    }
    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName || null;
    }
    if (data.avatars !== undefined) {
      updateData.avatars = data.avatars.values ?? [];
    }
    if (data.birthDate !== undefined) {
      updateData.birthDate = this.parseBirthDate(data.birthDate);
    }
    if (data.bio !== undefined) {
      updateData.bio = data.bio || null;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await this.update(userId, updateData);
  }

  public async patchPrivacySettings(
    data: PatchPrivacySettingsRequest,
  ): Promise<void> {
    const { userId } = data;

    if (!userId) {
      return;
    }

    const repository = this.prismaService as any;
    const privacySettingsRepo = repository.privacySettings;

    if (!privacySettingsRepo) {
      return;
    }

    const currentEntity = await privacySettingsRepo.findUnique({
      where: { userId },
    });
    const current = this.normalizePrivacySettings(currentEntity);
    const next = { ...current };

    for (const field of PRIVACY_KEYS) {
      const value = data[field];
      if (value !== undefined) {
        next[field] = this.normalizePrivacyType(value);
      }
    }

    const payload = {
      phone: next.phone,
      lastSeenTime: next.lastSeenTime,
      photo: next.photo,
      bio: next.bio,
      call: next.call,
      reply: next.reply,
      invite: next.invite,
      mediaMessage: next.mediaMessage,
      message: next.message,
      birthDate: next.birthDate,
    };

    if (currentEntity) {
      await privacySettingsRepo.update({
        where: { userId },
        data: payload,
      });
      return;
    }

    await privacySettingsRepo.create({
      data: {
        userId,
        ...payload,
      },
    });
  }

  private normalizePrivacyType(value: PrivacyType | undefined): PrivacyType {
    if (
      value !== PrivacyType.ALL &&
      value !== PrivacyType.CONTACTS &&
      value !== PrivacyType.NOBODY
    ) {
      return PrivacyType.PRIVACY_TYPE_UNSPECIFIED;
    }

    return value;
  }

  private parseBirthDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '' || value === '0' || value === 0) {
      return null;
    }

    const epoch =
      typeof value === 'string' ? Number(value) : (value as number);

    if (!Number.isFinite(epoch)) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Invalid birthDate value',
      });
    }

    const date = new Date(epoch);
    if (Number.isNaN(date.getTime())) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Invalid birthDate value',
      });
    }

    return date;
  }

  private parseLastSeenAt(value: unknown): Date | null {
    if (value === null || value === undefined || value === '' || value === '0' || value === 0) {
      return null;
    }

    const epoch =
      typeof value === 'string' ? Number(value) : (value as number);

    if (!Number.isFinite(epoch)) {
      return null;
    }

    const date = new Date(epoch);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private normalizeSearchQuery(value: string | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  private normalizePrivacySettings(input: unknown): PrivacySettings {
    const source = (input ?? {}) as Partial<Record<keyof PrivacySettings, PrivacyType | undefined>>;

    return {
      phone: this.normalizePrivacyType(source.phone),
      lastSeenTime: this.normalizePrivacyType(source.lastSeenTime),
      photo: this.normalizePrivacyType(source.photo),
      bio: this.normalizePrivacyType(source.bio),
      call: this.normalizePrivacyType(source.call),
      reply: this.normalizePrivacyType(source.reply),
      invite: this.normalizePrivacyType(source.invite),
      mediaMessage: this.normalizePrivacyType(source.mediaMessage),
      message: this.normalizePrivacyType(source.message),
      birthDate: this.normalizePrivacyType(source.birthDate),
    };
  }

  private mapUserEntity(entity: any): User {
    return {
      id: entity.id,
      username: entity.username ?? undefined,
      firstName: entity.firstName,
      lastName: entity.lastName ?? undefined,
      avatars: entity.avatars ?? [],
      birthDate: entity.birthDate ? entity.birthDate.getTime() : undefined,
      bio: entity.bio ?? undefined,
      lastSeenAt: entity.lastSeenAt ? entity.lastSeenAt.getTime() : undefined,
      privacySettings: this.normalizePrivacySettings(entity.privacySettings),
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    };
  }

  private mapSearchHistoryEntity(entity: any): SearchHistoryEntry {
    return {
      id: entity.id,
      userId: entity.userId,
      query: entity.query,
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    };
  }

  private mapChatFolderEntity(entity: any): ChatFolder {
    return {
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      includedChatIds: entity.includedChatIds ?? [],
      excludedChatIds: entity.excludedChatIds ?? [],
      includedTypes: entity.includedTypes ?? [],
      excludedTypes: entity.excludedTypes ?? [],
      inviteLink: entity.inviteLink ?? undefined,
      sortOrder: entity.sortOrder ?? 0,
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    };
  }

  private normalizeStringArray(values: string[] | undefined): string[] {
    if (!values || values.length === 0) {
      return [];
    }

    const unique = new Set<string>();
    for (const value of values) {
      const normalized = value?.trim();
      if (!normalized) {
        continue;
      }
      unique.add(normalized);
    }

    return [...unique];
  }

  private normalizeOptionalString(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async getNextChatFolderSortOrder(userId: string): Promise<number> {
    const lastFolder = await this.prismaService.chatFolder.findFirst({
      where: { userId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return (lastFolder?.sortOrder ?? -1) + 1;
  }
}
