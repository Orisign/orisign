import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Patch,
	Post,
	Query,
	UploadedFile,
	UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOkResponse,
	ApiOperation,
	ApiTags
} from '@nestjs/swagger'
import { lastValueFrom } from 'rxjs'
import { CurrentUser, Protected } from 'src/shared/decorators'
import { FileValidationPipe, MessageFileValidationPipe } from 'src/shared/pipes'

import { ConversationsClientGrpc } from './conversations.grpc'
import {
	AddMembersRequestDto,
	ConversationByIdRequestDto,
	CreateConversationRequestDto,
	CreateConversationResponseDto,
	DeleteConversationMediaRequestDto,
	GetConversationResponseDto,
	ListMyConversationsRequestDto,
	ListMyConversationsResponseDto,
	MutationResponseDto,
	RemoveMemberRequestDto,
	UpdateConversationRequestDto,
	UpdateConversationNotificationsRequestDto,
	UpdateMemberRoleRequestDto,
	UploadConversationAvatarResponseDto,
	UploadConversationMediaResponseDto
} from './dto'
import { MediaClientGrpc } from './media.grpc'

const ONE_GB_IN_BYTES = 1024 * 1024 * 1024
const CHAT_MEDIA_UPLOAD_PREFIX = 'chat-media::'
const CHAT_MEDIA_UPLOAD_KIND_MESSAGES = 'messages'
const CHAT_MEDIA_UPLOAD_KIND_VOICE = 'voice'
const CHAT_MEDIA_UPLOAD_KIND_RING = 'ring'

type ChatMediaUploadKind =
	| typeof CHAT_MEDIA_UPLOAD_KIND_MESSAGES
	| typeof CHAT_MEDIA_UPLOAD_KIND_VOICE
	| typeof CHAT_MEDIA_UPLOAD_KIND_RING

function normalizeMediaUploadKind(value?: string): ChatMediaUploadKind {
	if (value === CHAT_MEDIA_UPLOAD_KIND_VOICE)
		return CHAT_MEDIA_UPLOAD_KIND_VOICE
	if (value === CHAT_MEDIA_UPLOAD_KIND_RING)
		return CHAT_MEDIA_UPLOAD_KIND_RING
	return CHAT_MEDIA_UPLOAD_KIND_MESSAGES
}

function inferMediaUploadKindFromFileName(
	value?: string
): ChatMediaUploadKind | null {
	const normalizedFileName = value?.trim().toLowerCase() ?? ''
	if (normalizedFileName.startsWith('voice-'))
		return CHAT_MEDIA_UPLOAD_KIND_VOICE
	if (normalizedFileName.startsWith('ring-'))
		return CHAT_MEDIA_UPLOAD_KIND_RING
	return null
}

function buildChatMediaUploadFileName(
	fileName: string,
	kind: ChatMediaUploadKind,
	conversationId?: string
) {
	const safeFileName = fileName.replace(/::/g, '-')

	if (
		(kind === CHAT_MEDIA_UPLOAD_KIND_VOICE ||
			kind === CHAT_MEDIA_UPLOAD_KIND_RING) &&
		conversationId
	) {
		return `${CHAT_MEDIA_UPLOAD_PREFIX}${kind}::${conversationId}::${safeFileName}`
	}

	return `${CHAT_MEDIA_UPLOAD_PREFIX}${safeFileName}`
}

@ApiTags('Conversations')
@ApiBearerAuth('access-token')
@Protected()
@Controller('conversations')
export class ConversationsController {
	public constructor(
		private readonly conversationsClient: ConversationsClientGrpc,
		private readonly mediaClient: MediaClientGrpc
	) {}

