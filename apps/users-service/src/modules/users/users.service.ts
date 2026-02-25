import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  CreateUserRequest,
  CreateUserResponse,
  GetUserRequest,
  GetUserResponse,
  PatchPrivacySettingsRequest,
  PatchResponse,
  PatchUserRequest,
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
}
