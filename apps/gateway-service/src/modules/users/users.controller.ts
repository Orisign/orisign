import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { lastValueFrom } from 'rxjs';
import { SkipThrottle } from '@nestjs/throttler';
import { ConversationType, MemberState } from '@repo/contracts/gen/ts/conversations';
import { CurrentUser, Protected } from 'src/shared/decorators';
import { FileValidationPipe } from 'src/shared/pipes';

import {
  CreateUserRequestDto,
  DeleteAvatarRequestDto,
  GetUserResponseDto,
  GetUserRequestDto,
  ListUsersRequestDto,
  ListUsersResponseDto,
  PatchPrivacyRequestDto,
  PatchUserRequestDto,
} from './dto';
import { ConversationsClientGrpc } from '../conversations/conversations.grpc';
import { MediaClientGrpc } from './media.grpc';
import { UsersClientGrpc } from './users.grpc';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  public constructor(
    private readonly usersClient: UsersClientGrpc,
    private readonly mediaClient: MediaClientGrpc,
    private readonly conversationsClient: ConversationsClientGrpc,
  ) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Текущий пользователь',
    description: 'Возвращает профиль текущего авторизованного пользователя',
  })
  @ApiOkResponse({
    description: 'Профиль пользователя',
    type: GetUserResponseDto,
  })
  @SkipThrottle()
  @Protected()
  @Get('me')
  @HttpCode(HttpStatus.OK)
  public async me(@CurrentUser() id: string) {
    return await lastValueFrom(this.usersClient.getUser({ id }));
  }

  @ApiOperation({
    summary: 'Получить пользователя',
    description: 'Получает пользователя по id или username',
  })
  @ApiBody({ type: GetUserRequestDto })
  @ApiOkResponse({
    description: 'Профиль пользователя',
    type: GetUserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Нужно передать хотя бы один идентификатор',
  })
  @Post('get')
  @HttpCode(HttpStatus.OK)
  public async get(@Body() dto: GetUserRequestDto) {
    return await lastValueFrom(this.usersClient.getUser(dto));
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Список пользователей',
    description: 'Возвращает список пользователей с опциональным поиском',
  })
  @ApiBody({ type: ListUsersRequestDto })
  @ApiOkResponse({
    description: 'Список пользователей',
    type: ListUsersResponseDto,
  })
  @Protected()
  @Post('list')
  @HttpCode(HttpStatus.OK)
  public async list(@CurrentUser() id: string, @Body() dto: ListUsersRequestDto) {
    const contactIds = await this.getDirectContactIds(id);
    const excludeIds = [...new Set([id, ...(dto.excludeIds ?? [])])];

    if (contactIds.length === 0) {
      return { users: [] };
    }

    return await lastValueFrom(
      this.usersClient.listUsers({
        query: dto.query ?? '',
        limit: dto.limit ?? 30,
        offset: dto.offset ?? 0,
        excludeIds,
        includeIds: contactIds,
      }),
    );
  }

  private async getDirectContactIds(userId: string) {
    const limit = 200;
    let offset = 0;
    const directPeerIds = new Set<string>();

    while (true) {
      const page = await lastValueFrom(
        this.conversationsClient.listMyConversations({
          requesterId: userId,
          limit,
          offset,
        }),
      );

      const conversations = page.conversations ?? [];
      for (const conversation of conversations) {
        if (conversation.type !== ConversationType.DM) {
          continue;
        }

        for (const member of conversation.members ?? []) {
          if (member.userId === userId || member.state !== MemberState.ACTIVE) {
            continue;
          }

          directPeerIds.add(member.userId);
        }
      }

      if (conversations.length < limit) {
        break;
      }

      offset += limit;
    }

    return [...directPeerIds];
  }

  @ApiOperation({
    summary: 'Создать пользователя',
    description: 'Создаёт пользователя в users-service по id',
  })
  @ApiBody({ type: CreateUserRequestDto })
  @ApiOkResponse({ description: 'Пользователь создан' })
  @Post('create')
  @HttpCode(HttpStatus.OK)
  public async create(@Body() dto: CreateUserRequestDto) {
    return await lastValueFrom(this.usersClient.createUser(dto));
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Обновить профиль',
    description: 'Частично обновляет основные поля профиля пользователя',
  })
  @ApiBody({ type: PatchUserRequestDto })
  @ApiOkResponse({ description: 'Профиль обновлён' })
  @Protected()
  @Patch()
  @HttpCode(HttpStatus.OK)
  public async patch(
    @CurrentUser() id: string,
    @Body() dto: PatchUserRequestDto,
  ) {
    return await lastValueFrom(
      this.usersClient.patchUser({
        userId: id,
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        bio: dto.bio,
        avatars: dto.avatars ? { values: dto.avatars } : undefined,
        birthDate: dto.birthDate ? new Date(dto.birthDate).getTime() : undefined,
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Обновить приватность',
    description: 'Частично обновляет настройки приватности текущего пользователя',
  })
  @ApiBody({ type: PatchPrivacyRequestDto })
  @ApiOkResponse({ description: 'Настройки приватности обновлены' })
  @Protected()
  @Patch('privacy')
  @HttpCode(HttpStatus.OK)
  public async patchPrivacy(
    @CurrentUser() id: string,
    @Body() dto: PatchPrivacyRequestDto,
  ) {
    return await lastValueFrom(
      this.usersClient.patchPrivacySettings({
        userId: id,
        phone: dto.phone,
        lastSeenTime: dto.lastSeenTime,
        photo: dto.photo,
        bio: dto.bio,
        call: dto.call,
        reply: dto.reply,
        invite: dto.invite,
        mediaMessage: dto.mediaMessage,
        message: dto.message,
        birthDate: dto.birthDate,
      }),
    );
  }

  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Добавить аватар',
    description: 'Загружает новый аватар в media-service и добавляет его key в профиль',
  })
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
  @ApiOkResponse({ description: 'Аватар добавлен' })
  @ApiBadRequestResponse({ description: 'Некорректный файл' })
  @Protected()
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  public async addAvatar(
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

    const key = uploadResult.avatar?.key;
    if (!key) {
      return { ok: false };
    }

    const current = await lastValueFrom(this.usersClient.getUser({ id }));
    const avatars = current.user?.avatars ?? [];
    const nextAvatars = avatars.includes(key) ? avatars : [...avatars, key];

    await lastValueFrom(
      this.usersClient.patchUser({
        userId: id,
        avatars: { values: nextAvatars },
      }),
    );

    return {
      ok: true,
      avatar: uploadResult.avatar,
    };
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Удалить аватар',
    description: 'Удаляет аватар из media-service и убирает его key из профиля',
  })
  @ApiBody({ type: DeleteAvatarRequestDto })
  @ApiOkResponse({ description: 'Аватар удален' })
  @Protected()
  @Delete('avatar')
  public async deleteAvatar(
    @CurrentUser() id: string,
    @Body() dto: DeleteAvatarRequestDto,
  ) {
    await lastValueFrom(this.mediaClient.deleteAvatar({ key: dto.key }));

    const current = await lastValueFrom(this.usersClient.getUser({ id }));
    const avatars = current.user?.avatars ?? [];
    const nextAvatars = avatars.filter((avatar) => avatar !== dto.key);

    await lastValueFrom(
      this.usersClient.patchUser({
        userId: id,
        avatars: { values: nextAvatars },
      }),
    );

    return { ok: true };
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Получить URL аватара',
    description: 'Возвращает короткоживущий signed URL для приватного аватара',
  })
  @ApiBody({ type: DeleteAvatarRequestDto })
  @ApiOkResponse({ description: 'Signed URL получен' })
  @SkipThrottle()
  @Protected()
  @Post('avatar/url')
  public async getAvatarUrl(@Body() dto: DeleteAvatarRequestDto) {
    return await lastValueFrom(this.mediaClient.getAvatarUrl({ key: dto.key }));
  }
}
