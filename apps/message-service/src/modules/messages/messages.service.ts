import { ConversationsClientService } from '@/infra/grpc/conversations-client.service';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
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
} from '@repo/contracts/gen/ts/messages';
import { MessageKind } from '@repo/contracts/gen/ts/messages';
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
}
