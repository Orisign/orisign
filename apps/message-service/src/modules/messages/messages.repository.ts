import { PrismaService } from '@/infra/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { ConversationReadCursor, Message } from '@repo/contracts/gen/ts/messages';
import { MessageKind } from '@repo/contracts/gen/ts/messages';

@Injectable()
export class MessagesRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async createMessage(params: {
    conversationId: string;
    authorId: string;
    kind: MessageKind;
    text?: string;
    replyToId?: string;
    mediaKeys?: string[];
  }): Promise<Message> {
    const entity = await this.prismaService.message.create({
      data: {
        conversationId: params.conversationId,
        authorId: params.authorId,
        kind: this.toPrismaKind(params.kind),
        text: params.text || null,
        replyToId: params.replyToId || null,
        mediaKeys: params.mediaKeys ?? [],
      },
    });

    return this.toProtoMessage(entity);
  }

  public async listMessages(
    conversationId: string,
    limit: number,
    offset: number,
  ): Promise<Message[]> {
    const entities = await this.prismaService.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return entities.map((entity) => this.toProtoMessage(entity));
  }

  public async listReadCursors(conversationId: string): Promise<ConversationReadCursor[]> {
    const entities = await this.prismaService.messageRead.findMany({
      where: { conversationId },
    });

    return entities.map((entity) => ({
      userId: entity.userId,
      lastReadMessageId: entity.lastReadMessageId ?? '',
      lastReadAt: entity.lastReadAt.getTime(),
    }));
  }

  public async getReadCursor(conversationId: string, userId: string) {
    return await this.prismaService.messageRead.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
  }

  public async countUnreadMessages(params: {
    conversationId: string;
    userId: string;
    lastReadAt?: Date | null;
  }) {
    return await this.prismaService.message.count({
      where: {
        conversationId: params.conversationId,
        deletedAt: null,
        authorId: { not: params.userId },
        ...(params.lastReadAt ? { createdAt: { gt: params.lastReadAt } } : {}),
      },
    });
  }

  public async getMessageById(messageId: string): Promise<Message | null> {
    const entity = await this.prismaService.message.findUnique({
      where: { id: messageId },
    });

    if (!entity || entity.deletedAt) {
      return null;
    }

    return this.toProtoMessage(entity);
  }

  public async editMessage(messageId: string, text: string): Promise<void> {
    await this.prismaService.message.update({
      where: { id: messageId },
      data: {
        text,
        editedAt: new Date(),
      },
    });
  }

  public async deleteMessage(messageId: string): Promise<void> {
    await this.prismaService.message.delete({
      where: { id: messageId },
    });
  }

  public async markRead(params: {
    conversationId: string;
    userId: string;
    lastReadMessageId?: string;
  }): Promise<void> {
    const normalizedLastReadMessageId = params.lastReadMessageId?.trim() || null;
    const existingCursor = await this.prismaService.messageRead.findUnique({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
    });

    const existingLastReadMessageId = existingCursor?.lastReadMessageId?.trim() || null;

    if (existingCursor) {
      if (!normalizedLastReadMessageId) {
        return;
      }

      if (existingLastReadMessageId === normalizedLastReadMessageId) {
        return;
      }

      if (existingLastReadMessageId) {
        const [incomingMessage, existingMessage] = await Promise.all([
          this.prismaService.message.findFirst({
            where: {
              id: normalizedLastReadMessageId,
              conversationId: params.conversationId,
              deletedAt: null,
            },
            select: {
              createdAt: true,
            },
          }),
          this.prismaService.message.findFirst({
            where: {
              id: existingLastReadMessageId,
              conversationId: params.conversationId,
              deletedAt: null,
            },
            select: {
              createdAt: true,
            },
          }),
        ]);

        if (
          incomingMessage &&
          existingMessage &&
          incomingMessage.createdAt.getTime() <= existingMessage.createdAt.getTime()
        ) {
          return;
        }
      }
    }

    await this.prismaService.messageRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      update: {
        lastReadAt: new Date(),
        lastReadMessageId: normalizedLastReadMessageId,
      },
      create: {
        conversationId: params.conversationId,
        userId: params.userId,
        lastReadMessageId: normalizedLastReadMessageId,
      },
    });
  }

  public async setUserBlock(params: {
    blockerId: string;
    blockedId: string;
    blocked: boolean;
  }): Promise<void> {
    if (params.blocked) {
      await this.prismaService.userBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: params.blockerId,
            blockedId: params.blockedId,
          },
        },
        update: {},
        create: {
          blockerId: params.blockerId,
          blockedId: params.blockedId,
        },
      });

      return;
    }

    await this.prismaService.userBlock.deleteMany({
      where: {
        blockerId: params.blockerId,
        blockedId: params.blockedId,
      },
    });
  }

  public async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const relation = await this.prismaService.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(relation);
  }

  public async isBlockedEitherWay(leftUserId: string, rightUserId: string): Promise<boolean> {
    const relation = await this.prismaService.userBlock.findFirst({
      where: {
        OR: [
          {
            blockerId: leftUserId,
            blockedId: rightUserId,
          },
          {
            blockerId: rightUserId,
            blockedId: leftUserId,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return Boolean(relation);
  }

  private toPrismaKind(kind: MessageKind): 'TEXT' | 'MEDIA' | 'SYSTEM' {
    switch (kind) {
      case MessageKind.MEDIA:
        return 'MEDIA';
      case MessageKind.SYSTEM:
        return 'SYSTEM';
      case MessageKind.TEXT:
      default:
        return 'TEXT';
    }
  }

  private toProtoKind(kind: string): MessageKind {
    switch (kind) {
      case 'MEDIA':
        return MessageKind.MEDIA;
      case 'SYSTEM':
        return MessageKind.SYSTEM;
      case 'TEXT':
      default:
        return MessageKind.TEXT;
    }
  }

  private toProtoMessage(entity: any): Message {
    return {
      id: entity.id,
      conversationId: entity.conversationId,
      authorId: entity.authorId,
      kind: this.toProtoKind(entity.kind),
      text: entity.text ?? '',
      replyToId: entity.replyToId ?? '',
      mediaKeys: entity.mediaKeys ?? [],
      createdAt: entity.createdAt.getTime(),
      editedAt: entity.editedAt ? entity.editedAt.getTime() : 0,
      deletedAt: entity.deletedAt ? entity.deletedAt.getTime() : 0,
    };
  }
}
