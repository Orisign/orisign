import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BotCreatedVia, BotDeliveryMode, BotPrivacyMode } from '@repo/contracts/gen/ts/bots';
import { lastValueFrom } from 'rxjs';
import { CurrentUser, Protected } from 'src/shared/decorators';
import { FileValidationPipe } from 'src/shared/pipes';
import { BotsClientGrpc } from './bots.grpc';
import {
  BotAvatarRequestDto,
  BotListQueryDto,
  CreateBotRequestDto,
  DeveloperAnswerCallbackQueryRequestDto,
  DeveloperDeleteMessageRequestDto,
  DeveloperEditMessageReplyMarkupRequestDto,
  DeveloperEditMessageTextRequestDto,
  DeveloperGetUpdatesQueryDto,
  DeveloperSendMediaRequestDto,
  DeveloperSendMessageRequestDto,
  SetCommandsRequestDto,
  SetWebhookRequestDto,
  UpdateBotRequestDto,
} from './dto';
import { MediaClientGrpc } from './media.grpc';

function extractBotToken(authorization?: string) {
  const value = (authorization ?? '').trim();
  if (!value.toLowerCase().startsWith('bot ')) {
    throw new BadRequestException('Authorization header must use Bot scheme');
  }
  return value.slice(4).trim();
}

