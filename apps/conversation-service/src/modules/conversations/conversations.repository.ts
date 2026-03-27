import { PrismaService } from '@/infra/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import {
  Conversation,
  ConversationType,
  MemberRole,
  MemberState,
} from '@repo/contracts/gen/ts/conversations';

@Injectable()
export class ConversationsRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async createConversation(params: {
    type: ConversationType;
    creatorId: string;
    title?: string;
    about?: string;
    avatarKey?: string;
    isPublic?: boolean;
    username?: string;
    memberIds?: string[];
  }): Promise<Conversation> {
    const type = this.toPrismaType(params.type);
    const uniqueMembers = [...new Set([params.creatorId, ...(params.memberIds ?? [])])];

    if (type === 'DM' && uniqueMembers.length !== 2) {
      throw new RpcException({
        code: RpcStatus.INVALID_ARGUMENT,
        details: 'DM requires exactly two unique members',
      });
    }

    const created = await this.prismaService.conversation.create({
      data: {
        type: type as any,
        ownerId: params.creatorId,
        title: params.title || null,
        about: params.about || null,
        avatarKey: params.avatarKey || null,
        isPublic: params.isPublic ?? false,
        username: params.username || null,
        discussionConversationId: null,
        discussionChannelId: null,
        members: {
          create: uniqueMembers.map((userId) => ({
            userId,
            role:
              userId === params.creatorId
                ? 'OWNER'
                : type === 'CHANNEL'
                  ? 'SUBSCRIBER'
                  : 'MEMBER',
            state: 'ACTIVE',
          })),
        },
      },
      include: {
        members: true,
      },
    });

    return this.toProtoConversation(created);
  }

  public async findDirectConversationByMembers(
    leftUserId: string,
    rightUserId: string,
  ): Promise<Conversation | null> {
    const conversation = await this.prismaService.conversation.findFirst({
      where: {
        type: 'DM',
        deletedAt: null,
        AND: [
          {
            members: {
              some: {
                userId: leftUserId,
              },
            },
          },
          {
            members: {
              some: {
                userId: rightUserId,
              },
            },
          },
        ],
      },
      include: {
        members: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return conversation ? this.toProtoConversation(conversation) : null;
  }

  public async setPublicHandle(params: {
    conversationId: string;
    username: string;
    isPublic: boolean;
  }): Promise<void> {
    await this.prismaService.conversation.update({
      where: {
        id: params.conversationId,
      },
      data: {
        isPublic: params.isPublic,
        username: params.username || null,
      },
    });
  }

  public async getConversationById(
    conversationId: string,
    viewerId?: string,
  ): Promise<Conversation | null> {
    const conversation = await this.prismaService.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: { members: true },
    });

    if (!conversation) {
      return null;
    }

    return this.toProtoConversation(conversation, viewerId);
  }

  public async getConversationByUsername(
    username: string,
    viewerId?: string,
  ): Promise<Conversation | null> {
    const normalizedUsername = username.trim().replace(/^@+/, "");
    if (!normalizedUsername) {
      return null;
    }

    const conversation = await this.prismaService.conversation.findFirst({
      where: {
        username: normalizedUsername,
        deletedAt: null,
      },
      include: { members: true },
    });

    if (!conversation) {
      return null;
    }

    return this.toProtoConversation(conversation, viewerId);
  }

  public async listByUserId(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<Conversation[]> {
    const entities = await this.prismaService.conversation.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId,
            state: 'ACTIVE',
          },
        },
      },
      include: { members: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return entities.map((entity) => this.toProtoConversation(entity, userId));
  }

  public async upsertMember(params: {
    conversationId: string;
    userId: string;
    role: MemberRole;
    state: MemberState;
  }): Promise<void> {
    await this.prismaService.conversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      update: {
        role: this.toPrismaRole(params.role),
        state: this.toPrismaState(params.state),
        leftAt: params.state === MemberState.ACTIVE ? null : new Date(),
      },
      create: {
        conversationId: params.conversationId,
        userId: params.userId,
        role: this.toPrismaRole(params.role),
        state: this.toPrismaState(params.state),
      },
    });
  }

  public async setMemberState(params: {
    conversationId: string;
    userId: string;
    state: MemberState;
  }): Promise<void> {
    await this.prismaService.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      data: {
        state: this.toPrismaState(params.state),
        leftAt: params.state === MemberState.ACTIVE ? null : new Date(),
      },
    });
  }

  public async setMemberRole(params: {
    conversationId: string;
    userId: string;
    role: MemberRole;
  }): Promise<void> {
    await this.prismaService.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      data: {
        role: this.toPrismaRole(params.role),
      },
    });
  }

  public async setMemberNotifications(params: {
    conversationId: string;
    userId: string;
    notificationsEnabled: boolean;
  }): Promise<void> {
    await this.prismaService.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: params.conversationId,
          userId: params.userId,
        },
      },
      data: {
        notificationsEnabled: params.notificationsEnabled,
      },
    });
  }

  public async updateConversation(params: {
    conversationId: string;
    title: string;
    about: string;
    isPublic: boolean;
    username: string;
    avatarKey: string;
    discussionConversationId: string;
  }): Promise<Conversation> {
    const updated = await this.prismaService.$transaction(async (tx) => {
      const existing = await tx.conversation.findFirst({
        where: {
          id: params.conversationId,
          deletedAt: null,
        },
        include: {
          members: true,
        },
      });

      if (!existing) {
        throw new RpcException({
          code: RpcStatus.NOT_FOUND,
          details: 'Conversation not found',
        });
      }

      const nextDiscussionConversationId =
        params.discussionConversationId.trim() || null;
      const previousDiscussionConversationId =
        existing.discussionConversationId?.trim() || null;

      if (
        previousDiscussionConversationId &&
        previousDiscussionConversationId !== nextDiscussionConversationId
      ) {
        await tx.conversation.updateMany({
          where: {
            id: previousDiscussionConversationId,
            deletedAt: null,
          },
          data: {
            discussionChannelId: null,
          },
        });
      }

      if (nextDiscussionConversationId) {
        await tx.conversation.updateMany({
          where: {
            discussionChannelId: params.conversationId,
            id: {
              not: nextDiscussionConversationId,
            },
          },
          data: {
            discussionChannelId: null,
          },
        });

        await tx.conversation.update({
          where: {
            id: nextDiscussionConversationId,
          },
          data: {
            discussionChannelId: params.conversationId,
          },
        });
      }

      return await tx.conversation.update({
        where: {
          id: params.conversationId,
        },
        data: {
          title: params.title || null,
          about: params.about || null,
          isPublic: params.isPublic,
          username: params.username || null,
          avatarKey: params.avatarKey || null,
          discussionConversationId: nextDiscussionConversationId,
        },
        include: {
          members: true,
        },
      });
    });

    return this.toProtoConversation(updated);
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      const existing = await tx.conversation.findFirst({
        where: {
          id: conversationId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return;
      }

      const linkedDiscussionConversationId =
        existing.discussionConversationId?.trim() || null;
      const linkedDiscussionChannelId =
        existing.discussionChannelId?.trim() || null;

      if (linkedDiscussionConversationId) {
        await tx.conversation.updateMany({
          where: {
            id: linkedDiscussionConversationId,
            deletedAt: null,
          },
          data: {
            discussionChannelId: null,
          },
        });
      }

      if (linkedDiscussionChannelId) {
        await tx.conversation.updateMany({
          where: {
            id: linkedDiscussionChannelId,
            deletedAt: null,
          },
          data: {
            discussionConversationId: null,
          },
        });
      }

      await tx.conversation.update({
        where: {
          id: conversationId,
        },
        data: {
          deletedAt: new Date(),
          username: null,
          discussionConversationId: null,
          discussionChannelId: null,
        },
      });

      await tx.conversationMember.updateMany({
        where: {
          conversationId,
          state: 'ACTIVE',
        },
        data: {
          state: 'LEFT',
          leftAt: new Date(),
        },
      });
    });
  }

  private toProtoConversation(entity: any, viewerId?: string): Conversation {
    const viewerMember = viewerId
      ? (entity.members ?? []).find((member: any) => member.userId === viewerId)
      : null;

    return {
      id: entity.id,
      type: this.toProtoType(entity.type),
      title: entity.title ?? '',
      about: entity.about ?? '',
      ownerId: entity.ownerId,
      isPublic: entity.isPublic,
      username: entity.username ?? '',
      avatarKey: entity.avatarKey ?? '',
      notificationsEnabled: viewerMember?.notificationsEnabled ?? true,
      discussionConversationId: entity.discussionConversationId ?? '',
      discussionChannelId: entity.discussionChannelId ?? '',
      members: (entity.members ?? []).map((member: any) => ({
        userId: member.userId,
        role: this.toProtoRole(member.role),
        state: this.toProtoState(member.state),
        joinedAt: member.joinedAt.getTime(),
      })),
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    };
  }

  private toPrismaType(type: ConversationType): 'DM' | 'GROUP' | 'CHANNEL' | 'SUPERGROUP' {
    switch (type) {
      case ConversationType.DM:
        return 'DM';
      case ConversationType.CHANNEL:
        return 'CHANNEL';
      case ConversationType.SUPERGROUP:
        return 'SUPERGROUP';
      case ConversationType.GROUP:
      default:
        return 'GROUP';
    }
  }

  private toProtoType(type: string): ConversationType {
    switch (type) {
      case 'DM':
        return ConversationType.DM;
      case 'CHANNEL':
        return ConversationType.CHANNEL;
      case 'SUPERGROUP':
        return ConversationType.SUPERGROUP;
      case 'GROUP':
      default:
        return ConversationType.GROUP;
    }
  }

  private toPrismaRole(role: MemberRole): 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'SUBSCRIBER' {
    switch (role) {
      case MemberRole.OWNER:
        return 'OWNER';
      case MemberRole.ADMIN:
        return 'ADMIN';
      case MemberRole.MODERATOR:
        return 'MODERATOR';
      case MemberRole.SUBSCRIBER:
        return 'SUBSCRIBER';
      case MemberRole.MEMBER:
      default:
        return 'MEMBER';
    }
  }

  private toProtoRole(role: string): MemberRole {
    switch (role) {
      case 'OWNER':
        return MemberRole.OWNER;
      case 'ADMIN':
        return MemberRole.ADMIN;
      case 'MODERATOR':
        return MemberRole.MODERATOR;
      case 'SUBSCRIBER':
        return MemberRole.SUBSCRIBER;
      case 'MEMBER':
      default:
        return MemberRole.MEMBER;
    }
  }

  private toPrismaState(state: MemberState): 'ACTIVE' | 'LEFT' | 'KICKED' | 'BANNED' | 'INVITED' {
    switch (state) {
      case MemberState.LEFT:
        return 'LEFT';
      case MemberState.KICKED:
        return 'KICKED';
      case MemberState.BANNED:
        return 'BANNED';
      case MemberState.INVITED:
        return 'INVITED';
      case MemberState.ACTIVE:
      default:
        return 'ACTIVE';
    }
  }

  private toProtoState(state: string): MemberState {
    switch (state) {
      case 'LEFT':
        return MemberState.LEFT;
      case 'KICKED':
        return MemberState.KICKED;
      case 'BANNED':
        return MemberState.BANNED;
      case 'INVITED':
        return MemberState.INVITED;
      case 'ACTIVE':
      default:
        return MemberState.ACTIVE;
    }
  }
}
