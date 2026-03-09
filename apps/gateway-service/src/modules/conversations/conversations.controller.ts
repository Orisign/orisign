import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { lastValueFrom } from 'rxjs';
import { CurrentUser, Protected } from 'src/shared/decorators';
import { FileValidationPipe } from 'src/shared/pipes';
import { ConversationsClientGrpc } from './conversations.grpc';
import {
  AddMembersRequestDto,
  ConversationByIdRequestDto,
  CreateConversationResponseDto,
  CreateConversationRequestDto,
  GetConversationResponseDto,
  ListMyConversationsRequestDto,
  ListMyConversationsResponseDto,
  MutationResponseDto,
  RemoveMemberRequestDto,
  UploadConversationAvatarResponseDto,
  UpdateMemberRoleRequestDto,
} from './dto';
import { MediaClientGrpc } from './media.grpc';

@ApiTags('Conversations')
@ApiBearerAuth('access-token')
@Protected()
@Controller('conversations')
export class ConversationsController {
  public constructor(
    private readonly conversationsClient: ConversationsClientGrpc,
    private readonly mediaClient: MediaClientGrpc,
  ) {}

  @ApiOperation({ summary: 'Создать чат/группу/канал' })
  @ApiBody({ type: CreateConversationRequestDto })
  @ApiOkResponse({
    type: CreateConversationResponseDto,
    description: 'Conversation created',
  })
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
        avatarKey: dto.avatarKey ?? '',
      }),
    );
  }

  @ApiOperation({ summary: 'Загрузить аватар чата/группы/канала' })
  @ApiConsumes('multipart/form-data')
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
  @ApiOkResponse({
    type: UploadConversationAvatarResponseDto,
    description: 'Conversation avatar uploaded',
  })
  @ApiBadRequestResponse({ description: 'Некорректный файл' })
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  public async uploadAvatar(
    @CurrentUser() id: string,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ) {
    const uploadResult = await lastValueFrom(
      this.mediaClient.uploadAvatar({
        accountId: id,
        fileName: file.originalname,
        contentType: file.mimetype,
        data: file.buffer,
      }),
    );

    return {
      ok: Boolean(uploadResult.ok && uploadResult.avatar),
      avatar: uploadResult.avatar ?? null,
    };
  }

  @ApiOperation({ summary: 'Получить беседу по id' })
  @ApiBody({ type: ConversationByIdRequestDto })
  @ApiOkResponse({ type: GetConversationResponseDto, description: 'Conversation info' })
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
  @ApiOkResponse({ type: ListMyConversationsResponseDto, description: 'My conversations' })
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
  @ApiOkResponse({ type: MutationResponseDto, description: 'Members added' })
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
  @ApiOkResponse({ type: MutationResponseDto, description: 'Member removed' })
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
  @ApiOkResponse({ type: MutationResponseDto, description: 'Member role updated' })
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
  @ApiOkResponse({ type: MutationResponseDto, description: 'Joined' })
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
  @ApiOkResponse({ type: MutationResponseDto, description: 'Left' })
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