@ApiTags('Bots')
@Controller()
export class BotsController {
  public constructor(
    private readonly botsClient: BotsClientGrpc,
    private readonly mediaClient: MediaClientGrpc,
  ) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create bot for current owner' })
  @ApiBody({ type: CreateBotRequestDto })
  @ApiOkResponse({ description: 'Bot created' })
  @Protected()
  @Post('internal/bots')
  @HttpCode(HttpStatus.OK)
  public async create(@CurrentUser() id: string, @Body() dto: CreateBotRequestDto) {
    return await lastValueFrom(
      this.botsClient.createBot({
        ownerUserId: id,
        displayName: dto.displayName ?? '',
        username: dto.username ?? '',
        description: dto.description ?? '',
        about: dto.about ?? '',
        shortDescription: dto.shortDescription ?? '',
        localeDefault: dto.localeDefault ?? '',
        traceId: '',
        createdVia: BotCreatedVia.INTERNAL_API,
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Get('internal/bots')
  @HttpCode(HttpStatus.OK)
  public async list(@CurrentUser() id: string, @Query() query: BotListQueryDto) {
    return await lastValueFrom(
      this.botsClient.listBots({
        ownerUserId: id,
        limit: Number(query.limit ?? 30),
        offset: Number(query.offset ?? 0),
        statuses: [],
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Get('internal/bots/:botId')
  @HttpCode(HttpStatus.OK)
  public async get(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.getBot({ botId, ownerUserId: id }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Patch('internal/bots/:botId')
  @HttpCode(HttpStatus.OK)
  public async update(@CurrentUser() id: string, @Param('botId') botId: string, @Body() dto: UpdateBotRequestDto) {
    return await lastValueFrom(
      this.botsClient.updateBot({
        botId,
        ownerUserId: id,
        displayName: dto.displayName ?? '',
        username: dto.username ?? '',
        description: dto.description ?? '',
        about: dto.about ?? '',
        shortDescription: dto.shortDescription ?? '',
        avatarFileId: dto.avatarFileId ?? '',
        avatarUrl: dto.avatarUrl ?? '',
        localeDefault: dto.localeDefault ?? '',
        deliveryMode: dto.deliveryMode ?? BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: dto.privacyMode ?? BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId: '',
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @ApiOperation({ summary: 'Upload bot avatar and assign it to the bot profile' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @Post('internal/bots/:botId/avatar/upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  public async uploadAvatar(
    @CurrentUser() id: string,
    @Param('botId') botId: string,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ) {
    const uploadResult = await lastValueFrom(
      this.mediaClient.uploadAvatar({
        accountId: id,
        fileName: file.originalname || `bot-avatar-${botId}`,
        contentType: file.mimetype,
        data: file.buffer,
      }),
    );

    const avatar = uploadResult.avatar;
    if (!uploadResult.ok || !avatar) {
      throw new BadRequestException('Failed to upload bot avatar');
    }

    const updated = await lastValueFrom(
      this.botsClient.updateBot({
        botId,
        ownerUserId: id,
        displayName: '',
        username: '',
        description: '',
        about: '',
        shortDescription: '',
        avatarFileId: avatar.key,
        avatarUrl: avatar.url,
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId: '',
      }),
    );

    return {
      ...updated,
      avatar,
    };
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Post('internal/bots/:botId/avatar')
  @HttpCode(HttpStatus.OK)
  public async setAvatar(@CurrentUser() id: string, @Param('botId') botId: string, @Body() dto: BotAvatarRequestDto) {
    return await lastValueFrom(
      this.botsClient.updateBot({
        botId,
        ownerUserId: id,
        displayName: '',
        username: '',
        description: '',
        about: '',
        shortDescription: '',
        avatarFileId: dto.avatarFileId ?? '',
        avatarUrl: dto.avatarUrl ?? '',
        localeDefault: '',
        deliveryMode: BotDeliveryMode.BOT_DELIVERY_MODE_UNSPECIFIED,
        privacyMode: BotPrivacyMode.BOT_PRIVACY_MODE_UNSPECIFIED,
        traceId: '',
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Delete('internal/bots/:botId/avatar')
  @HttpCode(HttpStatus.OK)
  public async deleteAvatar(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(
      this.botsClient.updateBot({
        botId,
        ownerUserId: id,
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
        traceId: '',
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Delete('internal/bots/:botId')
  @HttpCode(HttpStatus.OK)
  public async delete(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.deleteBot({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Get('internal/bots/:botId/stats')
  @HttpCode(HttpStatus.OK)
  public async stats(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.getBotStats({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Get('internal/bots/:botId/logs')
  @HttpCode(HttpStatus.OK)
  public async logs(@CurrentUser() id: string, @Param('botId') botId: string, @Query() query: BotListQueryDto) {
    return await lastValueFrom(
      this.botsClient.listBotAuditLogs({
        botId,
        ownerUserId: id,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Post('internal/bots/:botId/token/regenerate')
  @HttpCode(HttpStatus.OK)
  public async regenerate(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.regenerateBotToken({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Post('internal/bots/:botId/token/revoke')
  @HttpCode(HttpStatus.OK)
  public async revoke(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.revokeBotToken({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Post('internal/bots/:botId/enable')
  @HttpCode(HttpStatus.OK)
  public async enable(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.enableBot({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Post('internal/bots/:botId/disable')
  @HttpCode(HttpStatus.OK)
  public async disable(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.disableBot({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Put('internal/bots/:botId/webhook')
  @HttpCode(HttpStatus.OK)
  public async setWebhook(@CurrentUser() id: string, @Param('botId') botId: string, @Body() dto: SetWebhookRequestDto) {
    return await lastValueFrom(
      this.botsClient.setBotWebhook({
        botId,
        ownerUserId: id,
        url: dto.url ?? '',
        allowedUpdates: dto.allowedUpdates ?? [],
        maxConnections: dto.maxConnections ?? 1,
        ipAllowlist: dto.ipAllowlist ?? [],
        isEnabled: dto.isEnabled ?? true,
        traceId: '',
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Delete('internal/bots/:botId/webhook')
  @HttpCode(HttpStatus.OK)
  public async deleteWebhook(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.deleteBotWebhook({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Get('internal/bots/:botId/webhook')
  @HttpCode(HttpStatus.OK)
  public async getWebhook(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.getBotWebhookInfo({ botId, ownerUserId: id, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Get('internal/bots/:botId/commands')
  @HttpCode(HttpStatus.OK)
  public async getCommands(@CurrentUser() id: string, @Param('botId') botId: string) {
    return await lastValueFrom(this.botsClient.getBotCommands({ botId, ownerUserId: id }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Put('internal/bots/:botId/commands')
  @HttpCode(HttpStatus.OK)
  public async putCommands(@CurrentUser() id: string, @Param('botId') botId: string, @Body() dto: SetCommandsRequestDto) {
    return await lastValueFrom(
      this.botsClient.setBotCommands({
        botId,
        ownerUserId: id,
        commands: (dto.commands ?? []).map((command) => ({
          id: '',
          botId,
          scope: command.scope,
          chatId: command.chatId ?? '',
          command: command.command,
          description: command.description,
          locale: command.locale ?? '',
          createdAt: 0,
          updatedAt: 0,
        })),
        traceId: '',
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Get('internal/bots/:botId/chats')
  @HttpCode(HttpStatus.OK)
  public async chats(@CurrentUser() id: string, @Param('botId') botId: string, @Query() query: BotListQueryDto) {
    return await lastValueFrom(this.botsClient.listBotChats({ botId, ownerUserId: id, limit: Number(query.limit ?? 30), offset: Number(query.offset ?? 0) }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Post('internal/bots/:botId/chats/:chatId/allow')
  @HttpCode(HttpStatus.OK)
  public async allow(@CurrentUser() id: string, @Param('botId') botId: string, @Param('chatId') chatId: string) {
    return await lastValueFrom(this.botsClient.allowBotChat({ botId, ownerUserId: id, chatId, traceId: '' }));
  }

  @ApiBearerAuth('access-token')
  @Protected()
  @Post('internal/bots/:botId/chats/:chatId/deny')
  @HttpCode(HttpStatus.OK)
  public async deny(@CurrentUser() id: string, @Param('botId') botId: string, @Param('chatId') chatId: string) {
    return await lastValueFrom(this.botsClient.denyBotChat({ botId, ownerUserId: id, chatId, traceId: '' }));
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @ApiOperation({ summary: 'Authenticate developer bot token and return bot profile' })
  @Get('bot/me')
  @HttpCode(HttpStatus.OK)
  public async me(@Headers('authorization') authorization?: string) {
    return await lastValueFrom(this.botsClient.getBotMe({ token: extractBotToken(authorization) }));
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @ApiBody({ type: DeveloperSendMessageRequestDto })
  @Post('bot/sendMessage')
  @HttpCode(HttpStatus.OK)
  public async sendMessage(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperSendMessageRequestDto) {
    return await lastValueFrom(
      this.botsClient.sendMessage({
        token: extractBotToken(authorization),
        chatId: dto.chatId,
        text: dto.text ?? '',
        parseMode: dto.parseMode ?? '',
        entitiesJson: dto.entitiesJson ?? '',
        replyToMessageId: dto.replyToMessageId ?? '',
        replyMarkupJson: dto.replyMarkupJson ?? '',
        mediaKeys: dto.mediaKeys ?? [],
        idempotencyKey: dto.idempotencyKey ?? '',
        disableNotification: dto.disableNotification ?? false,
        protectContent: dto.protectContent ?? false,
        traceId: dto.traceId ?? '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @ApiBody({ type: DeveloperSendMediaRequestDto })
  @Post('bot/sendPhoto')
  @HttpCode(HttpStatus.OK)
  public async sendPhoto(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperSendMediaRequestDto) {
    return await lastValueFrom(
      this.botsClient.sendMessage({
        token: extractBotToken(authorization),
        chatId: dto.chatId ?? '',
        text: dto.caption ?? dto.text ?? '',
        mediaKeys: dto.mediaKeys ?? (dto.mediaKey ? [dto.mediaKey] : []),
        replyMarkupJson: dto.replyMarkupJson ?? '',
        replyToMessageId: dto.replyToMessageId ?? '',
        parseMode: dto.parseMode ?? '',
        entitiesJson: dto.entitiesJson ?? '',
        idempotencyKey: dto.idempotencyKey ?? '',
        disableNotification: dto.disableNotification ?? false,
        protectContent: dto.protectContent ?? false,
        traceId: dto.traceId ?? '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/sendVideo')
  @HttpCode(HttpStatus.OK)
  public async sendVideo(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperSendMediaRequestDto) {
    return await this.sendPhoto(authorization, dto);
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/sendDocument')
  @HttpCode(HttpStatus.OK)
  public async sendDocument(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperSendMediaRequestDto) {
    return await this.sendPhoto(authorization, dto);
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/sendAudio')
  @HttpCode(HttpStatus.OK)
  public async sendAudio(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperSendMediaRequestDto) {
    return await this.sendPhoto(authorization, dto);
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/sendMediaGroup')
  @HttpCode(HttpStatus.OK)
  public async sendMediaGroup(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperSendMediaRequestDto) {
    return await this.sendPhoto(authorization, dto);
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @ApiBody({ type: DeveloperEditMessageTextRequestDto })
  @Post('bot/editMessageText')
  @HttpCode(HttpStatus.OK)
  public async editMessageText(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperEditMessageTextRequestDto) {
    return await lastValueFrom(
      this.botsClient.editMessageText({
        token: extractBotToken(authorization),
        chatId: dto.chatId,
        messageId: dto.messageId,
        text: dto.text,
        parseMode: dto.parseMode ?? '',
        entitiesJson: dto.entitiesJson ?? '',
        replyMarkupJson: dto.replyMarkupJson ?? '',
        idempotencyKey: dto.idempotencyKey ?? '',
        traceId: dto.traceId ?? '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/editMessageCaption')
  @HttpCode(HttpStatus.OK)
  public async editMessageCaption(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperEditMessageTextRequestDto) {
    return await lastValueFrom(
      this.botsClient.editMessageText({
        token: extractBotToken(authorization),
        chatId: dto.chatId,
        messageId: dto.messageId,
        text: dto.text,
        parseMode: dto.parseMode ?? '',
        entitiesJson: dto.entitiesJson ?? '',
        replyMarkupJson: dto.replyMarkupJson ?? '',
        idempotencyKey: dto.idempotencyKey ?? '',
        traceId: dto.traceId ?? '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @ApiBody({ type: DeveloperEditMessageReplyMarkupRequestDto })
  @Post('bot/editMessageReplyMarkup')
  @HttpCode(HttpStatus.OK)
  public async editMessageReplyMarkup(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperEditMessageReplyMarkupRequestDto) {
    return await lastValueFrom(
      this.botsClient.editMessageReplyMarkup({
        token: extractBotToken(authorization),
        chatId: dto.chatId,
        messageId: dto.messageId,
        replyMarkupJson: dto.replyMarkupJson ?? '',
        idempotencyKey: dto.idempotencyKey ?? '',
        traceId: dto.traceId ?? '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @ApiBody({ type: DeveloperDeleteMessageRequestDto })
  @Post('bot/deleteMessage')
  @HttpCode(HttpStatus.OK)
  public async deleteMessage(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperDeleteMessageRequestDto) {
    return await lastValueFrom(
      this.botsClient.deleteMessage({
        token: extractBotToken(authorization),
        chatId: dto.chatId,
        messageId: dto.messageId,
        idempotencyKey: dto.idempotencyKey ?? '',
        traceId: dto.traceId ?? '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @ApiBody({ type: DeveloperAnswerCallbackQueryRequestDto })
  @Post('bot/answerCallbackQuery')
  @HttpCode(HttpStatus.OK)
  public async answerCallbackQuery(@Headers('authorization') authorization: string | undefined, @Body() dto: DeveloperAnswerCallbackQueryRequestDto) {
    return await lastValueFrom(
      this.botsClient.answerCallbackQuery({
        token: extractBotToken(authorization),
        callbackQueryId: dto.callbackQueryId,
        text: dto.text ?? '',
        showAlert: dto.showAlert ?? false,
        url: dto.url ?? '',
        cacheTime: dto.cacheTime ?? 0,
        traceId: dto.traceId ?? '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Get('bot/getUpdates')
  @HttpCode(HttpStatus.OK)
  public async getUpdates(@Headers('authorization') authorization: string | undefined, @Query() query: DeveloperGetUpdatesQueryDto) {
    return await lastValueFrom(
      this.botsClient.getUpdates({
        token: extractBotToken(authorization),
        offset: Number(query.offset ?? 0),
        limit: Number(query.limit ?? 30),
        timeout: Number(query.timeout ?? 0),
        allowedUpdates: Array.isArray(query.allowedUpdates)
          ? query.allowedUpdates
          : query.allowedUpdates
            ? [query.allowedUpdates]
            : [],
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/setWebhook')
  @HttpCode(HttpStatus.OK)
  public async developerSetWebhook(@Headers('authorization') authorization: string | undefined, @Body() dto: any) {
    const auth = await lastValueFrom(this.botsClient.authenticateBotToken({ token: extractBotToken(authorization) }));
    return await lastValueFrom(
      this.botsClient.setBotWebhook({
        botId: auth.bot?.id ?? '',
        ownerUserId: auth.bot?.ownerUserId ?? '',
        url: dto.url ?? '',
        allowedUpdates: dto.allowedUpdates ?? [],
        maxConnections: dto.maxConnections ?? 1,
        ipAllowlist: dto.ipAllowlist ?? [],
        isEnabled: true,
        traceId: '',
      }),
    );
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/deleteWebhook')
  @HttpCode(HttpStatus.OK)
  public async developerDeleteWebhook(@Headers('authorization') authorization: string | undefined) {
    const auth = await lastValueFrom(this.botsClient.authenticateBotToken({ token: extractBotToken(authorization) }));
    return await lastValueFrom(this.botsClient.deleteBotWebhook({ botId: auth.bot?.id ?? '', ownerUserId: auth.bot?.ownerUserId ?? '', traceId: '' }));
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Get('bot/getWebhookInfo')
  @HttpCode(HttpStatus.OK)
  public async developerGetWebhookInfo(@Headers('authorization') authorization: string | undefined) {
    const auth = await lastValueFrom(this.botsClient.authenticateBotToken({ token: extractBotToken(authorization) }));
    return await lastValueFrom(this.botsClient.getBotWebhookInfo({ botId: auth.bot?.id ?? '', ownerUserId: auth.bot?.ownerUserId ?? '', traceId: '' }));
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Post('bot/setMyCommands')
  @HttpCode(HttpStatus.OK)
  public async setMyCommands(@Headers('authorization') authorization: string | undefined, @Body() dto: any) {
    const auth = await lastValueFrom(this.botsClient.authenticateBotToken({ token: extractBotToken(authorization) }));
    return await lastValueFrom(this.botsClient.setBotCommands({ botId: auth.bot?.id ?? '', ownerUserId: auth.bot?.ownerUserId ?? '', commands: dto.commands ?? [], traceId: '' }));
  }

  @ApiHeader({ name: 'Authorization', description: 'Bot {botId}:{secretKey}' })
  @Get('bot/getMyCommands')
  @HttpCode(HttpStatus.OK)
  public async getMyCommands(@Headers('authorization') authorization: string | undefined) {
    const auth = await lastValueFrom(this.botsClient.authenticateBotToken({ token: extractBotToken(authorization) }));
    return await lastValueFrom(this.botsClient.getBotCommands({ botId: auth.bot?.id ?? '', ownerUserId: auth.bot?.ownerUserId ?? '' }));
  }
}