	@ApiOperation({ summary: 'Создать чат/группу/канал' })
	@ApiBody({ type: CreateConversationRequestDto })
	@ApiOkResponse({
		type: CreateConversationResponseDto,
		description: 'Conversation created'
	})
	@Post()
	@HttpCode(HttpStatus.OK)
	public async create(
		@CurrentUser() id: string,
		@Body() dto: CreateConversationRequestDto
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
				avatarKey: dto.avatarKey ?? ''
			})
		)
	}

	@ApiOperation({ summary: 'Загрузить аватар чата/группы/канала' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary'
				},
				mediaKind: {
					type: 'string',
					enum: [
						CHAT_MEDIA_UPLOAD_KIND_MESSAGES,
						CHAT_MEDIA_UPLOAD_KIND_VOICE,
						CHAT_MEDIA_UPLOAD_KIND_RING
					],
					default: CHAT_MEDIA_UPLOAD_KIND_MESSAGES
				},
				conversationId: {
					type: 'string'
				}
			},
			required: ['file']
		}
	})
	@ApiOkResponse({
		type: UploadConversationAvatarResponseDto,
		description: 'Conversation avatar uploaded'
	})
	@ApiBadRequestResponse({ description: 'Некорректный файл' })
	@Post('avatar')
	@UseInterceptors(FileInterceptor('file'))
	@HttpCode(HttpStatus.OK)
	public async uploadAvatar(
		@CurrentUser() id: string,
		@UploadedFile(FileValidationPipe) file: Express.Multer.File
	) {
		const avatarFileName = file.originalname.startsWith(
			CHAT_MEDIA_UPLOAD_PREFIX
		)
			? file.originalname.slice(CHAT_MEDIA_UPLOAD_PREFIX.length) ||
				'avatar'
			: file.originalname

		const uploadResult = await lastValueFrom(
			this.mediaClient.uploadAvatar({
				accountId: id,
				fileName: avatarFileName,
				contentType: file.mimetype,
				data: file.buffer
			})
		)

		return {
			ok: Boolean(uploadResult.ok && uploadResult.avatar),
			avatar: uploadResult.avatar ?? null
		}
	}

	@ApiOperation({ summary: 'Загрузить медиа-вложение для сообщения' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary'
				}
			},
			required: ['file']
		}
	})
	@ApiOkResponse({
		type: UploadConversationMediaResponseDto,
		description: 'Conversation media uploaded'
	})
	@ApiBadRequestResponse({ description: 'Некорректный файл' })
	@Post('media')
	@UseInterceptors(
		FileInterceptor('file', { limits: { fileSize: ONE_GB_IN_BYTES } })
	)
	@HttpCode(HttpStatus.OK)
	public async uploadMedia(
		@CurrentUser() id: string,
		@Body() body: { mediaKind?: string; conversationId?: string },
		@Query() query: { mediaKind?: string; conversationId?: string },
		@UploadedFile(MessageFileValidationPipe) file: Express.Multer.File
	) {
		const inferredMediaKind = inferMediaUploadKindFromFileName(
			file.originalname
		)
		const mediaKind = normalizeMediaUploadKind(
			body.mediaKind ?? query.mediaKind ?? inferredMediaKind ?? undefined
		)
		const conversationId =
			body.conversationId?.trim() || query.conversationId?.trim()

		if (
			(mediaKind === CHAT_MEDIA_UPLOAD_KIND_VOICE ||
				mediaKind === CHAT_MEDIA_UPLOAD_KIND_RING) &&
			!conversationId
		) {
			throw new BadRequestException(
				'conversationId is required for voice/ring media'
			)
		}

		const uploadFileName = buildChatMediaUploadFileName(
			file.originalname,
			mediaKind,
			conversationId
		)

		const uploadResult = await lastValueFrom(
			this.mediaClient.uploadAvatar({
				accountId: id,
				fileName: uploadFileName,
				contentType: file.mimetype,
				data: file.buffer
			})
		)

		return {
			ok: Boolean(uploadResult.ok && uploadResult.avatar),
			media: uploadResult.avatar ?? null
		}
	}

	@ApiOperation({ summary: 'Удалить медиа-вложение по key' })
	@ApiBody({ type: DeleteConversationMediaRequestDto })
	@ApiOkResponse({
		type: MutationResponseDto,
		description: 'Conversation media deleted'
	})
	@Post('media/delete')
	@HttpCode(HttpStatus.OK)
	public async deleteMedia(
		@CurrentUser() id: string,
		@Body() dto: DeleteConversationMediaRequestDto
	) {
		const canDeleteByKey =
			dto.key.startsWith(`media/messages/${id}/`) ||
			dto.key.startsWith('media/voice/') ||
			dto.key.startsWith('media/ring/')

		if (!canDeleteByKey) {
			throw new BadRequestException('Invalid media key')
		}

		const response = await lastValueFrom(
			this.mediaClient.deleteAvatar({ key: dto.key })
		)

		return {
			ok: Boolean(response.ok)
		}
	}

	@ApiOperation({ summary: 'Получить беседу по id или username' })
	@ApiBody({ type: ConversationByIdRequestDto })
	@ApiOkResponse({
		type: GetConversationResponseDto,
		description: 'Conversation info'
	})
	@Post('get')
	@HttpCode(HttpStatus.OK)
	public async get(
		@CurrentUser() id: string,
		@Body() dto: ConversationByIdRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.getConversation({
				conversationId: dto.conversationId ?? '',
				requesterId: id,
				username: dto.username ?? ''
			})
		)
	}

	@ApiOperation({ summary: 'Список моих бесед' })
	@ApiOkResponse({
		type: ListMyConversationsResponseDto,
		description: 'My conversations'
	})
	@Get('my')
	@HttpCode(HttpStatus.OK)
	public async my(
		@CurrentUser() id: string,
		@Query() dto: ListMyConversationsRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.listMyConversations({
				requesterId: id,
				limit: dto.limit ?? 30,
				offset: dto.offset ?? 0
			})
		)
	}

	@ApiOperation({ summary: 'Добавить участников' })
	@ApiBody({ type: AddMembersRequestDto })
	@ApiOkResponse({ type: MutationResponseDto, description: 'Members added' })
	@Post('members/add')
	@HttpCode(HttpStatus.OK)
	public async addMembers(
		@CurrentUser() id: string,
		@Body() dto: AddMembersRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.addMembers({
				conversationId: dto.conversationId,
				actorId: id,
				memberIds: dto.memberIds
			})
		)
	}

	@ApiOperation({ summary: 'Удалить участника' })
	@ApiBody({ type: RemoveMemberRequestDto })
	@ApiOkResponse({ type: MutationResponseDto, description: 'Member removed' })
	@Post('members/remove')
	@HttpCode(HttpStatus.OK)
	public async removeMember(
		@CurrentUser() id: string,
		@Body() dto: RemoveMemberRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.removeMember({
				conversationId: dto.conversationId,
				actorId: id,
				targetUserId: dto.targetUserId
			})
		)
	}

	@ApiOperation({ summary: 'Изменить роль участника' })
	@ApiBody({ type: UpdateMemberRoleRequestDto })
	@ApiOkResponse({
		type: MutationResponseDto,
		description: 'Member role updated'
	})
	@Patch('members/role')
	@HttpCode(HttpStatus.OK)
	public async updateRole(
		@CurrentUser() id: string,
		@Body() dto: UpdateMemberRoleRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.updateMemberRole({
				conversationId: dto.conversationId,
				actorId: id,
				targetUserId: dto.targetUserId,
				role: dto.role
			})
		)
	}

	@ApiOperation({ summary: 'Обновить параметры беседы' })
	@ApiBody({ type: UpdateConversationRequestDto })
	@ApiOkResponse({
		type: MutationResponseDto,
		description: 'Conversation updated'
	})
	@Patch()
	@HttpCode(HttpStatus.OK)
	public async update(
		@CurrentUser() id: string,
		@Body() dto: UpdateConversationRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.updateConversation({
				conversationId: dto.conversationId,
				actorId: id,
				title: dto.title,
				about: dto.about ?? '',
				isPublic: dto.isPublic,
				username: dto.username ?? '',
				avatarKey: dto.avatarKey ?? '',
				discussionConversationId: dto.discussionConversationId ?? ''
			})
		)
	}

	@ApiOperation({ summary: 'Удалить беседу' })
	@ApiBody({ type: ConversationByIdRequestDto })
	@ApiOkResponse({
		type: MutationResponseDto,
		description: 'Conversation deleted'
	})
	@Post('delete')
	@HttpCode(HttpStatus.OK)
	public async delete(
		@CurrentUser() id: string,
		@Body() dto: ConversationByIdRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.deleteConversation({
				conversationId: dto.conversationId,
				actorId: id
			})
		)
	}

	@ApiOperation({ summary: 'Обновить настройки уведомлений беседы' })
	@ApiBody({ type: UpdateConversationNotificationsRequestDto })
	@ApiOkResponse({
		type: MutationResponseDto,
		description: 'Conversation notifications updated'
	})
	@Patch('notifications')
	@HttpCode(HttpStatus.OK)
	public async updateNotifications(
		@CurrentUser() id: string,
		@Body() dto: UpdateConversationNotificationsRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.updateNotifications({
				conversationId: dto.conversationId,
				userId: id,
				notificationsEnabled: dto.notificationsEnabled
			})
		)
	}

	@ApiOperation({ summary: 'Вступить в публичную беседу/канал' })
	@ApiBody({ type: ConversationByIdRequestDto })
	@ApiOkResponse({ type: MutationResponseDto, description: 'Joined' })
	@Post('join')
	@HttpCode(HttpStatus.OK)
	public async join(
		@CurrentUser() id: string,
		@Body() dto: ConversationByIdRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.joinConversation({
				conversationId: dto.conversationId ?? '',
				userId: id,
				username: dto.username ?? ''
			})
		)
	}

	@ApiOperation({ summary: 'Выйти из беседы' })
	@ApiBody({ type: ConversationByIdRequestDto })
	@ApiOkResponse({ type: MutationResponseDto, description: 'Left' })
	@Post('leave')
	@HttpCode(HttpStatus.OK)
	public async leave(
		@CurrentUser() id: string,
		@Body() dto: ConversationByIdRequestDto
	) {
		return await lastValueFrom(
			this.conversationsClient.leaveConversation({
				conversationId: dto.conversationId,
				userId: id
			})
		)
	}
}
