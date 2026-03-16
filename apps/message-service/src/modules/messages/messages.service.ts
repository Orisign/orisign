import { ConversationsClientService } from '@/infra/grpc/conversations-client.service';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  GetUnreadCountRequest,
  GetUnreadCountResponse,
  GetReadStateRequest,
  GetReadStateResponse,
  DeleteMessageRequest,
  EditMessageRequest,
  ListMessagesRequest,
  ListMessagesResponse,
  MarkReadRequest,
  MutationResponse,
  SendMessageRequest,
  SendMessageResponse,
  SetUserBlockRequest,
  GetUserBlockStatusRequest,
  GetUserBlockStatusResponse,
} from '@repo/contracts/gen/ts/messages';
import { MessageKind } from '@repo/contracts/gen/ts/messages';
import { ConversationType, MemberState } from '@repo/contracts/gen/ts/conversations';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  public constructor(
    private readonly repository: MessagesRepository,
    private readonly conversationsClient: ConversationsClientService,
  ) {}

  public async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    if (!data.conversationId || !data.authorId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and author id are required',
      });
    }

    const messageKind = this.normalizeMessageKind(data.kind);

    if (!messageKind) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Message kind is required',
      });
    }

    const permission = await this.conversationsClient.canPost({
      conversationId: data.conversationId,
      userId: data.authorId,
    });

    if (!permission.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'No permission to post in this conversation',
      });
    }

    const conversation = await this.conversationsClient.getConversation({
      conversationId: data.conversationId,
      requesterId: data.authorId,
    });
    const peerId = this.resolveDirectPeerId(conversation.conversation ?? null, data.authorId);

    if (peerId) {
      const blocked = await this.repository.isBlockedEitherWay(data.authorId, peerId);
      if (blocked) {
        throw new RpcException({
          code: RpcStatus.PERMISSION_DENIED,
          details: 'Messaging is blocked for this direct chat',
        });
      }
    }

    if (data.replyToId) {
      const replyTarget = await this.repository.getMessageById(data.replyToId);

      if (!replyTarget) {
        throw new RpcException({
          code: RpcStatus.NOT_FOUND,
          details: 'Reply target message not found',
        });
      }

      if (replyTarget.conversationId !== data.conversationId) {
        throw new RpcException({
          code: RpcStatus.INVALID_ARGUMENT,
          details: 'Reply target must belong to the same conversation',
        });
      }
    }

    const message = await this.repository.createMessage({
      conversationId: data.conversationId,
      authorId: data.authorId,
      kind: messageKind,
      text: data.text,
      replyToId: data.replyToId,
      mediaKeys: data.mediaKeys,
    });

    return {
      ok: true,
      message,
    };
  }

  public async listMessages(data: ListMessagesRequest): Promise<ListMessagesResponse> {
    if (!data.conversationId || !data.requesterId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and requester id are required',
      });
    }

    const permission = await this.conversationsClient.canRead({
      conversationId: data.conversationId,
      userId: data.requesterId,
    });

    if (!permission.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'No permission to read this conversation',
      });
    }

    const messages = await this.repository.listMessages(
      data.conversationId,
      data.limit > 0 ? data.limit : 30,
      data.offset > 0 ? data.offset : 0,
    );

    return { messages };
  }

  public async getReadState(data: GetReadStateRequest): Promise<GetReadStateResponse> {
    if (!data.conversationId || !data.requesterId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and requester id are required',
      });
    }

    const permission = await this.conversationsClient.canRead({
      conversationId: data.conversationId,
      userId: data.requesterId,
    });

    if (!permission.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'No permission to read this conversation',
      });
    }

    const cursors = await this.repository.listReadCursors(data.conversationId);

    return { cursors };
  }

  public async getUnreadCount(
    data: GetUnreadCountRequest,
  ): Promise<GetUnreadCountResponse> {
    if (!data.conversationId || !data.requesterId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and requester id are required',
      });
    }

    const permission = await this.conversationsClient.canRead({
      conversationId: data.conversationId,
      userId: data.requesterId,
    });

    if (!permission.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'No permission to read this conversation',
      });
    }

    const cursor = await this.repository.getReadCursor(
      data.conversationId,
      data.requesterId,
    );

    const count = await this.repository.countUnreadMessages({
      conversationId: data.conversationId,
      userId: data.requesterId,
      lastReadAt: cursor?.lastReadAt ?? null,
    });

    return {
      count,
    };
  }

  public async editMessage(data: EditMessageRequest): Promise<MutationResponse> {
    if (!data.messageId || !data.actorId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Message id and actor id are required',
      });
    }

    const message = await this.repository.getMessageById(data.messageId);

    if (!message) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Message not found',
      });
    }

    if (message.authorId !== data.actorId) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Only author can edit message in MVP',
      });
    }

    await this.repository.editMessage(data.messageId, data.text);

    return { ok: true };
  }

  public async deleteMessage(data: DeleteMessageRequest): Promise<MutationResponse> {
    if (!data.messageId || !data.actorId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Message id and actor id are required',
      });
    }

    const message = await this.repository.getMessageById(data.messageId);

    if (!message) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Message not found',
      });
    }

    if (message.authorId !== data.actorId) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'Only author can delete message in MVP',
      });
    }

    await this.repository.deleteMessage(data.messageId);

    return { ok: true };
  }

  public async markRead(data: MarkReadRequest): Promise<MutationResponse> {
    if (!data.conversationId || !data.userId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id and user id are required',
      });
    }

    const permission = await this.conversationsClient.canRead({
      conversationId: data.conversationId,
      userId: data.userId,
    });

    if (!permission.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'No permission to read this conversation',
      });
    }

    await this.repository.markRead({
      conversationId: data.conversationId,
      userId: data.userId,
      lastReadMessageId: data.lastReadMessageId,
    });

    return { ok: true };
  }

  public async setUserBlock(data: SetUserBlockRequest): Promise<MutationResponse> {
    if (!data.actorId || !data.targetUserId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Actor id and target user id are required',
      });
    }

    if (data.actorId === data.targetUserId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Cannot block yourself',
      });
    }

    await this.repository.setUserBlock({
      blockerId: data.actorId,
      blockedId: data.targetUserId,
      blocked: Boolean(data.blocked),
    });

    return { ok: true };
  }

  public async getUserBlockStatus(
    data: GetUserBlockStatusRequest,
  ): Promise<GetUserBlockStatusResponse> {
    if (!data.actorId || !data.targetUserId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Actor id and target user id are required',
      });
    }

    const blocked = await this.repository.isUserBlocked(data.actorId, data.targetUserId);

    return {
      blocked,
    };
  }

  private normalizeMessageKind(value: unknown): MessageKind | null {
    const allowed = [MessageKind.TEXT, MessageKind.MEDIA, MessageKind.SYSTEM];

    if (typeof value === 'number') {
      return allowed.includes(value as MessageKind) ? (value as MessageKind) : null;
    }

    if (typeof value === 'string') {
      const enumValue = (MessageKind as unknown as Record<string, unknown>)[value];

      if (typeof enumValue === 'number') {
        return allowed.includes(enumValue as MessageKind) ? (enumValue as MessageKind) : null;
      }

      const parsed = Number(value);
      if (Number.isInteger(parsed) && allowed.includes(parsed as MessageKind)) {
        return parsed as MessageKind;
      }
    }

    return null;
  }

  private resolveDirectPeerId(
    conversation: {
      type?: number;
      members?: Array<{ userId?: string; state?: number }>;
    } | null,
    requesterId: string,
  ) {
    if (!conversation || conversation.type !== ConversationType.DM) {
      return null;
    }

    const peer = (conversation.members ?? []).find(
      (member) =>
        member.userId &&
        member.userId !== requesterId &&
        member.state === MemberState.ACTIVE,
    );

    return peer?.userId ?? null;
  }
}
