import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { CurrentUser, Protected } from 'src/shared/decorators';
import {
  DeleteMessageRequestDto,
  EditMessageRequestDto,
  GetUserBlockStatusRequestDto,
  GetUserBlockStatusResponseDto,
  GetUnreadCountRequestDto,
  GetUnreadCountResponseDto,
  GetReadStateRequestDto,
  GetReadStateResponseDto,
  ListMessagesRequestDto,
  MarkReadRequestDto,
  SetUserBlockRequestDto,
  SendMessageRequestDto,
} from './dto';
import { ChatRealtimeService } from './chat-realtime.service';
import { MessagesClientGrpc } from './messages.grpc';

@ApiTags('Messages')
@ApiBearerAuth('access-token')
@Protected()
@Controller('messages')
export class MessagesController {
  public constructor(
    private readonly messagesClient: MessagesClientGrpc,
    private readonly chatRealtimeService: ChatRealtimeService,
  ) {}

  @ApiOperation({ summary: 'Отправить сообщение' })
  @ApiBody({ type: SendMessageRequestDto })
  @ApiOkResponse({ description: 'Message sent' })
  @Post('send')
  @HttpCode(HttpStatus.OK)
  public async send(@CurrentUser() id: string, @Body() dto: SendMessageRequestDto) {
    const response = await lastValueFrom(
      this.messagesClient.sendMessage({
        conversationId: dto.conversationId,
        authorId: id,
        kind: dto.kind,
        text: dto.text ?? '',
        replyToId: dto.replyToId ?? '',
        mediaKeys: dto.mediaKeys ?? [],
      }),
    );

    if (response?.ok && response.message) {
      this.chatRealtimeService.emitMessageCreated(response.message);
      this.chatRealtimeService.emitChatListInvalidate({
        conversationId: response.message.conversationId,
        actorId: id,
        reason: 'message.sent',
      });
    }

    return response;
  }

  @ApiOperation({ summary: 'Список сообщений' })
  @ApiBody({ type: ListMessagesRequestDto })
  @ApiOkResponse({ description: 'Messages list' })
  @Post('list')
  @HttpCode(HttpStatus.OK)
  public async list(@CurrentUser() id: string, @Body() dto: ListMessagesRequestDto) {
    return await lastValueFrom(
      this.messagesClient.listMessages({
        conversationId: dto.conversationId,
        requesterId: id,
        limit: dto.limit ?? 30,
        offset: dto.offset ?? 0,
      }),
    );
  }

  @ApiOperation({ summary: 'Read-cursors беседы' })
  @ApiBody({ type: GetReadStateRequestDto })
  @ApiOkResponse({ type: GetReadStateResponseDto })
  @Post('read-state')
  @HttpCode(HttpStatus.OK)
  public async readState(
    @CurrentUser() id: string,
    @Body() dto: GetReadStateRequestDto,
  ) {
    return await lastValueFrom(
      this.messagesClient.getReadState({
        conversationId: dto.conversationId,
        requesterId: id,
      }),
    );
  }

  @ApiOperation({ summary: 'Счётчик непрочитанных сообщений в беседе' })
  @ApiBody({ type: GetUnreadCountRequestDto })
  @ApiOkResponse({ type: GetUnreadCountResponseDto })
  @Post('unread-count')
  @HttpCode(HttpStatus.OK)
  public async unreadCount(
    @CurrentUser() id: string,
    @Body() dto: GetUnreadCountRequestDto,
  ) {
    return await lastValueFrom(
      this.messagesClient.getUnreadCount({
        conversationId: dto.conversationId,
        requesterId: id,
      }),
    );
  }

  @ApiOperation({ summary: 'Редактировать сообщение' })
  @ApiBody({ type: EditMessageRequestDto })
  @ApiOkResponse({ description: 'Message edited' })
  @Post('edit')
  @HttpCode(HttpStatus.OK)
  public async edit(@CurrentUser() id: string, @Body() dto: EditMessageRequestDto) {
    const response = await lastValueFrom(
      this.messagesClient.editMessage({
        messageId: dto.messageId,
        actorId: id,
        text: dto.text,
      }),
    );

    if (response?.ok && dto.conversationId) {
      const editedAt = Date.now();

      this.chatRealtimeService.emitMessageUpdated({
        conversationId: dto.conversationId,
        messageId: dto.messageId,
        text: dto.text,
        editedAt,
      });
      this.chatRealtimeService.emitChatListInvalidate({
        conversationId: dto.conversationId,
        actorId: id,
        reason: 'message.edited',
      });
    } else if (response?.ok) {
      this.chatRealtimeService.emitChatListInvalidate({
        actorId: id,
        reason: 'message.edited',
      });
    }

    return response;
  }

