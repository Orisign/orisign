import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
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
import { ConversationsClientGrpc } from './conversations.grpc';
import {
  AddMembersRequestDto,
  ConversationByIdRequestDto,
  CreateConversationRequestDto,
  ListMyConversationsRequestDto,
  RemoveMemberRequestDto,
  UpdateMemberRoleRequestDto,
} from './dto';

@ApiTags('Conversations')
@ApiBearerAuth('access-token')
@Protected()
@Controller('conversations')
export class ConversationsController {
  public constructor(private readonly conversationsClient: ConversationsClientGrpc) {}

  @ApiOperation({ summary: 'Создать чат/группу/канал' })
  @ApiBody({ type: CreateConversationRequestDto })
  @ApiOkResponse({ description: 'Conversation created' })
  @Post()
  @HttpCode(HttpStatus.OK)
  public async create(
    @CurrentUser() id: string,
    @Body() dto: CreateConversationRequestDto,
  ) {
    return await lastValueFrom(
      this.conversationsClient.createConversation({
        type: dto.type,
        creatorId: id,
        title: dto.title ?? '',
        about: dto.about ?? '',
        isPublic: dto.isPublic ?? false,
        username: dto.username ?? '',
        memberIds: dto.memberIds ?? [],
      }),
    );
  }

  @ApiOperation({ summary: 'Получить беседу по id' })
  @ApiBody({ type: ConversationByIdRequestDto })
  @ApiOkResponse({ description: 'Conversation info' })
  @Post('get')
  @HttpCode(HttpStatus.OK)
  public async get(@CurrentUser() id: string, @Body() dto: ConversationByIdRequestDto) {
    return await lastValueFrom(
      this.conversationsClient.getConversation({
        conversationId: dto.conversationId,
        requesterId: id,
      }),
    );
  }

  @ApiOperation({ summary: 'Список моих бесед' })
  @ApiOkResponse({ description: 'My conversations' })
  @Get('my')
  @HttpCode(HttpStatus.OK)
  public async my(@CurrentUser() id: string, @Query() dto: ListMyConversationsRequestDto) {
    return await lastValueFrom(
      this.conversationsClient.listMyConversations({
        requesterId: id,
        limit: dto.limit ?? 30,
        offset: dto.offset ?? 0,
      }),
    );
  }

  @ApiOperation({ summary: 'Добавить участников' })
  @ApiBody({ type: AddMembersRequestDto })
  @ApiOkResponse({ description: 'Members added' })
  @Post('members/add')
  @HttpCode(HttpStatus.OK)
  public async addMembers(@CurrentUser() id: string, @Body() dto: AddMembersRequestDto) {
    return await lastValueFrom(
      this.conversationsClient.addMembers({
        conversationId: dto.conversationId,
        actorId: id,
        memberIds: dto.memberIds,
      }),
    );
  }

  @ApiOperation({ summary: 'Удалить участника' })
  @ApiBody({ type: RemoveMemberRequestDto })
  @ApiOkResponse({ description: 'Member removed' })
  @Post('members/remove')
  @HttpCode(HttpStatus.OK)
  public async removeMember(@CurrentUser() id: string, @Body() dto: RemoveMemberRequestDto) {
    return await lastValueFrom(
      this.conversationsClient.removeMember({
        conversationId: dto.conversationId,
        actorId: id,
        targetUserId: dto.targetUserId,
      }),
    );
  }

  @ApiOperation({ summary: 'Изменить роль участника' })
  @ApiBody({ type: UpdateMemberRoleRequestDto })
  @ApiOkResponse({ description: 'Member role updated' })
  @Patch('members/role')
  @HttpCode(HttpStatus.OK)
  public async updateRole(@CurrentUser() id: string, @Body() dto: UpdateMemberRoleRequestDto) {
    return await lastValueFrom(
      this.conversationsClient.updateMemberRole({
        conversationId: dto.conversationId,
        actorId: id,
        targetUserId: dto.targetUserId,
        role: dto.role,
      }),
    );
  }

  @ApiOperation({ summary: 'Вступить в публичную беседу/канал' })
  @ApiBody({ type: ConversationByIdRequestDto })
  @ApiOkResponse({ description: 'Joined' })
  @Post('join')
  @HttpCode(HttpStatus.OK)
  public async join(@CurrentUser() id: string, @Body() dto: ConversationByIdRequestDto) {
    return await lastValueFrom(
      this.conversationsClient.joinConversation({
        conversationId: dto.conversationId,
        userId: id,
      }),
    );
  }

  @ApiOperation({ summary: 'Выйти из беседы' })
  @ApiBody({ type: ConversationByIdRequestDto })
  @ApiOkResponse({ description: 'Left' })
  @Post('leave')
  @HttpCode(HttpStatus.OK)
  public async leave(@CurrentUser() id: string, @Body() dto: ConversationByIdRequestDto) {
    return await lastValueFrom(
      this.conversationsClient.leaveConversation({
        conversationId: dto.conversationId,
        userId: id,
      }),
    );
  }
}
