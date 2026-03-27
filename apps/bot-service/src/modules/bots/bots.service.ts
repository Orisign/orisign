import { ConversationsClientService } from '@/infra/grpc/conversations-client.service';
import { HandlesClientService } from '@/infra/grpc/handles-client.service';
import { MessagesClientService } from '@/infra/grpc/messages-client.service';
import { UsersClientService } from '@/infra/grpc/users-client.service';
import { GatewayRealtimeService } from '@/infra/http/gateway-realtime.service';
import { UpdateWaitersService } from '@/infra/redis/update-waiters.service';
import {
  DISPATCH_ROUTING_KEY,
  WEBHOOK_ROUTING_KEY,
} from '@/infra/rmq/rmq.constants';
import { RmqService } from '@/infra/rmq/rmq.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcStatus } from '@repo/common';
import type {
  Bot,
  AnswerCallbackQueryRequest,
  AuthenticateBotTokenRequest,
  AuthenticateBotTokenResponse,
  BotMutationRequest,
  ConsumeExternalEventRequest,
  CreateBotRequest,
  CreateBotResponse,
  DeleteBotRequest,
  DeleteBotMessageRequest,
  EditBotMessageReplyMarkupRequest,
  EditBotMessageTextRequest,
  GetBotCommandsRequest,
  GetBotCommandsResponse,
  GetBotMeRequest,
  GetBotMeResponse,
  GetBotRequest,
  GetBotResponse,
  GetBotStatsResponse,
  GetBotWebhookInfoResponse,
  GetUpdatesRequest,
  GetUpdatesResponse,
  ListBotChatsRequest,
  ListBotChatsResponse,
  ListBotAuditLogsRequest,
  ListBotAuditLogsResponse,
  ListBotsRequest,
  ListBotsResponse,
  MutationResponse,
  RevokeBotTokenRequest,
  RotateBotTokenRequest,
  RotateBotTokenResponse,
  SendBotMessageRequest,
  SendBotMessageResponse,
  SetBotCommandsRequest,
  SetBotWebhookRequest,
  UpdateBotRequest,
} from '@repo/contracts/gen/ts/bots';
import {
  BotChatBindingStatus,
  BotCreatedVia,
  BotDeliveryMode,
  BotPrivacyMode,
  BotStatus,
} from '@repo/contracts/gen/ts/bots';
import { HandleKind } from '@repo/contracts/gen/ts/handles';
import { MessageKind } from '@repo/contracts/gen/ts/messages';
import axios from 'axios';
import { createHmac, randomUUID } from 'crypto';
import { BotsRepository } from './bots.repository';
import { generateBotId, generateBotUserId, generateSecretKey, hashSecret, verifySecret } from '../credentials/credential.utils';
import type { ExternalEventJob, WebhookDeliveryJob } from '../delivery/delivery.types';

const BOT_FATHER_USERNAME = 'botfatherbot';
const BOT_FATHER_DISPLAY_NAME = 'BotFather';
const BOT_FATHER_SCOPE = 'BOT_FATHER';
const BOT_FATHER_SESSION_TTL_MS = 30 * 60 * 1000;

type BotFatherSessionSnapshot = {
  scene: string;
  step: string;
  stateJson: string | null;
};

type BotFatherPanelOptions = {
  ownerUserId?: string;
  locale?: string;
  session?: BotFatherSessionSnapshot | null;
  scene?: string;
  step?: string;
  state?: Record<string, unknown>;
  targetMessageId?: string;
  allowPanelReuse?: boolean;
};

@Injectable()
export class BotsService implements OnModuleInit {
  private readonly logger = new Logger(BotsService.name);
  private botFatherSeedPromise: Promise<void> | null = null;
  private botFatherRetryTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(
    private readonly repository: BotsRepository,
    private readonly handlesClient: HandlesClientService,
    private readonly usersClient: UsersClientService,
    private readonly messagesClient: MessagesClientService,
    private readonly conversationsClient: ConversationsClientService,
    private readonly gatewayRealtimeService: GatewayRealtimeService,
    private readonly updateWaitersService: UpdateWaitersService,
    private readonly rmqService: RmqService,
  ) {}

  public async onModuleInit() {
    void this.ensureBotFatherWithRetry();
  }

  public async createBot(data: CreateBotRequest): Promise<CreateBotResponse> {
    if (!data.ownerUserId?.trim()) {
      throw new RpcException({ code: RpcStatus.INVALID_ARGUMENT, details: 'ownerUserId is required' });
    }

    const createdVia =
      data.createdVia &&
      data.createdVia !== BotCreatedVia.BOT_CREATED_VIA_UNSPECIFIED &&
      data.createdVia !== BotCreatedVia.UNRECOGNIZED
        ? data.createdVia
        : BotCreatedVia.INTERNAL_API;

    return await this.createBotForOwner({
      ownerUserId: data.ownerUserId,
      displayName: data.displayName,
      username: data.username,
      description: data.description,
      about: data.about,
      shortDescription: data.shortDescription,
      localeDefault: data.localeDefault,
        createdVia,
      traceId: data.traceId,
    });
  }

  public async listBots(data: ListBotsRequest): Promise<ListBotsResponse> {
    return {
      bots: await this.repository.listBots(
        data.ownerUserId,
        data.limit > 0 ? data.limit : 30,
        data.offset > 0 ? data.offset : 0,
          (data.statuses ?? []).filter(
            (status) =>
              status !== BotStatus.BOT_STATUS_UNSPECIFIED &&
              status !== BotStatus.UNRECOGNIZED,
          ),
      ),
    };
  }

  public async getBot(data: GetBotRequest): Promise<GetBotResponse> {
    return { bot: await this.getOwnedBot(data.botId, data.ownerUserId) };
  }

  public async getBotByUserId(data: { botUserId: string }): Promise<GetBotResponse> {
    if (!data.botUserId?.trim()) {
      return { bot: undefined };
    }

    return {
      bot: (await this.repository.getBotByBotUserId(data.botUserId)) ?? undefined,
    };
  }

