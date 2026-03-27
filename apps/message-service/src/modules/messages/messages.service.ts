import { ConversationsClientService } from '@/infra/grpc/conversations-client.service';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import { randomUUID } from 'crypto';
import type {
  GetUnreadCountRequest,
  GetUnreadCountResponse,
  GetReadStateRequest,
  GetReadStateResponse,
  DeleteMessageRequest,
  EditMessageRequest,
  InvokeMessageCallbackRequest,
  InvokeMessageCallbackResponse,
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

    const messageKind =
      data.kind &&
      data.kind !== MessageKind.MESSAGE_KIND_UNSPECIFIED &&
      data.kind !== MessageKind.UNRECOGNIZED
        ? data.kind
        : null;

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

    const conversationResponse = await this.conversationsClient.getConversation({
      conversationId: data.conversationId,
      requesterId: data.authorId,
      username: '',
    });
    const conversation = conversationResponse.conversation ?? null;
    const peerId = this.resolveDirectPeerId(conversation, data.authorId);

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
        const linkedDiscussionChannelId =
          conversation?.discussionChannelId?.trim() || '';
        let isLinkedDiscussionReply =
          conversation?.type === ConversationType.GROUP &&
          linkedDiscussionChannelId === replyTarget.conversationId;

        if (isLinkedDiscussionReply) {
          const linkedChannelConversation =
            await this.conversationsClient.getConversation({
              conversationId: replyTarget.conversationId,
              requesterId: data.authorId,
              username: '',
            });

          if (!linkedChannelConversation.conversation) {
            throw new RpcException({
              code: RpcStatus.NOT_FOUND,
              details: 'Linked channel not found',
            });
          }
        }

        if (!isLinkedDiscussionReply) {
          const replyTargetConversation =
            await this.conversationsClient.getConversation({
              conversationId: replyTarget.conversationId,
              requesterId: data.authorId,
              username: '',
            });
          const replyConversation = replyTargetConversation.conversation ?? null;
          const linkedDiscussionConversationId =
            replyConversation?.discussionConversationId?.trim() || '';

          isLinkedDiscussionReply =
            replyConversation?.type === ConversationType.CHANNEL &&
            linkedDiscussionConversationId === data.conversationId;
        }

        if (!isLinkedDiscussionReply) {
          throw new RpcException({
            code: RpcStatus.INVALID_ARGUMENT,
            details: 'Reply target must belong to the same conversation',
          });
        }
      }
    }

    const message = await this.repository.createMessage({
      conversationId: data.conversationId,
      authorId: data.authorId,
      kind: messageKind,
      text: data.text,
      replyToId: data.replyToId,
      mediaKeys: data.mediaKeys,
      entitiesJson: data.entitiesJson,
      replyMarkupJson: data.replyMarkupJson,
      attachmentsJson: data.attachmentsJson,
      sourceBotId: data.sourceBotId,
      metadataJson: data.metadataJson,
    });

    return {
      ok: true,
      message,
    };
  }

  public async invokeMessageCallback(
    data: InvokeMessageCallbackRequest,
  ): Promise<InvokeMessageCallbackResponse> {
    if (!data.conversationId || !data.actorId || !data.messageId || !data.callbackData) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Conversation id, actor id, message id and callback data are required',
      });
    }

    if (Buffer.byteLength(data.callbackData, 'utf8') > 256) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Callback data must be 256 bytes or less',
      });
    }

    const permission = await this.conversationsClient.canRead({
      conversationId: data.conversationId,
      userId: data.actorId,
    });

    if (!permission.allowed) {
      throw new RpcException({
        code: RpcStatus.PERMISSION_DENIED,
        details: 'No permission to interact with this conversation',
      });
    }

    const message = await this.repository.getMessageById(data.messageId);

    if (!message) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Message not found',
      });
    }

    if (message.conversationId !== data.conversationId) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'Message does not belong to the provided conversation',
      });
    }

    if (!message.sourceBotId) {
      throw new RpcException({
        code: RpcStatus.FAILED_PRECONDITION,
        details: 'Target message is not interactive',
      });
    }

    if (!this.containsCallbackData(message.replyMarkupJson, data.callbackData)) {
      throw new RpcException({
        code: RpcStatus.NOT_FOUND,
        details: 'Callback button not found on this message',
      });
    }

    return {
      ok: true,
      callbackQueryId: randomUUID(),
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
      {
        conversationId: data.conversationId,
        limit: data.limit > 0 ? data.limit : 30,
        offset: data.offset > 0 ? data.offset : 0,
        replyToId: data.replyToId?.trim() || undefined,
        messageId: data.messageId?.trim() || undefined,
      },
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

    await this.repository.editMessage(data.messageId, {
      ...(data.text ? { text: data.text } : {}),
      ...(data.replyMarkupJson ? { replyMarkupJson: data.replyMarkupJson } : {}),
      ...(data.entitiesJson ? { entitiesJson: data.entitiesJson } : {}),
      ...(data.metadataJson ? { metadataJson: data.metadataJson } : {}),
    });

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

  private resolveDirectPeerId(
    conversation: {
      type?: ConversationType;
      members?: Array<{ userId?: string; state?: MemberState }>;
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

  private containsCallbackData(replyMarkupJson: string | undefined, callbackData: string) {
    if (!replyMarkupJson?.trim()) {
      return false;
    }

    try {
      const markup = JSON.parse(replyMarkupJson) as {
        inlineKeyboard?: Array<Array<{ callbackData?: string }>>;
      };

      return (markup.inlineKeyboard ?? []).some((row) =>
        row.some((button) => button.callbackData === callbackData),
      );
    } catch {
      return false;
    }
  }
}
