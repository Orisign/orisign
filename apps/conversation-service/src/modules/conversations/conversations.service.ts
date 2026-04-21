import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  AddMembersRequest,
  Conversation,
  CreateConversationRequest,
  CreateConversationResponse,
  DeleteConversationRequest,
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
  TouchConversationRequest,
  UpdateConversationRequest,
  UpdateConversationNotificationsRequest,
  UpdateMemberRoleRequest,
} from '@repo/contracts/gen/ts/conversations';
import {
  ConversationType,
  MemberRole,
  MemberState,
} from '@repo/contracts/gen/ts/conversations';
import { HandleKind } from '@repo/contracts/gen/ts/handles';
import { ConversationsRepository } from './conversations.repository';
import { HandlesClientService } from '@/infra/grpc/handles-client.service';

function isBotProjectionUserId(userId: string) {
  return userId.startsWith('botusr_');
}

@Injectable()
export class ConversationsService {
  public constructor(
    private readonly repository: ConversationsRepository,
    private readonly handlesClient: HandlesClientService,
  ) {}

  public async createConversation(
    data: CreateConversationRequest,
  ): Promise<CreateConversationResponse> {
    if (!data.creatorId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Creator id is required',
      });
    }

    const conversationType =
      data.type &&
      data.type !== ConversationType.CONVERSATION_TYPE_UNSPECIFIED &&
      data.type !== ConversationType.UNRECOGNIZED
        ? data.type
        : null;

    if (!conversationType) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation type is required',
      });
    }

    const requestedUsername = (data.username ?? '').trim().replace(/^@+/, '').toLowerCase();

    if (conversationType === ConversationType.DM) {
      const participantIds = [...new Set([data.creatorId, ...(data.memberIds ?? [])])];
      if (participantIds.length === 2) {
        const peerUserId = participantIds.find((userId) => userId !== data.creatorId) ?? '';
        if (peerUserId) {
          const existingConversation = await this.repository.findDirectConversationByMembers(
            data.creatorId,
            peerUserId,
          );

          if (existingConversation) {
            const creatorMember = this.findMember(existingConversation, data.creatorId);
            const shouldReuseExistingConversation =
              !isBotProjectionUserId(peerUserId) ||
              creatorMember?.state === MemberState.ACTIVE;

            if (!shouldReuseExistingConversation) {
              // Bot chats intentionally start from a fresh DM after the user deletes/leaves them.
              // Restoring the old conversation resurrects the previous history, which is not the
              // expected "Delete chat" behavior in the client.
            } else {
              await this.restoreDirectConversationParticipant(existingConversation, data.creatorId);
              await this.restoreDirectConversationParticipant(existingConversation, peerUserId);

              return {
                ok: true,
                conversation:
                  (await this.repository.getConversationById(existingConversation.id, data.creatorId)) ??
                  existingConversation,
              };
            }
          }
        }
      }
    }

    if (data.isPublic && !requestedUsername) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Username is required for public conversations',
      });
    }

    const conversation = await this.repository.createConversation({
      type: conversationType,
      creatorId: data.creatorId,
      title: data.title,
      about: data.about,
      avatarKey: data.avatarKey,
      isPublic: data.isPublic,
      username: '',
      memberIds: data.memberIds,
    });

    if (data.isPublic && requestedUsername) {
      try {
        await this.handlesClient.reserveHandle({
          username: requestedUsername,
          kind: HandleKind.CONVERSATION,
          targetId: conversation.id,
          actorId: data.creatorId,
          traceId: '',
          allowReplaceSameTarget: true,
        });

        await this.repository.setPublicHandle({
          conversationId: conversation.id,
          username: requestedUsername,
          isPublic: true,
        });

        conversation.username = requestedUsername;
      } catch (error) {
        await this.repository.deleteConversation(conversation.id);
        throw error;
      }
    }

    return {
      ok: true,
      conversation,
    };
  }

  public async getConversation(data: GetConversationRequest): Promise<GetConversationResponse> {
    const conversationId = data.conversationId?.trim() ?? '';
    const username = (data.username ?? '').trim().replace(/^@+/, '');

    if ((!conversationId && !username) || !data.requesterId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id or username and requester id are required',
      });
    }

    let conversation = conversationId
      ? await this.repository.getConversationById(conversationId, data.requesterId)
      : await this.repository.getConversationByUsername(username, data.requesterId);

    if (!conversation) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Conversation not found',
      });
    }

    conversation = await this.restoreDirectConversationIfNeeded(conversation, data.requesterId);

    const canRead = await this.canRead({
      conversationId: conversation.id,
      userId: data.requesterId,
    });

    if (!canRead.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'You do not have access to this conversation',
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

  public async updateConversation(data: UpdateConversationRequest): Promise<MutationResponse> {
    if (!data.conversationId || !data.actorId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and actor id are required',
      });
    }

    const actor = await this.getMember(data.conversationId, data.actorId);
    if (!actor || ![MemberRole.OWNER, MemberRole.ADMIN].includes(actor.role)) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Insufficient role to update conversation',
      });
    }

    const conversation = await this.repository.getConversationById(data.conversationId);
    if (!conversation) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Conversation not found',
      });
    }

    if (conversation.type === ConversationType.DM) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Direct conversations cannot be updated here',
      });
    }

    const title = (data.title ?? '').trim();
    const about = (data.about ?? '').trim();
    const username = (data.username ?? '').trim().replace(/^@+/, '');
    const avatarKey = (data.avatarKey ?? '').trim();
    const discussionConversationId =
      (data.discussionConversationId ?? '').trim();

    if (!title) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Title is required',
      });
    }

    if (data.isPublic && !username) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Username is required for public conversations',
      });
    }

    if (conversation.type !== ConversationType.CHANNEL && discussionConversationId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Discussion groups can only be linked to channels',
      });
    }

    if (conversation.type === ConversationType.CHANNEL && discussionConversationId) {
      if (discussionConversationId === data.conversationId) {
        throw new RpcException({
          code: RpcStatus.INVALID_ARGUMENT,
          details: 'Channel cannot be linked to itself',
        });
      }

      const discussionConversation = await this.repository.getConversationById(
        discussionConversationId,
        data.actorId,
      );

      if (!discussionConversation) {
        throw new RpcException({
          code: RpcStatus.NOT_FOUND,
          details: 'Discussion group not found',
        });
      }

      if (![ConversationType.GROUP, ConversationType.SUPERGROUP].includes(discussionConversation.type)) {
        throw new RpcException({
          code: RpcStatus.INVALID_ARGUMENT,
          details: 'Discussion target must be a group',
        });
      }

      const discussionActor = await this.getMember(
        discussionConversationId,
        data.actorId,
      );

      if (!discussionActor || ![MemberRole.OWNER, MemberRole.ADMIN].includes(discussionActor.role)) {
        throw new RpcException({
          code: RpcStatus.PERMISSION_DENIED,
          details: 'Insufficient role to link discussion group',
        });
      }

      if (
        discussionConversation.discussionChannelId &&
        discussionConversation.discussionChannelId !== data.conversationId
      ) {
        throw new RpcException({
          code: RpcStatus.INVALID_ARGUMENT,
          details: 'Group is already linked to another channel',
        });
      }
    }

    const currentUsername = (conversation.username ?? '').trim().replace(/^@+/, '').toLowerCase();
    const nextUsername = username.toLowerCase();
    const shouldReserveHandle = Boolean(data.isPublic && nextUsername && nextUsername !== currentUsername);

    if (shouldReserveHandle) {
      await this.handlesClient.reserveHandle({
        username: nextUsername,
        kind: HandleKind.CONVERSATION,
        targetId: data.conversationId,
        actorId: data.actorId,
        traceId: '',
        allowReplaceSameTarget: true,
      });
    }

    await this.repository.updateConversation({
      conversationId: data.conversationId,
      title,
      about,
      isPublic: data.isPublic,
      username: data.isPublic ? nextUsername : '',
      avatarKey,
      discussionConversationId,
    });

    if (currentUsername && (!data.isPublic || currentUsername !== nextUsername)) {
      await this.handlesClient.releaseHandle({
        username: currentUsername,
        targetId: data.conversationId,
        kind: HandleKind.CONVERSATION,
        actorId: data.actorId,
        traceId: '',
      });
    }

    return { ok: true };
  }

  public async deleteConversation(data: DeleteConversationRequest): Promise<MutationResponse> {
    if (!data.conversationId || !data.actorId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and actor id are required',
      });
    }

    const conversation = await this.repository.getConversationById(
      data.conversationId,
      data.actorId,
    );

    if (!conversation) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Conversation not found',
      });
    }

    if (conversation.ownerId !== data.actorId) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Only the owner can delete the conversation',
      });
    }

    if (conversation.type === ConversationType.DM) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Direct conversations cannot be deleted here',
      });
    }

    await this.repository.deleteConversation(data.conversationId);

    const username = (conversation.username ?? '').trim().replace(/^@+/, '').toLowerCase();
    if (username) {
      await this.handlesClient.releaseHandle({
        username,
        targetId: data.conversationId,
        kind: HandleKind.CONVERSATION,
        actorId: data.actorId,
        traceId: '',
      });
    }

    return { ok: true };
  }

  public async updateNotifications(
    data: UpdateConversationNotificationsRequest,
  ): Promise<MutationResponse> {
    if (!data.conversationId || !data.userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and user id are required',
      });
    }

    const member = await this.getMember(data.conversationId, data.userId);

    if (!member || member.state !== MemberState.ACTIVE) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'User is not an active member',
      });
    }

    await this.repository.setMemberNotifications({
      conversationId: data.conversationId,
      userId: data.userId,
      notificationsEnabled: data.notificationsEnabled,
    });

    return { ok: true };
  }

  public async touchConversation(
    data: TouchConversationRequest,
  ): Promise<MutationResponse> {
    const conversationId = data.conversationId?.trim() ?? '';

    if (!conversationId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id is required',
      });
    }

    await this.repository.touchConversation(conversationId);

    return { ok: true };
  }

  public async joinConversation(data: JoinConversationRequest): Promise<MutationResponse> {
    const conversationId = data.conversationId?.trim() ?? '';
    const username = (data.username ?? '').trim().replace(/^@+/, '');

    if ((!conversationId && !username) || !data.userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id or username and user id are required',
      });
    }

    const conversation = conversationId
      ? await this.repository.getConversationById(conversationId, data.userId)
      : await this.repository.getConversationByUsername(username, data.userId);

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
      conversationId: conversation.id,
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
    const conversationEntity = await this.repository.getConversationById(data.conversationId);

    if (!conversationEntity) {
      return { allowed: false };
    }

    const conversation = await this.restoreDirectConversationIfNeeded(
      conversationEntity,
      data.userId,
    );

    const discussionAccess = await this.resolveDiscussionAccess(conversation, data.userId);
    if (discussionAccess !== null) {
      return { allowed: discussionAccess };
    }

    if (conversation.isPublic) {
      return { allowed: true };
    }

    const member = this.findMember(conversation, data.userId);

    return { allowed: member?.state === MemberState.ACTIVE };
  }

  public async canPost(data: PermissionRequest): Promise<PermissionResponse> {
    const conversationEntity = await this.repository.getConversationById(data.conversationId);

    if (!conversationEntity) {
      return { allowed: false };
    }

    const conversation = await this.restoreDirectConversationIfNeeded(
      conversationEntity,
      data.userId,
    );

    const discussionAccess = await this.resolveDiscussionAccess(conversation, data.userId);
    if (discussionAccess !== null) {
      return { allowed: discussionAccess };
    }

    const member = this.findMember(conversation, data.userId);

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

    return conversation ? this.findMember(conversation, userId) : null;
  }

  private findMember(conversation: Conversation, userId: string) {
    return conversation.members.find((member) => member.userId === userId) ?? null;
  }

  private async restoreDirectConversationIfNeeded(
    conversation: Conversation,
    userId: string,
  ): Promise<Conversation> {
    if (conversation.type !== ConversationType.DM || !userId) {
      return conversation;
    }

    const member = this.findMember(conversation, userId);
    if (!member) {
      return conversation;
    }

    if ([MemberState.BANNED, MemberState.KICKED].includes(member.state)) {
      return conversation;
    }

    if (member.state === MemberState.ACTIVE) {
      return conversation;
    }

    const peerMember = conversation.members.find(
      (entry) => entry.userId && entry.userId !== userId,
    );
    if (peerMember?.userId && isBotProjectionUserId(peerMember.userId)) {
      return conversation;
    }

    await this.restoreDirectConversationParticipant(conversation, userId);

    return (
      (await this.repository.getConversationById(conversation.id, userId)) ??
      conversation
    );
  }

  private async restoreDirectConversationParticipant(
    conversation: Conversation,
    userId: string,
  ) {
    const member = this.findMember(conversation, userId);
    if (!member) {
      return;
    }

    if ([MemberState.BANNED, MemberState.KICKED].includes(member.state)) {
      return;
    }

    await this.repository.upsertMember({
      conversationId: conversation.id,
      userId,
      role: member.role,
      state: MemberState.ACTIVE,
    });
  }

  private async resolveDiscussionAccess(
    conversation: Conversation,
    userId: string,
  ): Promise<boolean | null> {
    const discussionChannelId =
      conversation.type === ConversationType.GROUP
        ? conversation.discussionChannelId?.trim() ?? ''
        : '';

    if (!discussionChannelId) {
      return null;
    }

    const member = this.findMember(conversation, userId);

    if (member?.state === MemberState.ACTIVE) {
      return true;
    }

    if (member && [MemberState.BANNED, MemberState.KICKED].includes(member.state)) {
      return false;
    }

    const linkedChannel = await this.repository.getConversationById(discussionChannelId);
    if (!linkedChannel) {
      return false;
    }

    const linkedChannelMember = this.findMember(linkedChannel, userId);

    return linkedChannelMember?.state === MemberState.ACTIVE;
  }

}
