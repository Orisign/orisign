import { PrismaService } from '@/infra/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type {
  Bot as BotEntity,
  BotAuditLog as BotAuditLogEntity,
  BotCallbackQuery as BotCallbackQueryEntity,
  BotChatBinding as BotChatBindingEntity,
  BotCommand as BotCommandEntity,
  BotCredential as BotCredentialEntity,
  BotProfile as BotProfileEntity,
  BotUpdateEnvelope as BotUpdateEnvelopeEntity,
  BotWebhook as BotWebhookEntity,
  Prisma,
} from '@prisma/generated/client';
import type {
  Bot,
  BotAuditLog,
  BotChatBinding,
  BotCommand,
  BotCredential,
  BotStats,
  BotUpdateEnvelope,
  BotWebhook,
} from '@repo/contracts/gen/ts/bots';
import {
  BotChatBindingStatus,
  BotCreatedVia,
  BotCredentialStatus,
  BotDeliveryMode,
  BotPrivacyMode,
  BotStatus,
} from '@repo/contracts/gen/ts/bots';

const BOT_INCLUDE = {
  profile: true,
  webhook: true,
} satisfies Prisma.BotInclude;

type BotWithRelations = Prisma.BotGetPayload<{ include: typeof BOT_INCLUDE }>;

@Injectable()
export class BotsRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async createBot(params: {
    id: string;
    ownerUserId: string;
    botUserId: string;
    handleId?: string;
    createdVia: BotCreatedVia;
    profile: {
      displayName: string;
      username: string;
      description?: string;
      about?: string;
      shortDescription?: string;
      localeDefault?: string;
    };
    credential: {
      secretHash: string;
      secretPreview: string;
      createdByUserId: string;
    };
  }): Promise<Bot> {
    const entity = await this.prismaService.bot.create({
      data: {
        id: params.id,
        ownerUserId: params.ownerUserId,
        botUserId: params.botUserId,
        handleId: params.handleId || null,
        createdVia: params.createdVia as never,
        profile: {
          create: {
            displayName: params.profile.displayName,
            username: params.profile.username,
            description: params.profile.description || null,
            about: params.profile.about || null,
            shortDescription: params.profile.shortDescription || null,
            localeDefault: params.profile.localeDefault || null,
          },
        },
        cursor: { create: {} },
        webhook: { create: {} },
        credentials: {
          create: {
            secretHash: params.credential.secretHash,
            secretPreview: params.credential.secretPreview,
            createdByUserId: params.credential.createdByUserId,
          },
        },
      },
      include: this.defaultInclude(),
    });

    return this.toProtoBot(entity);
  }

  public async getBotById(botId: string, ownerUserId?: string) {
    const entity = await this.prismaService.bot.findFirst({
      where: {
        id: botId,
        ...(ownerUserId ? { ownerUserId } : {}),
      },
      include: this.defaultInclude(),
    });

    return entity ? this.toProtoBot(entity) : null;
  }

  public async getBotEntityById(botId: string) {
    return await this.prismaService.bot.findUnique({
      where: { id: botId },
      include: this.defaultInclude(),
    });
  }

  public async getBotByBotUserId(botUserId: string) {
    const entity = await this.prismaService.bot.findFirst({
      where: { botUserId },
      include: this.defaultInclude(),
    });

    return entity ? this.toProtoBot(entity) : null;
  }

  public async findBotByUsername(username: string) {
    return await this.prismaService.bot.findFirst({
      where: {
        profile: {
          username,
        },
      },
      include: this.defaultInclude(),
    });
  }

  public async findOwnedBotByIdentifier(ownerUserId: string, identifier: string) {
    const normalizedIdentifier = identifier.trim().replace(/^@+/, '').toLowerCase();
    if (!normalizedIdentifier) {
      return null;
    }

    const entity = await this.prismaService.bot.findFirst({
      where: {
        ownerUserId,
        OR: [
          { id: normalizedIdentifier },
          {
            profile: {
              username: normalizedIdentifier,
            },
          },
        ],
      },
      include: this.defaultInclude(),
    });

    return entity ? this.toProtoBot(entity) : null;
  }

  public async listBots(ownerUserId: string, limit: number, offset: number, statuses: BotStatus[]) {
    const entities = await this.prismaService.bot.findMany({
      where: {
        ownerUserId,
        ...(statuses.length > 0
          ? {
              status: {
                in: statuses as never[],
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: this.defaultInclude(),
    });

    return entities.map((entity) => this.toProtoBot(entity));
  }

  public async updateBot(botId: string, data: Prisma.BotUpdateInput) {
    const entity = await this.prismaService.bot.update({
      where: { id: botId },
      data,
      include: this.defaultInclude(),
    });

    return this.toProtoBot(entity);
  }

  public async softDeleteBot(botId: string) {
    return await this.prismaService.bot.update({
      where: { id: botId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        version: { increment: 1 },
      },
      include: this.defaultInclude(),
    });
  }

  public async revokeActiveCredentials(botId: string) {
    await this.prismaService.botCredential.updateMany({
      where: { botId, status: 'CREDENTIAL_ACTIVE' },
      data: { status: 'CREDENTIAL_REVOKED', revokedAt: new Date() },
    });
  }

  public async createCredential(botId: string, secretHash: string, secretPreview: string, ownerUserId: string) {
    const entity = await this.prismaService.botCredential.create({
      data: { botId, secretHash, secretPreview, createdByUserId: ownerUserId },
    });

    return this.toProtoCredential(entity);
  }

  public async getActiveCredentialEntity(botId: string) {
    return await this.prismaService.botCredential.findFirst({
      where: { botId, status: 'CREDENTIAL_ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async touchCredential(credentialId: string) {
    await this.prismaService.botCredential.update({
      where: { id: credentialId },
      data: { lastUsedAt: new Date() },
    });
  }

  public async upsertWebhook(botId: string, data: {
    url?: string | null;
    secret?: string | null;
    allowedUpdates?: string[];
    maxConnections?: number;
    ipAllowlist?: string[];
    isEnabled?: boolean;
    lastErrorMessage?: string | null;
    lastErrorAt?: Date | null;
    lastSuccessAt?: Date | null;
  }) {
    const entity = await this.prismaService.botWebhook.upsert({
      where: { botId },
      create: {
        botId,
        url: data.url || null,
        secret: data.secret || null,
        allowedUpdates: data.allowedUpdates ?? [],
        maxConnections: data.maxConnections ?? 1,
        ipAllowlist: data.ipAllowlist ?? [],
        isEnabled: data.isEnabled ?? false,
        lastErrorMessage: data.lastErrorMessage ?? null,
        lastErrorAt: data.lastErrorAt ?? null,
        lastSuccessAt: data.lastSuccessAt ?? null,
      },
      update: {
        url: data.url !== undefined ? data.url : undefined,
        secret: data.secret !== undefined ? data.secret : undefined,
        allowedUpdates: data.allowedUpdates !== undefined ? data.allowedUpdates : undefined,
        maxConnections: data.maxConnections !== undefined ? data.maxConnections : undefined,
        ipAllowlist: data.ipAllowlist !== undefined ? data.ipAllowlist : undefined,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : undefined,
        lastErrorMessage: data.lastErrorMessage !== undefined ? data.lastErrorMessage : undefined,
        lastErrorAt: data.lastErrorAt !== undefined ? data.lastErrorAt : undefined,
        lastSuccessAt: data.lastSuccessAt !== undefined ? data.lastSuccessAt : undefined,
      },
    });

    return this.toProtoWebhook(entity);
  }

  public async getWebhook(botId: string) {
    const entity = await this.prismaService.botWebhook.findUnique({ where: { botId } });
    return entity ? this.toProtoWebhook(entity) : null;
  }

  public async replaceCommands(botId: string, commands: Array<{
    scope: string;
    chatId?: string;
    command: string;
    description: string;
    locale?: string;
  }>) {
    await this.prismaService.$transaction(async (tx) => {
      await tx.botCommand.deleteMany({ where: { botId } });
      if (commands.length > 0) {
        await tx.botCommand.createMany({
          data: commands.map((command) => ({
            botId,
            scope: command.scope,
            chatId: command.chatId || null,
            command: command.command,
            description: command.description,
            locale: command.locale || null,
          })),
        });
      }
    });
  }

  public async getCommands(botId: string) {
    const entities = await this.prismaService.botCommand.findMany({
      where: { botId },
      orderBy: { command: 'asc' },
    });
    return entities.map((entity) => this.toProtoCommand(entity));
  }

  public async upsertChatBinding(botId: string, chatId: string, status: BotChatBindingStatus, flags?: {
    isExplicitAllow?: boolean;
    isExplicitDeny?: boolean;
  }) {
    const entity = await this.prismaService.botChatBinding.upsert({
      where: { botId_chatId: { botId, chatId } },
      create: {
        botId,
        chatId,
        status: status as never,
        isExplicitAllow: Boolean(flags?.isExplicitAllow),
        isExplicitDeny: Boolean(flags?.isExplicitDeny),
        joinedAt: new Date(),
      },
      update: {
        status: status as never,
        isExplicitAllow: flags?.isExplicitAllow ?? false,
        isExplicitDeny: flags?.isExplicitDeny ?? false,
        version: { increment: 1 },
      },
    });
    return this.toProtoChatBinding(entity);
  }

  public async listChatBindings(botId: string, limit: number, offset: number) {
    const entities = await this.prismaService.botChatBinding.findMany({
      where: { botId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return entities.map((entity) => this.toProtoChatBinding(entity));
  }

  public async getChatBinding(botId: string, chatId: string) {
    const entity = await this.prismaService.botChatBinding.findUnique({
      where: { botId_chatId: { botId, chatId } },
    });
    return entity ? this.toProtoChatBinding(entity) : null;
  }

  public async getBotStats(botId: string): Promise<BotStats> {
    const [cursor, totalUpdates, webhookSuccessCount, webhookFailureCount, allowedChatCount, deniedChatCount, lastUpdate] =
      await Promise.all([
        this.prismaService.botDeliveryCursor.findUnique({ where: { botId } }),
        this.prismaService.botUpdateEnvelope.count({ where: { botId } }),
        this.prismaService.botDeliveryAttempt.count({ where: { botId, status: 'SUCCESS' } }),
        this.prismaService.botDeliveryAttempt.count({ where: { botId, status: 'FAILED' } }),
        this.prismaService.botChatBinding.count({ where: { botId, status: 'ALLOWED' } }),
        this.prismaService.botChatBinding.count({ where: { botId, status: 'DENIED' } }),
        this.prismaService.botUpdateEnvelope.findFirst({
          where: { botId },
          orderBy: { updateId: 'desc' },
        }),
      ]);

    const lastAckUpdateId = cursor
      ? cursor.pollingAckUpdateId > cursor.webhookAckUpdateId
        ? cursor.pollingAckUpdateId
        : cursor.webhookAckUpdateId
      : BigInt(0);

    const pendingUpdates = await this.prismaService.botUpdateEnvelope.count({
      where: {
        botId,
        updateId: { gt: lastAckUpdateId },
      },
    });

    return {
      botId,
      totalUpdates,
      pendingUpdates,
      webhookSuccessCount,
      webhookFailureCount,
      allowedChatCount,
      deniedChatCount,
      lastUpdateAt: lastUpdate ? lastUpdate.createdAt.getTime() : 0,
      lastDeliveryAt: cursor?.lastDeliveredAt ? cursor.lastDeliveredAt.getTime() : 0,
    };
  }

  public async listAuditLogs(botId: string, ownerUserId: string, limit: number, offset: number): Promise<BotAuditLog[]> {
    const entities = await this.prismaService.botAuditLog.findMany({
      where: {
        botId,
        ownerUserId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return entities.map((entity) => this.toProtoAuditLog(entity));
  }

  public async createUpdate(botId: string, params: {
    eventType: string;
    sourceEventKey: string;
    traceId?: string;
    payloadJson: string;
    allowedForWebhook?: boolean;
    allowedForPolling?: boolean;
  }) {
    const entity = await this.prismaService.botUpdateEnvelope.create({
      data: {
        botId,
        eventType: params.eventType,
        sourceEventKey: params.sourceEventKey,
        traceId: params.traceId || null,
        payloadJson: params.payloadJson,
        allowedForWebhook: params.allowedForWebhook ?? true,
        allowedForPolling: params.allowedForPolling ?? true,
      },
    });
    return this.toProtoUpdate(entity);
  }

  public async bumpUpdateDeliveryAttempt(botId: string, updateId: bigint, attempt: number) {
    await this.prismaService.botUpdateEnvelope.updateMany({
      where: { botId, updateId },
      data: { deliveryAttempt: attempt },
    });
  }

  public async listUpdates(botId: string, offset: bigint, limit: number, allowedUpdates: string[]) {
    const entities = await this.prismaService.botUpdateEnvelope.findMany({
      where: {
        botId,
        updateId: { gte: offset },
        allowedForPolling: true,
        ...(allowedUpdates.length > 0 ? { eventType: { in: allowedUpdates } } : {}),
      },
      orderBy: { updateId: 'asc' },
      take: limit,
    });
    return entities.map((entity) => this.toProtoUpdate(entity));
  }

  public async touchPollingCursor(botId: string, ackUpdateId: bigint) {
    await this.prismaService.botDeliveryCursor.upsert({
      where: { botId },
      create: { botId, pollingAckUpdateId: ackUpdateId },
      update: { pollingAckUpdateId: ackUpdateId },
    });
  }

  public async touchWebhookCursor(botId: string, ackUpdateId: bigint) {
    await this.prismaService.botDeliveryCursor.upsert({
      where: { botId },
      create: { botId, webhookAckUpdateId: ackUpdateId, lastDeliveredAt: new Date() },
      update: { webhookAckUpdateId: ackUpdateId, lastDeliveredAt: new Date() },
    });
  }

  public async createDeliveryAttempt(botId: string, updateId: bigint, mode: string, status: string, data?: {
    attemptNo?: number;
    responseCode?: number;
    errorCode?: string;
    errorMessage?: string;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  }) {
    await this.prismaService.botDeliveryAttempt.create({
      data: {
        botId,
        updateId,
        mode,
        status,
        attemptNo: data?.attemptNo ?? 1,
        responseCode: data?.responseCode,
        errorCode: data?.errorCode,
        errorMessage: data?.errorMessage,
        startedAt: data?.startedAt ?? null,
        finishedAt: data?.finishedAt ?? null,
      },
    });
  }

  public async upsertSession(botId: string, chatId: string, userId: string, scope: string, data: {
    scene: string;
    step: string;
    stateJson?: string;
    locale?: string;
    expiresAt: Date;
  }) {
    return await this.prismaService.botSession.upsert({
      where: { botId_chatId_userId_scope: { botId, chatId, userId, scope } },
      create: {
        botId,
        chatId,
        userId,
        scope,
        scene: data.scene,
        step: data.step,
        stateJson: data.stateJson || null,
        locale: data.locale || null,
        expiresAt: data.expiresAt,
      },
      update: {
        scene: data.scene,
        step: data.step,
        stateJson: data.stateJson !== undefined ? data.stateJson : undefined,
        locale: data.locale !== undefined ? data.locale : undefined,
        expiresAt: data.expiresAt,
        version: { increment: 1 },
      },
    });
  }

  public async getSession(botId: string, chatId: string, userId: string, scope: string) {
    return await this.prismaService.botSession.findUnique({
      where: { botId_chatId_userId_scope: { botId, chatId, userId, scope } },
    });
  }

  public async deleteSession(botId: string, chatId: string, userId: string, scope: string) {
    await this.prismaService.botSession.deleteMany({
      where: { botId, chatId, userId, scope },
    });
  }

  public async answerCallbackQuery(botId: string, callbackQueryId: string) {
    await this.prismaService.botCallbackQuery.updateMany({
      where: { botId, callbackQueryId },
      data: { status: 'ANSWERED', answeredAt: new Date() },
    });
  }

  public async createCallbackQuery(params: {
    botId: string;
    callbackQueryId: string;
    chatId: string;
    messageId?: string;
    fromUserId: string;
    data: string;
    payloadJson?: string;
  }) {
    const entity = await this.prismaService.botCallbackQuery.create({
      data: {
        botId: params.botId,
        callbackQueryId: params.callbackQueryId,
        chatId: params.chatId,
        messageId: params.messageId || null,
        fromUserId: params.fromUserId,
        data: params.data,
        payloadJson: params.payloadJson || null,
      },
    });

    return this.toProtoCallbackQuery(entity);
  }

  public async createAuditLog(params: {
    botId?: string;
    ownerUserId?: string;
    actorType: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    payloadJson?: string;
    traceId?: string;
  }) {
    await this.prismaService.botAuditLog.create({
      data: {
        botId: params.botId || null,
        ownerUserId: params.ownerUserId || null,
        actorType: params.actorType,
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        payloadJson: params.payloadJson || null,
        traceId: params.traceId || null,
      },
    });
  }

  private defaultInclude() {
    return BOT_INCLUDE;
  }

  public toProtoBot(entity: BotWithRelations): Bot {
    return {
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      botUserId: entity.botUserId,
      handleId: entity.handleId ?? '',
      status: entity.status as BotStatus,
      deliveryMode: entity.deliveryMode as BotDeliveryMode,
      privacyMode: entity.privacyMode as BotPrivacyMode,
      createdVia: entity.createdVia as BotCreatedVia,
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
      deletedAt: entity.deletedAt ? entity.deletedAt.getTime() : 0,
      version: entity.version,
      profile: entity.profile ? this.toProtoProfile(entity.profile) : undefined,
      webhook: entity.webhook ? this.toProtoWebhook(entity.webhook) : undefined,
    };
  }

  public toProtoProfile(entity: BotProfileEntity) {
    return {
      botId: entity.botId,
      displayName: entity.displayName,
      username: entity.username ?? '',
      description: entity.description ?? '',
      about: entity.about ?? '',
      shortDescription: entity.shortDescription ?? '',
      avatarFileId: entity.avatarFileId ?? '',
      avatarUrl: entity.avatarUrl ?? '',
      localeDefault: entity.localeDefault ?? '',
      allowedChatTypes: entity.allowedChatTypes ?? [],
      metadataJson: entity.metadataJson ?? '',
    };
  }

  public toProtoCredential(entity: BotCredentialEntity): BotCredential {
    return {
      id: entity.id,
      botId: entity.botId,
      secretPreview: entity.secretPreview,
      status: entity.status as BotCredentialStatus,
      createdAt: entity.createdAt.getTime(),
      revokedAt: entity.revokedAt ? entity.revokedAt.getTime() : 0,
      createdByUserId: entity.createdByUserId ?? '',
      lastUsedAt: entity.lastUsedAt ? entity.lastUsedAt.getTime() : 0,
    };
  }

  public toProtoWebhook(entity: BotWebhookEntity): BotWebhook {
    return {
      botId: entity.botId,
      url: entity.url ?? '',
      allowedUpdates: entity.allowedUpdates ?? [],
      maxConnections: entity.maxConnections ?? 1,
      ipAllowlist: entity.ipAllowlist ?? [],
      isEnabled: Boolean(entity.isEnabled),
      lastErrorAt: entity.lastErrorAt ? entity.lastErrorAt.getTime() : 0,
      lastErrorMessage: entity.lastErrorMessage ?? '',
      lastSuccessAt: entity.lastSuccessAt ? entity.lastSuccessAt.getTime() : 0,
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    };
  }

  public toProtoCommand(entity: BotCommandEntity): BotCommand {
    return {
      id: entity.id,
      botId: entity.botId,
      scope: entity.scope,
      chatId: entity.chatId ?? '',
      command: entity.command,
      description: entity.description,
      locale: entity.locale ?? '',
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    };
  }

  public toProtoChatBinding(entity: BotChatBindingEntity): BotChatBinding {
    return {
      id: entity.id,
      botId: entity.botId,
      chatId: entity.chatId,
      status: entity.status as BotChatBindingStatus,
      joinedAt: entity.joinedAt ? entity.joinedAt.getTime() : 0,
      leftAt: entity.leftAt ? entity.leftAt.getTime() : 0,
      permissionsJson: entity.permissionsJson ?? '',
      isExplicitAllow: entity.isExplicitAllow,
      isExplicitDeny: entity.isExplicitDeny,
      version: entity.version,
    };
  }

  public toProtoUpdate(entity: BotUpdateEnvelopeEntity): BotUpdateEnvelope {
    return {
      id: entity.id,
      botId: entity.botId,
      updateId: Number(entity.updateId),
      eventType: entity.eventType,
      sourceEventKey: entity.sourceEventKey,
      traceId: entity.traceId ?? '',
      payloadJson: entity.payloadJson,
      deliveryAttempt: entity.deliveryAttempt,
      createdAt: entity.createdAt.getTime(),
    };
  }

  public toProtoAuditLog(entity: BotAuditLogEntity): BotAuditLog {
    return {
      id: entity.id,
      botId: entity.botId ?? '',
      ownerUserId: entity.ownerUserId ?? '',
      actorType: entity.actorType,
      actorId: entity.actorId,
      action: entity.action,
      targetType: entity.targetType,
      targetId: entity.targetId,
      payloadJson: entity.payloadJson ?? '',
      traceId: entity.traceId ?? '',
      createdAt: entity.createdAt.getTime(),
    };
  }

  private toProtoCallbackQuery(entity: BotCallbackQueryEntity) {
    return {
      id: entity.id,
      botId: entity.botId,
      callbackQueryId: entity.callbackQueryId,
      chatId: entity.chatId,
      messageId: entity.messageId ?? '',
      fromUserId: entity.fromUserId,
      data: entity.data,
      payloadJson: entity.payloadJson ?? '',
      status: entity.status,
      createdAt: entity.createdAt.getTime(),
      answeredAt: entity.answeredAt ? entity.answeredAt.getTime() : 0,
    };
  }

}
