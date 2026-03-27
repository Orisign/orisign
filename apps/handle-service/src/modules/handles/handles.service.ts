import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  CheckHandleAvailabilityRequest,
  CheckHandleAvailabilityResponse,
  GetHandleByTargetRequest,
  GetHandleByTargetResponse,
  MutationResponse,
  ReleaseHandleRequest,
  ReserveHandleRequest,
  ReserveHandleResponse,
  ResolveHandleRequest,
  ResolveHandleResponse,
} from '@repo/contracts/gen/ts/handles';
import { HandleKind } from '@repo/contracts/gen/ts/handles';
import { HANDLE_PATTERN, RESERVED_HANDLES } from './handles.constants';
import { HandlesRepository } from './handles.repository';

@Injectable()
export class HandlesService {
  public constructor(private readonly repository: HandlesRepository) {}

  public async reserveHandle(data: ReserveHandleRequest): Promise<ReserveHandleResponse> {
    const normalized = this.normalizeUsername(data.username);
    const kind = data.kind;
    this.assertValidHandle(normalized, kind);

    try {
      const handle = await this.repository.reserve({
        username: normalized,
        normalizedUsername: normalized,
        kind,
        targetId: data.targetId,
        actorId: data.actorId?.trim() || data.targetId,
        traceId: data.traceId?.trim() || '',
        allowReplaceSameTarget: Boolean(data.allowReplaceSameTarget),
      });

      return { ok: true, handle };
    } catch (error) {
      if ((error as Error).message === 'HANDLE_ALREADY_TAKEN') {
        throw new RpcException({
          code: RpcStatus.ALREADY_EXISTS,
          details: 'Handle is already taken',
        });
      }

      if ((error as Error).message === 'TARGET_ALREADY_HAS_HANDLE') {
        throw new RpcException({
          code: RpcStatus.ALREADY_EXISTS,
          details: 'Target already has an active handle',
        });
      }

      throw error;
    }
  }

  public async releaseHandle(data: ReleaseHandleRequest): Promise<MutationResponse> {
    const normalized = this.normalizeUsername(data.username);
    const kind = data.kind;
    const released = await this.repository.release({
      username: normalized,
      normalizedUsername: normalized,
      kind,
      targetId: data.targetId,
      actorId: data.actorId?.trim() || data.targetId,
      traceId: data.traceId?.trim() || '',
    });

    return { ok: released };
  }

  public async resolveHandle(data: ResolveHandleRequest): Promise<ResolveHandleResponse> {
    const normalized = this.normalizeUsername(data.username);
    const entity = await this.repository.findByNormalizedUsername(normalized);

    if (!entity || entity.status !== 'ACTIVE') {
      return { handle: undefined };
    }

    return { handle: this.repository.toProtoHandle(entity) };
  }

  public async checkHandleAvailability(
    data: CheckHandleAvailabilityRequest,
  ): Promise<CheckHandleAvailabilityResponse> {
    const normalized = this.normalizeUsername(data.username);
    const kind = data.kind;

    try {
      this.assertValidHandle(normalized, kind);
    } catch (error) {
      return {
        available: false,
        normalizedUsername: normalized,
        reason: (error as RpcException).getError()['details'] ?? 'Invalid handle',
      };
    }

    const existing = await this.repository.findByNormalizedUsername(normalized);

    return {
      available: !existing || existing.status === 'RELEASED',
      normalizedUsername: normalized,
      reason: existing && existing.status !== 'RELEASED' ? 'Handle is already taken' : '',
    };
  }

  public async getHandleByTarget(data: GetHandleByTargetRequest): Promise<GetHandleByTargetResponse> {
    const entity = await this.repository.findActiveByTarget(
      data.targetId,
      data.kind,
    );

    return {
      handle: entity ? this.repository.toProtoHandle(entity) : undefined,
    };
  }

  private normalizeUsername(value: string) {
    return (value ?? '').trim().replace(/^@+/, '').toLowerCase();
  }

  private assertValidHandle(username: string, kind: HandleKind) {
    if (!username) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Username is required',
      });
    }

    if (!HANDLE_PATTERN.test(username)) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Username must be 5-32 chars of lowercase letters, digits and underscores',
      });
    }

    if (
      kind === HandleKind.HANDLE_KIND_UNSPECIFIED ||
      kind === HandleKind.UNRECOGNIZED
    ) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Handle kind is required',
      });
    }

    if (RESERVED_HANDLES.has(username)) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Username is reserved',
      });
    }

    const endsWithBot = username.endsWith('bot');
    const botKinds = new Set([HandleKind.BOT, HandleKind.SYSTEM_BOT]);

    if (endsWithBot && !botKinds.has(kind)) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Only bots may use usernames ending with bot',
      });
    }

    if (!endsWithBot && botKinds.has(kind)) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Bot usernames must end with bot',
      });
    }
  }
}
