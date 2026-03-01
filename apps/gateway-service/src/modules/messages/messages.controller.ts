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
  ListMessagesRequestDto,
  MarkReadRequestDto,
  SendMessageRequestDto,
} from './dto';
import { MessagesClientGrpc } from './messages.grpc';

@ApiTags('Messages')
@ApiBearerAuth('access-token')
@Protected()
@Controller('messages')
export class MessagesController {
  public constructor(private readonly messagesClient: MessagesClientGrpc) {}

  @ApiOperation({ summary: 'Отправить сообщение' })
  @ApiBody({ type: SendMessageRequestDto })
  @ApiOkResponse({ description: 'Message sent' })
  @Post('send')
  @HttpCode(HttpStatus.OK)
  public async send(@CurrentUser() id: string, @Body() dto: SendMessageRequestDto) {
    return await lastValueFrom(
      this.messagesClient.sendMessage({
        conversationId: dto.conversationId,
        authorId: id,
        kind: dto.kind,
        text: dto.text ?? '',
        replyToId: dto.replyToId ?? '',
        mediaKeys: dto.mediaKeys ?? [],
      }),
    );
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
    return await lastValueFrom(
      this.messagesClient.markRead({
        conversationId: dto.conversationId,
        userId: id,
        lastReadMessageId: dto.lastReadMessageId ?? '',
      }),
    );
  }
}
