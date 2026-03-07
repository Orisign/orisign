import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  AddMembersRequest,
  CreateConversationRequest,
  CreateConversationResponse,
  GetConversationRequest,
  GetConversationResponse,
  JoinConversationRequest,
  LeaveConversationRequest,
  ListMyConversationsRequest,
  ListMyConversationsResponse,
  MutationResponse,
  PermissionRequest,
  PermissionResponse,
  RemoveMemberRequest,
  UpdateMemberRoleRequest,
} from '@repo/contracts/gen/ts/conversations';
import {
  ConversationType,
  MemberRole,
  MemberState,
} from '@repo/contracts/gen/ts/conversations';
import { ConversationsRepository } from './conversations.repository';

@Injectable()
export class ConversationsService {
  public constructor(private readonly repository: ConversationsRepository) {}

  public async createConversation(
    data: CreateConversationRequest,
  ): Promise<CreateConversationResponse> {
    if (!data.creatorId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Creator id is required',
      });
    }

    const conversationType = this.normalizeConversationType(data.type);

    if (!conversationType) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation type is required',
      });
    }

    const conversation = await this.repository.createConversation({
      type: conversationType,
      creatorId: data.creatorId,
      title: data.title,
      about: data.about,
      isPublic: data.isPublic,
      username: data.username,
      memberIds: data.memberIds,
    });

    return {
      ok: true,
      conversation,
    };
  }

  public async getConversation(data: GetConversationRequest): Promise<GetConversationResponse> {
    if (!data.conversationId || !data.requesterId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and requester id are required',
      });
    }

    const canRead = await this.canRead({
      conversationId: data.conversationId,
      userId: data.requesterId,
    });

    if (!canRead.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'You do not have access to this conversation',
      });
    }

    const conversation = await this.repository.getConversationById(data.conversationId);

    if (!conversation) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Conversation not found',
      });
    }

    return { conversation };
  }

  public async listMyConversations(
    data: ListMyConversationsRequest,
  ): Promise<ListMyConversationsResponse> {
    if (!data.requesterId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Requester id is required',
      });
    }

    const conversations = await this.repository.listByUserId(
      data.requesterId,
      data.limit > 0 ? data.limit : 30,
      data.offset > 0 ? data.offset : 0,
    );

    return { conversations };
  }

  public async addMembers(data: AddMembersRequest): Promise<MutationResponse> {
    const actor = await this.getMember(data.conversationId, data.actorId);

    if (!actor) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Actor is not a member',
      });
    }

    if (![MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR].includes(actor.role)) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Insufficient role to add members',
      });
    }

    for (const userId of [...new Set(data.memberIds ?? [])]) {
      await this.repository.upsertMember({
        conversationId: data.conversationId,
        userId,
        role: MemberRole.MEMBER,
        state: MemberState.ACTIVE,
      });
    }

    return { ok: true };
  }

  public async removeMember(data: RemoveMemberRequest): Promise<MutationResponse> {
    const actor = await this.getMember(data.conversationId, data.actorId);

    if (!actor) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Actor is not a member',
      });
    }

    const isSelf = data.actorId === data.targetUserId;
    const canManage = [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR].includes(actor.role);

    if (!isSelf && !canManage) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Insufficient role to remove member',
      });
    }

    await this.repository.setMemberState({
      conversationId: data.conversationId,
      userId: data.targetUserId,
      state: MemberState.KICKED,
    });

    return { ok: true };
  }

  public async updateMemberRole(data: UpdateMemberRoleRequest): Promise<MutationResponse> {
    const actor = await this.getMember(data.conversationId, data.actorId);

    if (!actor || ![MemberRole.OWNER, MemberRole.ADMIN].includes(actor.role)) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Insufficient role to update member role',
      });
    }

    await this.repository.setMemberRole({
      conversationId: data.conversationId,
      userId: data.targetUserId,
      role: data.role,
    });

    return { ok: true };
  }

  public async joinConversation(data: JoinConversationRequest): Promise<MutationResponse> {
    if (!data.conversationId || !data.userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and user id are required',
      });
    }

    const conversation = await this.repository.getConversationById(data.conversationId);

    if (!conversation) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Conversation not found',
      });
    }

    if (!conversation.isPublic && conversation.type !== ConversationType.CHANNEL) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Conversation is private',
      });
    }

    await this.repository.upsertMember({
      conversationId: data.conversationId,
      userId: data.userId,
      role: conversation.type === ConversationType.CHANNEL ? MemberRole.SUBSCRIBER : MemberRole.MEMBER,
      state: MemberState.ACTIVE,
    });

    return { ok: true };
  }

  public async leaveConversation(data: LeaveConversationRequest): Promise<MutationResponse> {
    if (!data.conversationId || !data.userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and user id are required',
      });
    }

    await this.repository.setMemberState({
      conversationId: data.conversationId,
      userId: data.userId,
      state: MemberState.LEFT,
    });

    return { ok: true };
  }

  public async canRead(data: PermissionRequest): Promise<PermissionResponse> {
    const conversation = await this.repository.getConversationById(data.conversationId);

    if (!conversation) {
      return { allowed: false };
    }

    if (conversation.isPublic) {
      return { allowed: true };
    }

    const member = conversation.members.find((entry) => entry.userId === data.userId);

    return { allowed: member?.state === MemberState.ACTIVE };
  }

  public async canPost(data: PermissionRequest): Promise<PermissionResponse> {
    const conversation = await this.repository.getConversationById(data.conversationId);

    if (!conversation) {
      return { allowed: false };
    }

    const member = conversation.members.find((entry) => entry.userId === data.userId);

    if (!member || member.state !== MemberState.ACTIVE) {
      return { allowed: false };
    }

    if (conversation.type === ConversationType.CHANNEL) {
      return {
        allowed: [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR].includes(member.role),
      };
    }

    return { allowed: true };
  }

  private async getMember(conversationId: string, userId: string) {
    const conversation = await this.repository.getConversationById(conversationId);

    return conversation?.members.find((member) => member.userId === userId) ?? null;
  }

  private normalizeConversationType(value: unknown): ConversationType | null {
    const allowed = [ConversationType.DM, ConversationType.GROUP, ConversationType.CHANNEL];

    if (typeof value === 'number') {
      return allowed.includes(value as ConversationType) ? (value as ConversationType) : null;
    }

    if (typeof value === 'string') {
      const enumValue = (ConversationType as unknown as Record<string, unknown>)[value];

      if (typeof enumValue === 'number') {
        return allowed.includes(enumValue as ConversationType)
          ? (enumValue as ConversationType)
          : null;
      }

      const parsed = Number(value);
      if (Number.isInteger(parsed) && allowed.includes(parsed as ConversationType)) {
        return parsed as ConversationType;
      }
    }

    return null;
  }
}