  public async getBotStats(data: BotMutationRequest): Promise<GetBotStatsResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    return { stats: await this.repository.getBotStats(data.botId) };
  }

  public async listBotAuditLogs(data: ListBotAuditLogsRequest): Promise<ListBotAuditLogsResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    return {
      logs: await this.repository.listAuditLogs(
        data.botId,
        data.ownerUserId,
        data.limit > 0 ? data.limit : 50,
        data.offset > 0 ? data.offset : 0,
      ),
    };
  }

  public async updateBot(data: UpdateBotRequest): Promise<MutationResponse> {
    const bot = await this.getOwnedBot(data.botId, data.ownerUserId);
    const nextUsername = (data.username ?? '').trim().replace(/^@+/, '').toLowerCase();
    const currentUsername = bot.profile?.username?.trim().replace(/^@+/, '').toLowerCase() ?? '';
    if (nextUsername && nextUsername !== currentUsername) {
      await this.handlesClient.reserveHandle({
        username: nextUsername,
        kind: HandleKind.BOT,
        targetId: data.botId,
        actorId: data.ownerUserId,
        traceId: data.traceId ?? '',
        allowReplaceSameTarget: true,
      });
    }

    await this.repository.updateBot(data.botId, {
      deliveryMode:
        data.deliveryMode &&
        data.deliveryMode !== BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED &&
        data.deliveryMode !== BotDeliveryMode.UNRECOGNIZED
          ? data.deliveryMode
          : undefined,
      privacyMode:
        data.privacyMode &&
        data.privacyMode !== BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED &&
        data.privacyMode !== BotPrivacyMode.UNRECOGNIZED
          ? data.privacyMode
          : undefined,
      version: { increment: 1 },
      profile: {
        update: {
          displayName: data.displayName || undefined,
          username: nextUsername || undefined,
          description: data.description !== undefined ? data.description : undefined,
          about: data.about !== undefined ? data.about : undefined,
          shortDescription: data.shortDescription !== undefined ? data.shortDescription : undefined,
          avatarFileId: data.avatarFileId !== undefined ? data.avatarFileId : undefined,
          avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : undefined,
          localeDefault: data.localeDefault !== undefined ? data.localeDefault : undefined,
        },
      },
    });

    if (nextUsername && nextUsername !== currentUsername && currentUsername) {
      await this.handlesClient.releaseHandle({
        username: currentUsername,
        targetId: data.botId,
        kind: HandleKind.BOT,
        actorId: data.ownerUserId,
        traceId: data.traceId ?? '',
      });
    }

    await this.syncBotProjectionUser(
      bot.botUserId,
      data.displayName || bot.profile?.displayName || BOT_FATHER_DISPLAY_NAME,
      nextUsername || currentUsername || bot.profile?.username || BOT_FATHER_USERNAME,
    );

    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.updated',
      targetType: 'BOT',
      targetId: data.botId,
      payload: {
        displayName: data.displayName ?? '',
        username: nextUsername || currentUsername,
        deliveryMode: data.deliveryMode,
        privacyMode: data.privacyMode,
      },
      traceId: data.traceId,
    });

    return { ok: true };
  }

  public async deleteBot(data: DeleteBotRequest): Promise<MutationResponse> {
    const bot = await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.softDeleteBot(data.botId);
    await this.repository.revokeActiveCredentials(data.botId);

    const username = bot.profile?.username?.trim().replace(/^@+/, '').toLowerCase();
    if (username) {
      await this.handlesClient.releaseHandle({
        username,
        kind: HandleKind.BOT,
        targetId: bot.id,
        actorId: data.ownerUserId,
        traceId: data.traceId ?? '',
      });
    }

    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.deleted',
      targetType: 'BOT',
      targetId: data.botId,
      payload: { username },
      traceId: data.traceId,
    });

    return { ok: true };
  }

  public async regenerateBotToken(data: RotateBotTokenRequest): Promise<RotateBotTokenResponse> {
    const bot = await this.getOwnedBot(data.botId, data.ownerUserId);
    const secretKey = generateSecretKey();
    const secretPreview = secretKey.slice(-6);

    await this.repository.revokeActiveCredentials(bot.id);
    await this.repository.createCredential(bot.id, hashSecret(secretKey), secretPreview, data.ownerUserId);
    await this.repository.updateBot(bot.id, { status: 'ACTIVE' });
    await this.recordAuditLog({
      botId: bot.id,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.token.regenerated',
      targetType: 'BOT_CREDENTIAL',
      targetId: bot.id,
      payload: { secretPreview },
      traceId: data.traceId,
    });

    return { ok: true, token: { value: `${bot.id}:${secretKey}`, botId: bot.id, secretPreview } };
  }

  public async revokeBotToken(data: RevokeBotTokenRequest): Promise<MutationResponse> {
    const bot = await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.revokeActiveCredentials(bot.id);
    await this.repository.updateBot(bot.id, { status: 'REVOKED' });
    await this.recordAuditLog({
      botId: bot.id,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.token.revoked',
      targetType: 'BOT_CREDENTIAL',
      targetId: bot.id,
      traceId: data.traceId,
    });
    return { ok: true };
  }

  public async enableBot(data: BotMutationRequest): Promise<MutationResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.updateBot(data.botId, { status: 'ACTIVE' });
    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.enabled',
      targetType: 'BOT',
      targetId: data.botId,
      traceId: data.traceId,
    });
    return { ok: true };
  }

  public async disableBot(data: BotMutationRequest): Promise<MutationResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.updateBot(data.botId, { status: 'DISABLED' });
    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.disabled',
      targetType: 'BOT',
      targetId: data.botId,
      traceId: data.traceId,
    });
    return { ok: true };
  }

  public async setBotWebhook(data: SetBotWebhookRequest): Promise<MutationResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.upsertWebhook(data.botId, {
      url: data.url,
      secret: generateSecretKey(),
      allowedUpdates: data.allowedUpdates ?? [],
      maxConnections: data.maxConnections > 0 ? data.maxConnections : 1,
      ipAllowlist: data.ipAllowlist ?? [],
      isEnabled: Boolean(data.isEnabled && data.url),
    });
    await this.repository.updateBot(data.botId, { deliveryMode: data.isEnabled ? 'WEBHOOK' : 'POLLING' });
    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.webhook.updated',
      targetType: 'BOT_WEBHOOK',
      targetId: data.botId,
      payload: { url: data.url, allowedUpdates: data.allowedUpdates ?? [], enabled: data.isEnabled },
      traceId: data.traceId,
    });
    return { ok: true };
  }

  public async deleteBotWebhook(data: BotMutationRequest): Promise<MutationResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.upsertWebhook(data.botId, {
      url: null,
      secret: null,
      isEnabled: false,
      allowedUpdates: [],
      ipAllowlist: [],
      maxConnections: 1,
    });
    await this.repository.updateBot(data.botId, { deliveryMode: 'POLLING' });
    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.webhook.deleted',
      targetType: 'BOT_WEBHOOK',
      targetId: data.botId,
      traceId: data.traceId,
    });
    return { ok: true };
  }

  public async getBotWebhookInfo(data: BotMutationRequest): Promise<GetBotWebhookInfoResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    const webhook = await this.repository.getWebhook(data.botId);
    return { webhook: webhook ?? undefined };
  }

  public async setBotCommands(data: SetBotCommandsRequest): Promise<MutationResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.replaceCommands(data.botId, (data.commands ?? []).map((command) => ({
      scope: command.scope,
      chatId: command.chatId,
      command: command.command,
      description: command.description,
      locale: command.locale,
    })));
    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.commands.updated',
      targetType: 'BOT_COMMAND',
      targetId: data.botId,
      payload: { count: data.commands?.length ?? 0 },
      traceId: data.traceId,
    });
    return { ok: true };
  }

  public async getBotCommands(data: GetBotCommandsRequest): Promise<GetBotCommandsResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    return { commands: await this.repository.getCommands(data.botId) };
  }

  public async listBotChats(data: ListBotChatsRequest): Promise<ListBotChatsResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    return {
      chats: await this.repository.listChatBindings(data.botId, data.limit > 0 ? data.limit : 30, data.offset > 0 ? data.offset : 0),
    };
  }

  public async allowBotChat(data: { botId: string; ownerUserId: string; chatId: string }): Promise<MutationResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.upsertChatBinding(data.botId, data.chatId, BotChatBindingStatus.ALLOWED, { isExplicitAllow: true, isExplicitDeny: false });
    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.chat.allowed',
      targetType: 'CHAT',
      targetId: data.chatId,
    });
    return { ok: true };
  }

  public async denyBotChat(data: { botId: string; ownerUserId: string; chatId: string }): Promise<MutationResponse> {
    await this.getOwnedBot(data.botId, data.ownerUserId);
    await this.repository.upsertChatBinding(data.botId, data.chatId, BotChatBindingStatus.DENIED, { isExplicitAllow: false, isExplicitDeny: true });
    await this.recordAuditLog({
      botId: data.botId,
      ownerUserId: data.ownerUserId,
      actorType: 'OWNER',
      actorId: data.ownerUserId,
      action: 'bot.chat.denied',
      targetType: 'CHAT',
      targetId: data.chatId,
    });
    return { ok: true };
  }

  public async authenticateBotToken(data: AuthenticateBotTokenRequest): Promise<AuthenticateBotTokenResponse> {
    const { bot, credential } = await this.requireAuthenticatedBot(data.token);
    return { ok: true, bot, credential };
  }

  public async getBotMe(data: GetBotMeRequest): Promise<GetBotMeResponse> {
    const { bot } = await this.requireAuthenticatedBot(data.token);
    return { bot };
  }

  public async sendMessage(data: SendBotMessageRequest): Promise<SendBotMessageResponse> {
    const { bot } = await this.requireAuthenticatedBot(data.token);
    await this.assertBotCanSend(bot, data.chatId);
    const response = await this.messagesClient.sendMessage({
      conversationId: data.chatId,
      authorId: bot.botUserId,
      kind: (data.mediaKeys?.length ?? 0) > 0 ? MessageKind.MEDIA : MessageKind.TEXT,
      text: data.text ?? '',
      replyToId: data.replyToMessageId ?? '',
      mediaKeys: data.mediaKeys ?? [],
      entitiesJson: data.entitiesJson ?? '',
      replyMarkupJson: data.replyMarkupJson ?? '',
      attachmentsJson: '',
      sourceBotId: bot.id,
      metadataJson: data.parseMode ? JSON.stringify({ parseMode: data.parseMode }) : '',
    });

    if (response.ok && response.message) {
      await this.gatewayRealtimeService.emitMessageCreated(
        response.message,
        bot.botUserId,
      );
    }

    return { ok: Boolean(response.ok), messageId: response.message?.id ?? '', conversationId: response.message?.conversationId ?? data.chatId };
  }

  public async editMessageText(data: EditBotMessageTextRequest): Promise<MutationResponse> {
    const { bot } = await this.requireAuthenticatedBot(data.token);
    await this.messagesClient.editMessage({
      actorId: bot.botUserId,
      messageId: data.messageId,
      text: data.text ?? '',
        replyMarkupJson: data.replyMarkupJson ?? '',
        entitiesJson: data.entitiesJson ?? '',
        metadataJson: data.parseMode ? JSON.stringify({ parseMode: data.parseMode }) : '',
      });

    await this.gatewayRealtimeService.emitMessageUpdated({
      conversationId: data.chatId,
      messageId: data.messageId,
      text: data.text ?? '',
      editedAt: Date.now(),
      actorId: bot.botUserId,
    });

    return { ok: true };
  }

  public async editMessageReplyMarkup(data: EditBotMessageReplyMarkupRequest): Promise<MutationResponse> {
    const { bot } = await this.requireAuthenticatedBot(data.token);
    await this.messagesClient.editMessage({
        actorId: bot.botUserId,
        messageId: data.messageId,
        text: '',
        replyMarkupJson: data.replyMarkupJson ?? '',
        entitiesJson: '',
        metadataJson: '',
      });

    await this.gatewayRealtimeService.emitMessageUpdated({
      conversationId: data.chatId,
      messageId: data.messageId,
      replyMarkupJson: data.replyMarkupJson ?? '',
      editedAt: Date.now(),
      actorId: bot.botUserId,
      reason: 'bot.message.reply-markup.updated',
    });

    return { ok: true };
  }

  public async deleteMessage(data: DeleteBotMessageRequest): Promise<MutationResponse> {
    const { bot } = await this.requireAuthenticatedBot(data.token);
    await this.messagesClient.deleteMessage({ actorId: bot.botUserId, messageId: data.messageId });

    await this.gatewayRealtimeService.emitMessageDeleted({
      conversationId: data.chatId,
      messageId: data.messageId,
      deletedAt: Date.now(),
      actorId: bot.botUserId,
    });

    return { ok: true };
  }

  public async answerCallbackQuery(data: AnswerCallbackQueryRequest): Promise<MutationResponse> {
    const { bot } = await this.requireAuthenticatedBot(data.token);
    await this.repository.answerCallbackQuery(bot.id, data.callbackQueryId);
    return { ok: true };
  }

  public async getUpdates(data: GetUpdatesRequest): Promise<GetUpdatesResponse> {
    const { bot } = await this.requireAuthenticatedBot(data.token);
    const webhook = await this.repository.getWebhook(bot.id);
    if (webhook?.isEnabled) {
      throw new RpcException({ code: RpcStatus.FAILED_PRECONDITION, details: 'Webhook is enabled; delete webhook before polling' });
    }

    const offset = BigInt(Math.max(data.offset ?? 0, 0));
    const limit = Math.min(Math.max(data.limit ?? 30, 1), 100);
    const timeoutSeconds = Math.min(Math.max(data.timeout ?? 0, 0), 50);
    let updates = await this.repository.listUpdates(bot.id, offset, limit, data.allowedUpdates ?? []);

    if (updates.length === 0 && timeoutSeconds > 0) {
      await this.updateWaitersService.waitForUpdate(bot.id, timeoutSeconds * 1000);
      updates = await this.repository.listUpdates(bot.id, offset, limit, data.allowedUpdates ?? []);
    }

    if (offset > BigInt(0)) {
      await this.repository.touchPollingCursor(bot.id, offset - BigInt(1));
    }

    return { updates };
  }

  public async consumeExternalEvent(data: ConsumeExternalEventRequest): Promise<MutationResponse> {
    const job: ExternalEventJob = {
      eventName: data.eventName,
      traceId: data.traceId,
      payloadJson: data.payloadJson,
    };

    if (!this.rmqService.isConfigured() || (await this.shouldProcessInline(job))) {
      await this.processExternalEvent(job);
      return { ok: true };
    }

    await this.rmqService.publishJson(DISPATCH_ROUTING_KEY, job);
    return { ok: true };
  }

  private async shouldProcessInline(job: ExternalEventJob) {
    const payload = this.parseJson(job.payloadJson);
    const targetBotId = String(payload.botId ?? '').trim();
    if (!targetBotId) {
      return false;
    }

    const bot = await this.repository.getBotEntityById(targetBotId);
    if (!bot) {
      return false;
    }

    return bot.createdVia === 'SEED' || bot.profile?.username === BOT_FATHER_USERNAME;
  }

  public async processExternalEvent(job: ExternalEventJob): Promise<void> {
    const payload = this.parseJson(job.payloadJson);
    const targetBotId = String(payload.botId ?? '').trim();
    if (!targetBotId) {
      return;
    }

    const botEntity = await this.repository.getBotEntityById(targetBotId);
    if (!botEntity || botEntity.status === 'DELETED') {
      return;
    }

    const bot = this.repository.toProtoBot(botEntity);
    const eventType = String(payload.eventType ?? this.normalizeExternalEventType(job.eventName)).trim();
    const normalizedPayload = this.enrichInboundPayload(eventType, bot, payload);
    const sourceEventKey =
      String(payload.sourceEventKey ?? '').trim() ||
      `${job.eventName}:${
        eventType === 'callback_query'
          ? normalizedPayload.callbackQueryId ?? normalizedPayload.id ?? normalizedPayload.messageId ?? randomUUID()
          : normalizedPayload.messageId ?? normalizedPayload.callbackQueryId ?? randomUUID()
      }`;
    const shouldDeliverWebhook = this.shouldDeliverToWebhook(bot, eventType);
    const shouldDeliverPolling = this.shouldDeliverToPolling(bot, eventType, payload);

    let update;
    try {
      update = await this.repository.createUpdate(bot.id, {
        eventType,
        sourceEventKey,
        traceId: job.traceId,
        payloadJson: JSON.stringify(normalizedPayload),
        allowedForWebhook: shouldDeliverWebhook,
        allowedForPolling: shouldDeliverPolling,
      });
    } catch (error) {
      const errorCode = (error as { code?: string }).code;
      if (errorCode === 'P2002') {
        return;
      }
      throw error;
    }

    if (eventType === 'callback_query') {
      const fromRecord = this.getNestedRecord(normalizedPayload.from);
      await this.repository.createCallbackQuery({
        botId: bot.id,
        callbackQueryId: String(normalizedPayload.callbackQueryId ?? normalizedPayload.id ?? randomUUID()),
        chatId: String(normalizedPayload.chatId ?? ''),
        messageId: String(normalizedPayload.messageId ?? ''),
        fromUserId: String(normalizedPayload.userId ?? fromRecord?.id ?? ''),
        data: String(normalizedPayload.data ?? ''),
        payloadJson: JSON.stringify(normalizedPayload),
      });
    }

    await this.updateWaitersService.notify(bot.id, update.updateId);

    if (bot.profile?.username === BOT_FATHER_USERNAME) {
      await this.handleBotFatherEvent(bot, normalizedPayload, job.traceId ?? '');
      return;
    }

    if (shouldDeliverWebhook) {
      const webhook = await this.repository.getWebhook(bot.id);
      if (webhook?.isEnabled && webhook.url && webhook.botId === bot.id) {
        const deliveryJob: WebhookDeliveryJob = {
          botId: bot.id,
          updateId: update.updateId,
          eventType,
          payloadJson: JSON.stringify(normalizedPayload),
          url: webhook.url,
          secret: this.resolveWebhookSecret(botEntity),
          traceId: job.traceId,
          attemptNo: 1,
        };

        if (!this.rmqService.isConfigured()) {
          await this.deliverWebhookJob(deliveryJob);
        } else {
          await this.rmqService.publishJson(WEBHOOK_ROUTING_KEY, deliveryJob);
        }
      }
    }
  }

  public async deliverWebhookJob(job: WebhookDeliveryJob): Promise<{ ok: boolean }> {
    const startedAt = new Date();
    await this.repository.bumpUpdateDeliveryAttempt(job.botId, BigInt(job.updateId), job.attemptNo);

    try {
      const body = {
        updateId: job.updateId,
        eventType: job.eventType,
        payload: this.parseJson(job.payloadJson),
      };
      const payload = JSON.stringify(body);
      const timestamp = `${Date.now()}`;
      const signature = createHmac('sha256', job.secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const response = await axios.post(job.url, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Orisign-Bot-Id': job.botId,
          'X-Orisign-Delivery-Id': `${job.botId}:${job.updateId}:${job.attemptNo}`,
          'X-Orisign-Timestamp': timestamp,
          'X-Orisign-Bot-Signature': signature,
        },
      });

      await this.repository.createDeliveryAttempt(job.botId, BigInt(job.updateId), 'WEBHOOK', 'SUCCESS', {
        attemptNo: job.attemptNo,
        responseCode: response.status,
        startedAt,
        finishedAt: new Date(),
      });
      await this.repository.touchWebhookCursor(job.botId, BigInt(job.updateId));
      await this.repository.upsertWebhook(job.botId, {
        lastSuccessAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      });
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Webhook delivery failed';
      await this.repository.createDeliveryAttempt(job.botId, BigInt(job.updateId), 'WEBHOOK', 'FAILED', {
        attemptNo: job.attemptNo,
        errorCode: 'WEBHOOK_DELIVERY_FAILED',
        errorMessage,
        startedAt,
        finishedAt: new Date(),
      });
      await this.repository.upsertWebhook(job.botId, {
        lastErrorAt: new Date(),
        lastErrorMessage: errorMessage,
      });
      return { ok: false };
    }
  }

  private async createBotForOwner(params: {
    ownerUserId: string;
    displayName: string;
    username: string;
    description?: string;
    about?: string;
    shortDescription?: string;
    localeDefault?: string;
    createdVia: BotCreatedVia;
    traceId?: string;
  }): Promise<CreateBotResponse> {
    const displayName = params.displayName?.trim();
    const username = params.username?.trim().replace(/^@+/, '').toLowerCase();
    if (!displayName || !username) {
      throw new RpcException({ code: RpcStatus.INVALID_ARGUMENT, details: 'displayName and username are required' });
    }

    const botId = generateBotId();
    const botUserId = generateBotUserId();
    const secretKey = generateSecretKey();
    const secretPreview = secretKey.slice(-6);
    const createdVia =
      params.createdVia &&
      params.createdVia !== BotCreatedVia.BOT_CREATED_VIA_UNSPECIFIED &&
      params.createdVia !== BotCreatedVia.UNRECOGNIZED
        ? params.createdVia
        : BotCreatedVia.INTERNAL_API;
    const handleKind = createdVia === BotCreatedVia.SEED ? HandleKind.SYSTEM_BOT : HandleKind.BOT;

    await this.handlesClient.reserveHandle({
      username,
      kind: handleKind,
      targetId: botId,
      actorId: params.ownerUserId,
      traceId: params.traceId ?? '',
      allowReplaceSameTarget: true,
    });

    try {
      await this.usersClient.createUser({ id: botUserId });
      await this.syncBotProjectionUser(botUserId, displayName, username);

      const bot = await this.repository.createBot({
        id: botId,
        ownerUserId: params.ownerUserId,
        botUserId,
        createdVia,
        profile: {
          displayName,
          username,
          description: params.description,
          about: params.about,
          shortDescription: params.shortDescription,
          localeDefault: params.localeDefault,
        },
        credential: {
          secretHash: hashSecret(secretKey),
          secretPreview,
          createdByUserId: params.ownerUserId,
        },
      });

      await this.recordAuditLog({
        botId,
        ownerUserId: params.ownerUserId,
        actorType: createdVia === BotCreatedVia.SEED ? 'SYSTEM' : 'OWNER',
        actorId: params.ownerUserId,
        action: 'bot.created',
        targetType: 'BOT',
        targetId: botId,
        payload: {
          username,
          displayName,
          createdVia,
        },
        traceId: params.traceId,
      });

      return { ok: true, bot, token: { value: `${botId}:${secretKey}`, botId, secretPreview } };
    } catch (error) {
      await this.handlesClient.releaseHandle({
        username,
        kind: handleKind,
        targetId: botId,
        actorId: params.ownerUserId,
        traceId: params.traceId ?? '',
      });
      throw error;
    }
  }

  private async ensureBotFather() {
    const existing = await this.repository.findBotByUsername(BOT_FATHER_USERNAME);
    if (existing) {
      await this.syncBotProjectionUser(
        existing.botUserId,
        existing.profile?.displayName || BOT_FATHER_DISPLAY_NAME,
        existing.profile?.username || BOT_FATHER_USERNAME,
      );
      return;
    }

    this.logger.log('Seeding BotFather system bot');
    await this.createBotForOwner({
      ownerUserId: 'system',
      displayName: BOT_FATHER_DISPLAY_NAME,
      username: BOT_FATHER_USERNAME,
      description: 'Create and manage your bots',
      about: 'Internal bot management assistant',
      shortDescription: 'Create bots',
      createdVia: BotCreatedVia.SEED,
      traceId: 'seed:botfather',
    });
  }

  private async ensureBotFatherWithRetry() {
    if (this.botFatherSeedPromise) {
      return await this.botFatherSeedPromise;
    }

    this.botFatherSeedPromise = (async () => {
      try {
        await this.ensureBotFather();
        if (this.botFatherRetryTimer) {
          clearTimeout(this.botFatherRetryTimer);
          this.botFatherRetryTimer = null;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error while seeding BotFather';
        this.logger.warn(`BotFather seed deferred: ${message}`);
        this.scheduleBotFatherRetry();
      } finally {
        this.botFatherSeedPromise = null;
      }
    })();

    return await this.botFatherSeedPromise;
  }

  private scheduleBotFatherRetry() {
    if (this.botFatherRetryTimer) {
      return;
    }

    this.botFatherRetryTimer = setTimeout(() => {
      this.botFatherRetryTimer = null;
      void this.ensureBotFatherWithRetry();
    }, 30_000);
    this.botFatherRetryTimer.unref?.();
  }

  private async syncBotProjectionUser(
    botUserId: string,
    displayName: string,
    username: string,
  ) {
    await this.usersClient.patchUser({
      userId: botUserId,
      firstName: displayName,
      username,
    });
  }

  private async getOwnedBot(botId: string, ownerUserId?: string) {
    const bot = await this.repository.getBotById(botId, ownerUserId);
    if (!bot) {
      throw new RpcException({ code: RpcStatus.NOT_FOUND, details: 'Bot not found' });
    }
    return bot;
  }

  private async resolveOwnedBotIdentifier(ownerUserId: string, identifier: string) {
    const bot = await this.repository.findOwnedBotByIdentifier(ownerUserId, identifier);
    if (!bot) {
      throw new RpcException({ code: RpcStatus.NOT_FOUND, details: 'Bot not found' });
    }
    return bot;
  }

  private async requireAuthenticatedBot(token: string) {
    const parts = (token ?? '').trim().split(':');
    if (parts.length !== 2) {
      throw new RpcException({ code: RpcStatus.UNAUTHENTICATED, details: 'Invalid bot token format' });
    }

    const [botId, secret] = parts;
    const bot = await this.repository.getBotById(botId);
    if (!bot || bot.status !== BotStatus.ACTIVE) {
      throw new RpcException({ code: RpcStatus.UNAUTHENTICATED, details: 'Bot is inactive or not found' });
    }

    const credentialEntity = await this.repository.getActiveCredentialEntity(botId);
    if (!credentialEntity || !verifySecret(secret, credentialEntity.secretHash)) {
      throw new RpcException({ code: RpcStatus.UNAUTHENTICATED, details: 'Invalid bot token' });
    }

    await this.repository.touchCredential(credentialEntity.id);
    return { bot, credential: this.repository.toProtoCredential(credentialEntity) };
  }

  private async assertBotCanSend(bot: { id: string; botUserId: string; status: BotStatus }, chatId: string) {
    if (bot.status !== BotStatus.ACTIVE) {
      throw new RpcException({ code: RpcStatus.PERMISSION_DENIED, details: 'Bot is not active' });
    }

    const binding = await this.repository.getChatBinding(bot.id, chatId);
    if (binding?.status === BotChatBindingStatus.DENIED) {
      throw new RpcException({ code: RpcStatus.PERMISSION_DENIED, details: 'Bot is denied in this chat' });
    }

    const permission = await this.conversationsClient.canPost({ conversationId: chatId, userId: bot.botUserId });
    if (!permission.allowed) {
      throw new RpcException({ code: RpcStatus.PERMISSION_DENIED, details: 'Bot cannot post to this chat' });
    }
  }

  private async deliverWebhook(botId: string, webhook: { url?: string; secret?: string }, update: { updateId: number; payloadJson: string; eventType: string }) {
    const startedAt = new Date();
    try {
      const body = { updateId: update.updateId, eventType: update.eventType, payload: this.parseJson(update.payloadJson) };
      const payload = JSON.stringify(body);
      const timestamp = `${Date.now()}`;
      const signature = createHmac('sha256', webhook.secret || '').update(`${timestamp}.${payload}`).digest('hex');

      const response = await axios.post(webhook.url as string, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Orisign-Bot-Id': botId,
          'X-Orisign-Delivery-Id': `${botId}:${update.updateId}`,
          'X-Orisign-Timestamp': timestamp,
          'X-Orisign-Bot-Signature': signature,
        },
      });

      await this.repository.createDeliveryAttempt(botId, BigInt(update.updateId), 'WEBHOOK', 'SUCCESS', {
        responseCode: response.status,
        startedAt,
        finishedAt: new Date(),
      });
      await this.repository.touchWebhookCursor(botId, BigInt(update.updateId));
      await this.repository.upsertWebhook(botId, { lastSuccessAt: new Date(), lastErrorAt: null, lastErrorMessage: null });
    } catch (error) {
      await this.repository.createDeliveryAttempt(botId, BigInt(update.updateId), 'WEBHOOK', 'FAILED', {
        errorCode: 'WEBHOOK_DELIVERY_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Webhook delivery failed',
        startedAt,
        finishedAt: new Date(),
      });
      await this.repository.upsertWebhook(botId, {
        lastErrorAt: new Date(),
        lastErrorMessage: error instanceof Error ? error.message : 'Webhook delivery failed',
      });
    }
  }

  private async handleBotFatherEvent(bot: { id: string; botUserId: string }, payload: Record<string, unknown>, traceId: string) {
    const chatId = String(payload.chatId ?? '');
    const userId = String(payload.userId ?? '');
    const text = String(payload.text ?? '').trim();
    const locale = this.resolveLocale(payload);
    const callbackData = this.extractCallbackData(payload);
    if (!chatId || !userId || (!text && !callbackData && !this.extractAvatarFileId(payload))) {
      return;
    }

    const session = await this.repository.getSession(bot.id, chatId, userId, BOT_FATHER_SCOPE);
    const sessionState = this.parseJson(session?.stateJson ?? '{}');
    const callbackSourceMessageId = this.extractPanelMessageId(payload);
    const panelMessageId = callbackData
      ? callbackSourceMessageId
      : this.readBotFatherPanelMessageId(sessionState) || callbackSourceMessageId;

    if (callbackData) {
      await this.handleBotFatherInlineAction(
        bot,
        chatId,
        userId,
        callbackData,
        locale,
        traceId,
        session,
        panelMessageId,
      );
      return;
    }

    if (text === '/cancel') {
      await this.repository.deleteSession(bot.id, chatId, userId, BOT_FATHER_SCOPE);
      await this.sendBotFatherText(
        bot,
        chatId,
        this.bt(locale, 'Cancelled.', 'Отменено.'),
        this.buildBotFatherHomeMarkup(),
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (session?.scene === 'EDIT_BOT') {
      const handled = await this.handleBotFatherEditSession(bot, chatId, userId, session, text, payload, locale, traceId);
      if (handled) {
        return;
      }
    }

    const [commandName, ...commandArgs] = text.split(/\s+/);
    const commandPayload = commandArgs.join(' ').trim();

    if (text === '/start' || text === '/help') {
      await this.sendBotFatherText(
        bot,
        chatId,
        this.bt(
          locale,
          'BotFather commands:\n/newbot - create a new bot\n/mybots - list your bots\n/token <bot>\n/regenerate_token <bot>\n/revoke <bot>\n/enablebot <bot>\n/disablebot <bot>\n/deletebot <bot>\n/setname <bot> <name>\n/setusername <bot> <usernamebot>\n/setdescription <bot> <text>\n/setabout <bot> <text>\n/setwebhook <bot> <https-url>\n/deletewebhook <bot>\n/cancel - cancel current flow',
          'Команды BotFather:\n/newbot - создать бота\n/mybots - список ботов\n/token <bot>\n/regenerate_token <bot>\n/revoke <bot>\n/enablebot <bot>\n/disablebot <bot>\n/deletebot <bot>\n/setname <bot> <name>\n/setusername <bot> <usernamebot>\n/setdescription <bot> <text>\n/setabout <bot> <text>\n/setwebhook <bot> <https-url>\n/deletewebhook <bot>\n/cancel - отменить текущий сценарий',
        ),
        this.buildBotFatherHomeMarkup(),
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (text === '/mybots') {
      await this.sendBotFatherBotList(bot, chatId, userId, locale, {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'LIST',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (text === '/newbot') {
      const currentState = this.parseJson(session?.stateJson ?? '{}');
      await this.repository.upsertSession(bot.id, chatId, userId, BOT_FATHER_SCOPE, {
        scene: 'NEW_BOT',
        step: 'DISPLAY_NAME',
        locale,
        stateJson: JSON.stringify({
          ...(currentState.panelMessageId ? { panelMessageId: currentState.panelMessageId } : {}),
        }),
        expiresAt: new Date(Date.now() + BOT_FATHER_SESSION_TTL_MS),
      });
      await this.sendBotFatherText(
        bot,
        chatId,
        this.bt(locale, 'Send me the display name for your new bot.', 'Отправьте отображаемое имя для нового бота.'),
        this.buildCancelReplyMarkup(),
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'NEW_BOT',
          step: 'DISPLAY_NAME',
          state: {
            ...currentState,
            ...(panelMessageId ? { panelMessageId } : {}),
          },
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (commandName === '/token' && commandPayload) {
      const targetBot = await this.resolveOwnedBotIdentifier(userId, commandPayload);
      const credential = await this.repository.getActiveCredentialEntity(targetBot.id);
      const preview = credential?.secretPreview ? `****${credential.secretPreview}` : 'revoked';
      await this.sendBotFatherText(
        bot,
        chatId,
        `Bot @${targetBot.profile?.username ?? targetBot.id}\nCurrent token preview: ${preview}\nUse /regenerate_token ${targetBot.id} to mint a new token.`,
        '',
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (commandName === '/regenerate_token' && commandPayload) {
      const targetBot = await this.resolveOwnedBotIdentifier(userId, commandPayload);
      const rotated = await this.regenerateBotToken({ botId: targetBot.id, ownerUserId: userId, traceId });
      await this.sendBotFatherText(
        bot,
        chatId,
        `New token for @${targetBot.profile?.username ?? targetBot.id}:\n||${rotated.token?.value ?? ''}||`,
        '',
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (commandName === '/revoke' && commandPayload) {
      const targetBot = await this.resolveOwnedBotIdentifier(userId, commandPayload);
      await this.revokeBotToken({ botId: targetBot.id, ownerUserId: userId, traceId });
      await this.sendBotFatherText(
        bot,
        chatId,
        `Developer token for @${targetBot.profile?.username ?? targetBot.id} has been revoked.`,
        '',
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (commandName === '/enablebot' && commandPayload) {
      const targetBot = await this.resolveOwnedBotIdentifier(userId, commandPayload);
      await this.enableBot({ botId: targetBot.id, ownerUserId: userId, traceId });
      await this.sendBotFatherText(bot, chatId, `@${targetBot.profile?.username ?? targetBot.id} is enabled.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (commandName === '/disablebot' && commandPayload) {
      const targetBot = await this.resolveOwnedBotIdentifier(userId, commandPayload);
      await this.disableBot({ botId: targetBot.id, ownerUserId: userId, traceId });
      await this.sendBotFatherText(bot, chatId, `@${targetBot.profile?.username ?? targetBot.id} is disabled.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (commandName === '/deletebot' && commandPayload) {
      const targetBot = await this.resolveOwnedBotIdentifier(userId, commandPayload);
      await this.deleteBot({ botId: targetBot.id, ownerUserId: userId, traceId });
      await this.sendBotFatherText(bot, chatId, `@${targetBot.profile?.username ?? targetBot.id} has been deleted.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (commandName === '/setname' && commandPayload) {
      const [identifier, ...nameParts] = commandPayload.split(/\s+/);
      const nextDisplayName = nameParts.join(' ').trim();
      if (!identifier || !nextDisplayName) {
        await this.sendBotFatherText(bot, chatId, 'Usage: /setname <bot> <new display name>', '', {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        });
        return;
      }

      const targetBot = await this.resolveOwnedBotIdentifier(userId, identifier);
      await this.updateBot({
        botId: targetBot.id,
        ownerUserId: userId,
        displayName: nextDisplayName,
        username: '',
        description: '',
        about: '',
        shortDescription: '',
        avatarFileId: '',
        avatarUrl: '',
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId,
      });
      await this.sendBotFatherText(bot, chatId, `Display name updated for @${targetBot.profile?.username ?? targetBot.id}.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (commandName === '/setusername' && commandPayload) {
      const [identifier, nextUsername] = commandPayload.split(/\s+/);
      if (!identifier || !nextUsername) {
        await this.sendBotFatherText(bot, chatId, 'Usage: /setusername <bot> <newusernamebot>', '', {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        });
        return;
      }

      const targetBot = await this.resolveOwnedBotIdentifier(userId, identifier);
      await this.updateBot({
        botId: targetBot.id,
        ownerUserId: userId,
        displayName: '',
        username: nextUsername,
        description: '',
        about: '',
        shortDescription: '',
        avatarFileId: '',
        avatarUrl: '',
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId,
      });
      await this.sendBotFatherText(
        bot,
        chatId,
        `Username updated to @${nextUsername.replace(/^@+/, '').toLowerCase()}.`,
        '',
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (commandName === '/setdescription' && commandPayload) {
      const [identifier, ...descriptionParts] = commandPayload.split(/\s+/);
      const nextDescription = descriptionParts.join(' ').trim();
      if (!identifier || !nextDescription) {
        await this.sendBotFatherText(bot, chatId, 'Usage: /setdescription <bot> <text>', '', {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        });
        return;
      }

      const targetBot = await this.resolveOwnedBotIdentifier(userId, identifier);
      await this.updateBot({
        botId: targetBot.id,
        ownerUserId: userId,
        displayName: '',
        username: '',
        description: nextDescription,
        about: '',
        shortDescription: '',
        avatarFileId: '',
        avatarUrl: '',
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId,
      });
      await this.sendBotFatherText(bot, chatId, `Description updated for @${targetBot.profile?.username ?? targetBot.id}.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (commandName === '/setabout' && commandPayload) {
      const [identifier, ...aboutParts] = commandPayload.split(/\s+/);
      const nextAbout = aboutParts.join(' ').trim();
      if (!identifier || !nextAbout) {
        await this.sendBotFatherText(bot, chatId, 'Usage: /setabout <bot> <text>', '', {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        });
        return;
      }

      const targetBot = await this.resolveOwnedBotIdentifier(userId, identifier);
      await this.updateBot({
        botId: targetBot.id,
        ownerUserId: userId,
        displayName: '',
        username: '',
        description: '',
        about: nextAbout,
        shortDescription: '',
        avatarFileId: '',
        avatarUrl: '',
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId,
      });
      await this.sendBotFatherText(bot, chatId, `About text updated for @${targetBot.profile?.username ?? targetBot.id}.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (commandName === '/setwebhook' && commandPayload) {
      const [identifier, url] = commandPayload.split(/\s+/);
      if (!identifier || !url) {
        await this.sendBotFatherText(bot, chatId, 'Usage: /setwebhook <bot> <https://example.com/webhook>', '', {
          ownerUserId: userId,
          locale,
          session,
          scene: 'IDLE',
          step: 'HOME',
          targetMessageId: panelMessageId,
        });
        return;
      }

      const targetBot = await this.resolveOwnedBotIdentifier(userId, identifier);
      await this.setBotWebhook({
        botId: targetBot.id,
        ownerUserId: userId,
        url,
        allowedUpdates: [],
        maxConnections: 1,
        ipAllowlist: [],
        isEnabled: true,
        traceId,
      });
      await this.sendBotFatherText(bot, chatId, `Webhook updated for @${targetBot.profile?.username ?? targetBot.id}.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (commandName === '/deletewebhook' && commandPayload) {
      const targetBot = await this.resolveOwnedBotIdentifier(userId, commandPayload);
      await this.deleteBotWebhook({ botId: targetBot.id, ownerUserId: userId, traceId });
      await this.sendBotFatherText(bot, chatId, `Webhook disabled for @${targetBot.profile?.username ?? targetBot.id}.`, '', {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      });
      return;
    }

    if (session?.scene === 'NEW_BOT' && session.step === 'DISPLAY_NAME') {
      const sessionState = this.parseJson(session.stateJson ?? '{}');
      await this.repository.upsertSession(bot.id, chatId, userId, BOT_FATHER_SCOPE, {
        scene: 'NEW_BOT',
        step: 'USERNAME',
        locale,
        stateJson: JSON.stringify({
          ...sessionState,
          displayName: text,
        }),
        expiresAt: new Date(Date.now() + BOT_FATHER_SESSION_TTL_MS),
      });
      await this.sendBotFatherText(
        bot,
        chatId,
        this.bt(locale, 'Great. Now send the bot username ending with "bot".', 'Отлично. Теперь отправьте username бота, оканчивающийся на "bot".'),
        this.buildCancelReplyMarkup(),
        {
          ownerUserId: userId,
          locale,
          session,
          scene: 'NEW_BOT',
          step: 'USERNAME',
          state: {
            ...sessionState,
            displayName: text,
            ...(panelMessageId ? { panelMessageId } : {}),
          },
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (session?.scene === 'NEW_BOT' && session.step === 'USERNAME') {
      const sessionState = this.parseJson(String(session.stateJson ?? '{}'));
      try {
        const created = await this.createBotForOwner({
          ownerUserId: userId,
          displayName: String(sessionState.displayName ?? 'Bot'),
          username: text,
          createdVia: BotCreatedVia.BOT_FATHER,
          traceId,
        });
        await this.repository.deleteSession(bot.id, chatId, userId, BOT_FATHER_SCOPE);
        await this.sendBotFatherText(
          bot,
          chatId,
          `${this.bt(locale, 'Done. Your bot is ready.', 'Готово. Ваш бот создан.')}\nToken: ||${created.token?.value ?? ''}||`,
          this.buildManageBotMarkup(created.bot),
          {
            ownerUserId: userId,
            locale,
            session,
            scene: 'IDLE',
            step: 'MANAGE',
            targetMessageId: panelMessageId,
          },
        );
      } catch (error) {
        const details =
          error instanceof RpcException
            ? (error.getError() as { details?: string })?.details ?? 'Unable to create bot'
            : error instanceof Error
              ? error.message
              : 'Unable to create bot';
        await this.sendBotFatherText(
          bot,
          chatId,
          `${this.bt(locale, 'I could not create that bot:', 'Не удалось создать такого бота:')} ${details}\n${this.bt(locale, 'Send another username ending with "bot".', 'Отправьте другой username, оканчивающийся на "bot".')}`,
          this.buildCancelReplyMarkup(),
          {
            ownerUserId: userId,
            locale,
            session,
            scene: 'NEW_BOT',
            step: 'USERNAME',
            targetMessageId: panelMessageId,
          },
        );
      }
      return;
    }

    await this.sendBotFatherText(
      bot,
      chatId,
      this.bt(locale, 'Unknown command. Send /help to see the available BotFather actions.', 'Неизвестная команда. Отправьте /help, чтобы увидеть доступные действия BotFather.'),
      this.buildBotFatherHomeMarkup(),
      {
        ownerUserId: userId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
      },
    );
  }

  private async sendBotFatherText(
    botOrUserId: Pick<Bot, 'id' | 'botUserId'> | string,
    chatId: string,
    text: string,
    replyMarkupJson = '',
    options?: BotFatherPanelOptions,
  ) {
    const sourceBotId = typeof botOrUserId === 'string' ? '' : botOrUserId.id;
    const authorId = typeof botOrUserId === 'string' ? botOrUserId : botOrUserId.botUserId;
    const baseState = {
      ...this.parseJson(options?.session?.stateJson ?? '{}'),
      ...(options?.state ?? {}),
    };
    const targetMessageId = options?.allowPanelReuse
      ? options?.targetMessageId?.trim() || this.readBotFatherPanelMessageId(baseState)
      : '';

    if (targetMessageId) {
      try {
        await this.messagesClient.editMessage({
          messageId: targetMessageId,
          actorId: authorId,
          text,
          replyMarkupJson,
          entitiesJson: '',
          metadataJson: '',
        });

        await this.gatewayRealtimeService.emitMessageUpdated({
          conversationId: chatId,
          messageId: targetMessageId,
          text,
          replyMarkupJson,
          editedAt: Date.now(),
          actorId: authorId,
          reason: 'botfather.message.updated',
        });

        if (options?.allowPanelReuse) {
          await this.persistBotFatherPanelState(
            sourceBotId,
            chatId,
            options?.ownerUserId,
            options?.locale,
            {
              ...baseState,
              panelMessageId: targetMessageId,
            },
            options?.scene ?? options?.session?.scene ?? 'IDLE',
            options?.step ?? options?.session?.step ?? 'HOME',
          );
        }
        return targetMessageId;
      } catch (error) {
        this.logger.debug(
          `Falling back to sending a new BotFather panel message: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const response = await this.messagesClient.sendMessage({
      conversationId: chatId,
      authorId,
      kind: MessageKind.TEXT,
      text,
      replyToId: '',
      mediaKeys: [],
      entitiesJson: '',
      replyMarkupJson,
      attachmentsJson: '',
      sourceBotId,
      metadataJson: '',
    });

    if (response.ok && response.message) {
      await this.gatewayRealtimeService.emitMessageCreated(
        response.message,
        authorId,
        'botfather.message.created',
      );
      if (options?.allowPanelReuse) {
        await this.persistBotFatherPanelState(
          sourceBotId,
          chatId,
          options?.ownerUserId,
          options?.locale,
          {
            ...baseState,
            panelMessageId: response.message.id,
          },
          options?.scene ?? options?.session?.scene ?? 'IDLE',
          options?.step ?? options?.session?.step ?? 'HOME',
        );
      }
      return response.message.id;
    }

    return '';
  }

  private buildBotFatherHomeMarkup() {
    return this.stringifyMarkup({
      type: 'inline_keyboard',
      inlineKeyboard: [
        [
          { text: 'New bot', callbackData: 'bf:newbot' },
          { text: 'My bots', callbackData: 'bf:mybots' },
        ],
      ],
    });
  }

  private buildCancelReplyMarkup() {
    return this.stringifyMarkup({
      type: 'reply_keyboard',
      resizeKeyboard: true,
      oneTimeKeyboard: true,
      keyboard: [[{ text: '/cancel' }]],
    });
  }

  private buildManageBotMarkup(bot: Bot) {
    const toggleAction = bot.status === BotStatus.ACTIVE ? 'disable' : 'enable';
    const toggleLabel = bot.status === BotStatus.ACTIVE ? 'Disable' : 'Enable';
    return this.stringifyMarkup({
      type: 'inline_keyboard',
      inlineKeyboard: [
        [
          { text: 'Token', callbackData: `bf:token:${bot.id}` },
          { text: 'Regen', callbackData: `bf:regen:${bot.id}` },
        ],
        [
          { text: 'Name', callbackData: `bf:editname:${bot.id}` },
          { text: 'Username', callbackData: `bf:editusername:${bot.id}` },
        ],
        [
          { text: 'Description', callbackData: `bf:editdescription:${bot.id}` },
          { text: 'About', callbackData: `bf:editabout:${bot.id}` },
        ],
        [
          { text: 'Avatar', callbackData: `bf:setavatar:${bot.id}` },
          { text: 'Webhook', callbackData: `bf:setwebhook:${bot.id}` },
        ],
        [
          { text: toggleLabel, callbackData: `bf:${toggleAction}:${bot.id}` },
          { text: 'Revoke', callbackData: `bf:revoke:${bot.id}` },
        ],
        [
          { text: 'Delete', callbackData: `bf:delete:${bot.id}` },
          { text: 'Back', callbackData: 'bf:mybots' },
        ],
      ],
    });
  }

  private async sendBotFatherBotList(
    bot: Pick<Bot, 'id' | 'botUserId'>,
    chatId: string,
    ownerUserId: string,
    locale: string,
    options?: BotFatherPanelOptions,
  ) {
    const bots = await this.repository.listBots(ownerUserId, 50, 0, []);
    const text =
      bots.length > 0
        ? `${this.bt(locale, 'Your bots:', 'Ваши боты:')}\n${bots
            .map((item) => `@${item.profile?.username ?? item.id} (${item.profile?.displayName ?? item.id})`)
            .join('\n')}`
        : this.bt(locale, 'You have no bots yet.', 'У вас пока нет ботов.');
    const replyMarkupJson = this.stringifyMarkup({
      type: 'inline_keyboard',
      inlineKeyboard: [
        ...bots.map((item) => [
          { text: `@${item.profile?.username ?? item.id}`, callbackData: `bf:manage:${item.id}` },
        ]),
        [
          { text: 'New bot', callbackData: 'bf:newbot' },
          { text: 'Refresh', callbackData: 'bf:mybots' },
        ],
      ],
    });

    await this.sendBotFatherText(bot, chatId, text, replyMarkupJson, {
      ...options,
      ownerUserId,
      locale,
    });
  }

  private async handleBotFatherInlineAction(
    bot: Pick<Bot, 'id' | 'botUserId'>,
    chatId: string,
    ownerUserId: string,
    callbackData: string,
    locale: string,
    traceId: string,
    session: BotFatherSessionSnapshot | null,
    panelMessageId: string,
  ) {
    const [scope, action, identifier] = callbackData.split(':');
    if (scope !== 'bf') {
      return;
    }

    if (action === 'newbot') {
      const sessionState = this.parseJson(session?.stateJson ?? '{}');
      await this.repository.upsertSession(bot.id, chatId, ownerUserId, BOT_FATHER_SCOPE, {
        scene: 'NEW_BOT',
        step: 'DISPLAY_NAME',
        locale,
        stateJson: JSON.stringify({
          ...sessionState,
          ...(panelMessageId ? { panelMessageId } : {}),
        }),
        expiresAt: new Date(Date.now() + BOT_FATHER_SESSION_TTL_MS),
      });
      await this.sendBotFatherText(
        bot,
        chatId,
        this.bt(locale, 'Send me the display name for your new bot.', 'Отправьте отображаемое имя для нового бота.'),
        this.buildCancelReplyMarkup(),
        {
          ownerUserId,
          locale,
          session,
          scene: 'NEW_BOT',
          step: 'DISPLAY_NAME',
          state: sessionState,
          targetMessageId: panelMessageId,
        },
      );
      return;
    }

    if (action === 'mybots') {
      await this.sendBotFatherBotList(bot, chatId, ownerUserId, locale, {
        ownerUserId,
        locale,
        session,
        scene: 'IDLE',
        step: 'LIST',
        targetMessageId: panelMessageId,
        allowPanelReuse: true,
      });
      return;
    }

    if (!identifier) {
      return;
    }

    const targetBot = await this.resolveOwnedBotIdentifier(ownerUserId, identifier);
    if (action === 'manage') {
      await this.sendBotFatherText(
        bot,
        chatId,
        `${targetBot.profile?.displayName ?? targetBot.id}\n@${targetBot.profile?.username ?? targetBot.id}`,
        this.buildManageBotMarkup(targetBot),
        {
          ownerUserId,
          locale,
          session,
          scene: 'IDLE',
          step: 'MANAGE',
          targetMessageId: panelMessageId,
          allowPanelReuse: true,
        },
      );
      return;
    }

    if (action === 'token') {
      const credential = await this.repository.getActiveCredentialEntity(targetBot.id);
      const preview = credential?.secretPreview ? `****${credential.secretPreview}` : this.bt(locale, 'revoked', 'отозван');
      await this.sendBotFatherText(bot, chatId, `${this.bt(locale, 'Token preview', 'Превью токена')}: ${preview}`, this.buildManageBotMarkup(targetBot), {
        ownerUserId,
        locale,
        session,
        scene: 'IDLE',
        step: 'MANAGE',
        targetMessageId: panelMessageId,
        allowPanelReuse: true,
      });
      return;
    }

    if (action === 'regen') {
      const rotated = await this.regenerateBotToken({ botId: targetBot.id, ownerUserId, traceId });
      await this.sendBotFatherText(
        bot,
        chatId,
        `${this.bt(locale, 'New token', 'Новый токен')}:\n||${rotated.token?.value ?? ''}||`,
        this.buildManageBotMarkup(targetBot),
        {
          ownerUserId,
          locale,
          session,
          scene: 'IDLE',
          step: 'MANAGE',
          targetMessageId: panelMessageId,
          allowPanelReuse: true,
        },
      );
      return;
    }

    if (action === 'revoke') {
      await this.revokeBotToken({ botId: targetBot.id, ownerUserId, traceId });
      await this.sendBotFatherText(bot, chatId, this.bt(locale, 'Developer token revoked.', 'Токен разработчика отозван.'), this.buildManageBotMarkup(targetBot), {
        ownerUserId,
        locale,
        session,
        scene: 'IDLE',
        step: 'MANAGE',
        targetMessageId: panelMessageId,
        allowPanelReuse: true,
      });
      return;
    }

    if (action === 'enable') {
      await this.enableBot({ botId: targetBot.id, ownerUserId, traceId });
      await this.sendBotFatherText(bot, chatId, this.bt(locale, 'Bot enabled.', 'Бот включён.'), this.buildManageBotMarkup(targetBot), {
        ownerUserId,
        locale,
        session,
        scene: 'IDLE',
        step: 'MANAGE',
        targetMessageId: panelMessageId,
        allowPanelReuse: true,
      });
      return;
    }

    if (action === 'disable') {
      await this.disableBot({ botId: targetBot.id, ownerUserId, traceId });
      await this.sendBotFatherText(bot, chatId, this.bt(locale, 'Bot disabled.', 'Бот выключен.'), this.buildManageBotMarkup(targetBot), {
        ownerUserId,
        locale,
        session,
        scene: 'IDLE',
        step: 'MANAGE',
        targetMessageId: panelMessageId,
        allowPanelReuse: true,
      });
      return;
    }

    if (action === 'delete') {
      await this.deleteBot({ botId: targetBot.id, ownerUserId, traceId });
      await this.sendBotFatherText(bot, chatId, this.bt(locale, 'Bot deleted.', 'Бот удалён.'), this.buildBotFatherHomeMarkup(), {
        ownerUserId,
        locale,
        session,
        scene: 'IDLE',
        step: 'HOME',
        targetMessageId: panelMessageId,
        allowPanelReuse: true,
      });
      return;
    }

    const sessionStepByAction: Record<string, string> = {
      editname: 'DISPLAY_NAME',
      editusername: 'USERNAME',
      editdescription: 'DESCRIPTION',
      editabout: 'ABOUT',
      setwebhook: 'WEBHOOK',
      setavatar: 'AVATAR',
    };
    const sessionStep = sessionStepByAction[action];
    if (!sessionStep) {
      return;
    }

    await this.repository.upsertSession(bot.id, chatId, ownerUserId, BOT_FATHER_SCOPE, {
      scene: 'EDIT_BOT',
      step: sessionStep,
      locale,
      stateJson: JSON.stringify({
        ...this.parseJson(session?.stateJson ?? '{}'),
        botId: targetBot.id,
        ...(panelMessageId ? { panelMessageId } : {}),
      }),
      expiresAt: new Date(Date.now() + BOT_FATHER_SESSION_TTL_MS),
    });
    const promptByAction: Record<string, string> = {
      editname: this.bt(locale, 'Send the new display name.', 'Отправьте новое отображаемое имя.'),
      editusername: this.bt(locale, 'Send the new username ending with "bot".', 'Отправьте новый username, оканчивающийся на "bot".'),
      editdescription: this.bt(locale, 'Send the new description.', 'Отправьте новое описание.'),
      editabout: this.bt(locale, 'Send the new about text.', 'Отправьте новый текст about.'),
      setwebhook: this.bt(locale, 'Send the webhook URL.', 'Отправьте URL webhook.'),
      setavatar: this.bt(locale, 'Send the avatar image or media key.', 'Отправьте изображение аватара или медиаключ.'),
    };
    await this.sendBotFatherText(bot, chatId, promptByAction[action], this.buildCancelReplyMarkup(), {
      ownerUserId,
      locale,
      session,
      scene: 'EDIT_BOT',
      step: sessionStep,
      state: {
        ...this.parseJson(session?.stateJson ?? '{}'),
        botId: targetBot.id,
      },
      targetMessageId: panelMessageId,
      allowPanelReuse: true,
    });
  }

  private async handleBotFatherEditSession(
    bot: Pick<Bot, 'id' | 'botUserId'>,
    chatId: string,
    ownerUserId: string,
    session: { scene: string; step: string; stateJson: string | null },
    text: string,
    payload: Record<string, unknown>,
    locale: string,
    traceId: string,
  ) {
    if (session.scene !== 'EDIT_BOT') {
      return false;
    }

    const state = this.parseJson(session.stateJson ?? '{}');
    const targetBot = await this.resolveOwnedBotIdentifier(ownerUserId, String(state.botId ?? ''));

    if (session.step === 'AVATAR') {
      const avatarFileId = this.extractAvatarFileId(payload);
      if (!avatarFileId) {
        return false;
      }

      await this.updateBot({
        botId: targetBot.id,
        ownerUserId,
        displayName: '',
        username: '',
        description: '',
        about: '',
        shortDescription: '',
        avatarFileId,
        avatarUrl: '',
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId,
      });
    } else if (text) {
      const patch = {
        botId: targetBot.id,
        ownerUserId,
        displayName: '',
        username: '',
        description: '',
        about: '',
        shortDescription: '',
        avatarFileId: '',
        avatarUrl: '',
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId,
      };

      if (session.step === 'DISPLAY_NAME') {
        patch.displayName = text;
      } else if (session.step === 'USERNAME') {
        patch.username = text;
      } else if (session.step === 'DESCRIPTION') {
        patch.description = text;
      } else if (session.step === 'ABOUT') {
        patch.about = text;
      } else if (session.step === 'WEBHOOK') {
        await this.setBotWebhook({
          botId: targetBot.id,
          ownerUserId,
          url: text,
          allowedUpdates: [],
          maxConnections: 1,
          ipAllowlist: [],
          isEnabled: true,
          traceId,
        });
      } else {
        return false;
      }

      if (session.step !== 'WEBHOOK') {
        await this.updateBot(patch);
      }
    } else {
      return false;
    }

    await this.repository.deleteSession(bot.id, chatId, ownerUserId, BOT_FATHER_SCOPE);
    const refreshedBot = await this.resolveOwnedBotIdentifier(ownerUserId, targetBot.id);
    await this.sendBotFatherText(bot, chatId, this.bt(locale, 'Bot updated.', 'Бот обновлён.'), this.buildManageBotMarkup(refreshedBot), {
      ownerUserId,
      locale,
      session,
      scene: 'IDLE',
      step: 'MANAGE',
      state,
      targetMessageId: this.readBotFatherPanelMessageId(state),
      allowPanelReuse: true,
    });
    return true;
  }

  private stringifyMarkup(value: Record<string, unknown>) {
    return JSON.stringify(value);
  }

  private extractCallbackData(payload: Record<string, unknown>) {
    return String(payload.data ?? payload.callbackData ?? '').trim();
  }

  private extractPanelMessageId(payload: Record<string, unknown>) {
    const topLevelMessageId = String(payload.messageId ?? '').trim();
    if (topLevelMessageId) {
      return topLevelMessageId;
    }

    const messageRecord = this.getNestedRecord(payload.message);
    return String(messageRecord?.id ?? '').trim();
  }

  private extractAvatarFileId(payload: Record<string, unknown>) {
    const mediaKeys = Array.isArray(payload.mediaKeys) ? payload.mediaKeys : [];
    if (mediaKeys.length > 0 && typeof mediaKeys[0] === 'string') {
      return mediaKeys[0];
    }

    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    for (const attachment of attachments) {
      if (
        attachment &&
        typeof attachment === 'object' &&
        'fileId' in attachment &&
        typeof attachment.fileId === 'string' &&
        attachment.fileId.trim()
      ) {
        return attachment.fileId.trim();
      }
    }

    return '';
  }

  private resolveLocale(payload: Record<string, unknown>) {
    const locale = String(payload.locale ?? '').trim().toLowerCase();
    return locale.startsWith('ru') ? 'ru' : 'en';
  }

  private bt(locale: string, english: string, russian: string) {
    return locale === 'ru' ? russian : english;
  }

  private normalizeExternalEventType(eventName: string) {
    if (eventName === 'message.created') {
      return 'message';
    }
    if (eventName === 'message.edited') {
      return 'edited_message';
    }
    if (eventName === 'message.deleted') {
      return 'deleted_message';
    }
    if (eventName === 'message.callback_invoked') {
      return 'callback_query';
    }
    return eventName;
  }

  private enrichInboundPayload(eventType: string, bot: Bot, payload: Record<string, unknown>) {
    const nextPayload = { ...payload };
    if (!nextPayload.eventType) {
      nextPayload.eventType = eventType;
    }
    if (!nextPayload.botId) {
      nextPayload.botId = bot.id;
    }
    if (eventType === 'callback_query' && !nextPayload.id) {
      nextPayload.id = nextPayload.callbackQueryId ?? randomUUID();
    }
    return nextPayload;
  }

  private shouldDeliverToWebhook(bot: Bot, eventType: string) {
    const allowedUpdates = bot.webhook?.allowedUpdates ?? [];
    if (allowedUpdates.length === 0) {
      return true;
    }
    return allowedUpdates.includes(eventType);
  }

  private shouldDeliverToPolling(bot: Bot, eventType: string, payload: Record<string, unknown>) {
    const chatRecord = this.getNestedRecord(payload.chat);
    const messageRecord = this.getNestedRecord(payload.message);
    const chatType = String(payload.chatType ?? chatRecord?.type ?? '').toLowerCase();
    const text = String(payload.text ?? messageRecord?.text ?? '').trim();
    const isGroupLike = chatType === 'group' || chatType === 'supergroup' || chatType === 'channel';

    if (eventType !== 'message' || !isGroupLike) {
      return true;
    }

    if (bot.privacyMode === BotPrivacyMode.PRIVACY_DISABLED) {
      return true;
    }

    return text.startsWith('/');
  }

  private resolveWebhookSecret(bot: { webhook?: { secret?: string | null } | null }) {
    return bot.webhook?.secret?.trim() || generateSecretKey();
  }

  private parseJson(value: string) {
    try {
      return JSON.parse(value || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private readBotFatherPanelMessageId(state: Record<string, unknown>) {
    return String(state.panelMessageId ?? '').trim();
  }

  private async persistBotFatherPanelState(
    botId: string,
    chatId: string,
    ownerUserId: string | undefined,
    locale: string | undefined,
    state: Record<string, unknown>,
    scene: string,
    step: string,
  ) {
    if (!botId || !ownerUserId) {
      return;
    }

    await this.repository.upsertSession(botId, chatId, ownerUserId, BOT_FATHER_SCOPE, {
      scene,
      step,
      locale: locale ?? 'en',
      stateJson: JSON.stringify(state),
      expiresAt: new Date(Date.now() + BOT_FATHER_SESSION_TTL_MS),
    });
  }

  private getNestedRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private async recordAuditLog(params: {
    botId?: string;
    ownerUserId?: string;
    actorType: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    payload?: Record<string, unknown>;
    traceId?: string;
  }) {
    await this.repository.createAuditLog({
      botId: params.botId,
      ownerUserId: params.ownerUserId,
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      payloadJson: params.payload ? JSON.stringify(params.payload) : undefined,
      traceId: params.traceId,
    });
  }
}
