import { PrismaService } from '@/infra/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  GetUserRequest,
  GetUserResponse,
  ListUsersRequest,
  ListUsersResponse,
  PatchPrivacySettingsRequest,
  PatchUserRequest,
  PrivacySettings,
  User,
} from '@repo/contracts/gen/ts/users';

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

const PRIVACY_TYPE_UNSPECIFIED = 0;
const PRIVACY_TYPE_ALL = 1;
const PRIVACY_TYPE_CONTACTS = 2;
const PRIVACY_TYPE_NOBODY = 3;

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

  private normalizePrivacyType(value: number): number {
    if (
      value !== PRIVACY_TYPE_ALL &&
      value !== PRIVACY_TYPE_CONTACTS &&
      value !== PRIVACY_TYPE_NOBODY
    ) {
      return PRIVACY_TYPE_UNSPECIFIED;
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

  private normalizePrivacySettings(input: unknown): PrivacySettings {
    const source = (input ?? {}) as Partial<Record<keyof PrivacySettings, any>>;

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
      privacySettings: this.normalizePrivacySettings(entity.privacySettings),
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    };
  }
}
