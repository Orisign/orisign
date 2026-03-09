import {
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
  GetUnreadCountRequestDto,
  GetUnreadCountResponseDto,
  GetReadStateRequestDto,
  GetReadStateResponseDto,
  ListMessagesRequestDto,
  MarkReadRequestDto,
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
    return await lastValueFrom(
      this.messagesClient.editMessage({
        messageId: dto.messageId,
        actorId: id,
        text: dto.text,
      }),
    );
  }

  @ApiOperation({ summary: 'Удалить сообщение' })
  @ApiBody({ type: DeleteMessageRequestDto })
  @ApiOkResponse({ description: 'Message deleted' })
  @Post('delete')
  @HttpCode(HttpStatus.OK)
  public async delete(@CurrentUser() id: string, @Body() dto: DeleteMessageRequestDto) {
    return await lastValueFrom(
      this.messagesClient.deleteMessage({
        messageId: dto.messageId,
        actorId: id,
      }),
    );
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
      this.chatRealtimeService.emitReadCursorUpdated({
        conversationId: dto.conversationId,
        userId: id,
        lastReadMessageId: dto.lastReadMessageId,
        lastReadAt: Date.now(),
      });
    }

    return response;
  }
}