  @ApiOperation({ summary: 'Удалить сообщение' })
  @ApiBody({ type: DeleteMessageRequestDto })
  @ApiOkResponse({ description: 'Message deleted' })
  @Post('delete')
  @HttpCode(HttpStatus.OK)
  public async delete(@CurrentUser() id: string, @Body() dto: DeleteMessageRequestDto) {
    const messageIds = [
      ...(dto.messageId?.trim() ? [dto.messageId.trim()] : []),
      ...((dto.messageIds ?? []).map((messageId) => messageId.trim()).filter(Boolean)),
    ].filter((messageId, index, allMessageIds) => allMessageIds.indexOf(messageId) === index);

    if (messageIds.length === 0) {
      throw new BadRequestException('messageId or messageIds[] is required');
    }

    const results = await Promise.allSettled(
      messageIds.map(async (messageId) => ({
        messageId,
        response: await lastValueFrom(
          this.messagesClient.deleteMessage({
            messageId,
            actorId: id,
          }),
        ),
      })),
    );

    const deletedMessageIds = results.flatMap((result) =>
      result.status === 'fulfilled' && result.value.response?.ok
        ? [result.value.messageId]
        : [],
    );
    const failedMessageIds = results.flatMap((result, index) =>
      result.status === 'rejected' ||
      (result.status === 'fulfilled' && !result.value.response?.ok)
        ? [messageIds[index]]
        : [],
    );

    if (dto.conversationId && deletedMessageIds.length > 0) {
      const deletedAt = Date.now();

      deletedMessageIds.forEach((messageId) => {
        this.chatRealtimeService.emitMessageDeleted({
          conversationId: dto.conversationId as string,
          messageId,
          deletedAt,
        });
      });
      this.chatRealtimeService.emitChatListInvalidate({
        conversationId: dto.conversationId,
        actorId: id,
        reason: 'message.deleted',
      });
    } else if (deletedMessageIds.length > 0) {
      this.chatRealtimeService.emitChatListInvalidate({
        actorId: id,
        reason: 'message.deleted',
      });
    }

    return {
      ok: failedMessageIds.length === 0,
      deletedMessageIds,
      failedMessageIds,
    };
  }

  @ApiOperation({ summary: 'Обновить read-cursor' })
  @ApiBody({ type: MarkReadRequestDto })
  @ApiOkResponse({ description: 'Read cursor updated' })
  @Post('read')
  @HttpCode(HttpStatus.OK)
  public async read(@CurrentUser() id: string, @Body() dto: MarkReadRequestDto) {
    const response = await lastValueFrom(
      this.messagesClient.markRead({
        conversationId: dto.conversationId,
        userId: id,
        lastReadMessageId: dto.lastReadMessageId ?? '',
      }),
    );

    if (response?.ok && dto.lastReadMessageId) {
      const readState = await lastValueFrom(
        this.messagesClient.getReadState({
          conversationId: dto.conversationId,
          requesterId: id,
        }),
      );
      const actorCursor = (readState.cursors ?? []).find((cursor) => cursor.userId === id);

      if (!actorCursor?.lastReadMessageId) {
        return response;
      }

      this.chatRealtimeService.emitReadCursorUpdated({
        conversationId: dto.conversationId,
        userId: id,
        lastReadMessageId: actorCursor.lastReadMessageId,
        lastReadAt: actorCursor.lastReadAt,
      });
    }

    return response;
  }

  @ApiOperation({ summary: 'Заблокировать/разблокировать пользователя для личных чатов' })
  @ApiBody({ type: SetUserBlockRequestDto })
  @ApiOkResponse({ description: 'Block status updated' })
  @Post('block')
  @HttpCode(HttpStatus.OK)
  public async setUserBlock(
    @CurrentUser() id: string,
    @Body() dto: SetUserBlockRequestDto,
  ) {
    return await lastValueFrom(
      this.messagesClient.setUserBlock({
        actorId: id,
        targetUserId: dto.targetUserId,
        blocked: dto.blocked,
      }),
    );
  }

  @ApiOperation({ summary: 'Статус блокировки пользователя' })
  @ApiBody({ type: GetUserBlockStatusRequestDto })
  @ApiOkResponse({ type: GetUserBlockStatusResponseDto })
  @Post('block/status')
  @HttpCode(HttpStatus.OK)
  public async getUserBlockStatus(
    @CurrentUser() id: string,
    @Body() dto: GetUserBlockStatusRequestDto,
  ) {
    const [actorToTarget, targetToActor] = await Promise.all([
      lastValueFrom(
        this.messagesClient.getUserBlockStatus({
          actorId: id,
          targetUserId: dto.targetUserId,
        }),
      ),
      lastValueFrom(
        this.messagesClient.getUserBlockStatus({
          actorId: dto.targetUserId,
          targetUserId: id,
        }),
      ),
    ]);

    return {
      blocked: Boolean(actorToTarget?.blocked),
      blockedByTarget: Boolean(targetToActor?.blocked),
    };
  }
}
