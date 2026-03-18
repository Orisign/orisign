import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post
} from '@nestjs/common'
import {
	ApiBearerAuth,
	ApiBody,
	ApiOkResponse,
	ApiOperation,
	ApiTags
} from '@nestjs/swagger'
import { lastValueFrom } from 'rxjs'
import { CurrentUser, Protected } from 'src/shared/decorators'

import { ChatRealtimeService } from './chat-realtime.service'
import {
	DeleteMessageRequestDto,
	EditMessageRequestDto,
	GetReadStateRequestDto,
	GetReadStateResponseDto,
	ListSharedMediaRequestDto,
	ListSharedMediaResponseDto,
	GetUnreadCountRequestDto,
	GetUnreadCountResponseDto,
	GetUserBlockStatusRequestDto,
	GetUserBlockStatusResponseDto,
	ListMessagesRequestDto,
	MarkReadRequestDto,
	SendMessageRequestDto,
	SharedMediaFilter,
	SetUserBlockRequestDto
} from './dto'
import { MessagesClientGrpc } from './messages.grpc'

const MEDIA_SCAN_PAGE_SIZE = 120
const MAX_MEDIA_SCAN_MESSAGES = 5000
const IMAGE_MEDIA_EXTENSIONS = [
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.avif',
	'.bmp',
	'.svg'
] as const
const VIDEO_MEDIA_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.mkv'] as const
const AUDIO_MEDIA_EXTENSIONS = [
	'.mp3',
	'.wav',
	'.ogg',
	'.m4a',
	'.aac',
	'.opus',
	'.flac'
] as const
const URL_MATCHER = /(https?:\/\/[^\s<>()]+)/i

type SharedMediaMessage = {
	id?: string
	conversationId?: string
	authorId?: string
	text?: string
	mediaKeys?: string[]
	createdAt?: number
}

function normalizeMediaKey(value?: string) {
	if (!value) return ''
	return value.toLowerCase().split('?')[0]
}

function isImageMediaKey(value?: string) {
	const normalized = normalizeMediaKey(value)
	return IMAGE_MEDIA_EXTENSIONS.some(extension =>
		normalized.endsWith(extension)
	)
}

function isVideoMediaKey(value?: string) {
	const normalized = normalizeMediaKey(value)
	return VIDEO_MEDIA_EXTENSIONS.some(extension =>
		normalized.endsWith(extension)
	)
}

function isVoiceMediaKey(value?: string) {
	const normalized = normalizeMediaKey(value)
	if (!normalized) return false

	return (
		normalized.includes('/media/voice/') ||
		normalized.includes('\\media\\voice\\') ||
		AUDIO_MEDIA_EXTENSIONS.some(extension => normalized.endsWith(extension))
	)
}

function isRingMediaKey(value?: string) {
	const normalized = normalizeMediaKey(value)
	if (!normalized) return false

	return (
		normalized.includes('/media/ring/') ||
		normalized.includes('\\media\\ring\\')
	)
}

function hasLinks(text?: string) {
	if (!text) return false
	return URL_MATCHER.test(text)
}

function matchesSharedMediaFilter(
	message: SharedMediaMessage,
	filter: SharedMediaFilter
) {
	const mediaKeys = message.mediaKeys ?? []

	switch (filter) {
		case 'links':
			return hasLinks(message.text)
		case 'voice':
			return mediaKeys.some(mediaKey => isVoiceMediaKey(mediaKey))
		case 'files':
			return mediaKeys.some(mediaKey => {
				return (
					!isImageMediaKey(mediaKey) &&
					!isVideoMediaKey(mediaKey) &&
					!isVoiceMediaKey(mediaKey) &&
					!isRingMediaKey(mediaKey)
				)
			})
		case 'media':
		default:
			return mediaKeys.some(
				mediaKey =>
					isImageMediaKey(mediaKey) ||
					isVideoMediaKey(mediaKey) ||
					isRingMediaKey(mediaKey)
			)
	}
}

function toSharedMediaItem(message: SharedMediaMessage) {
	return {
		messageId: message.id ?? '',
		conversationId: message.conversationId ?? '',
		authorId: message.authorId ?? '',
		text: message.text ?? '',
		mediaKeys: message.mediaKeys ?? [],
		createdAt: message.createdAt ?? 0
	}
}

@ApiTags('Messages')
@ApiBearerAuth('access-token')
@Protected()
@Controller('messages')
export class MessagesController {
	public constructor(
		private readonly messagesClient: MessagesClientGrpc,
		private readonly chatRealtimeService: ChatRealtimeService
	) {}

	@ApiOperation({ summary: 'Отправить сообщение' })
	@ApiBody({ type: SendMessageRequestDto })
	@ApiOkResponse({ description: 'Message sent' })
	@Post('send')
	@HttpCode(HttpStatus.OK)
	public async send(
		@CurrentUser() id: string,
		@Body() dto: SendMessageRequestDto
	) {
		const response = await lastValueFrom(
			this.messagesClient.sendMessage({
				conversationId: dto.conversationId,
				authorId: id,
				kind: dto.kind,
				text: dto.text ?? '',
				replyToId: dto.replyToId ?? '',
				mediaKeys: dto.mediaKeys ?? []
			})
		)

		if (response?.ok && response.message) {
			this.chatRealtimeService.emitMessageCreated(response.message)
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: response.message.conversationId,
				actorId: id,
				reason: 'message.sent'
			})
		}

		return response
	}

	@ApiOperation({ summary: 'Список сообщений' })
	@ApiBody({ type: ListMessagesRequestDto })
	@ApiOkResponse({ description: 'Messages list' })
	@Post('list')
	@HttpCode(HttpStatus.OK)
	public async list(
		@CurrentUser() id: string,
		@Body() dto: ListMessagesRequestDto
	) {
		return await lastValueFrom(
			this.messagesClient.listMessages({
				conversationId: dto.conversationId,
				requesterId: id,
				limit: dto.limit ?? 30,
				offset: dto.offset ?? 0
			})
		)
	}

	@ApiOperation({
		summary: 'Список медиа/файлов/ссылок беседы для правой панели'
	})
	@ApiBody({ type: ListSharedMediaRequestDto })
	@ApiOkResponse({ type: ListSharedMediaResponseDto })
	@Post('shared-media')
	@HttpCode(HttpStatus.OK)
	public async listSharedMedia(
		@CurrentUser() id: string,
		@Body() dto: ListSharedMediaRequestDto
	) {
		const filter = dto.filter ?? 'media'
		const limit = dto.limit ?? 40
		const offset = dto.offset ?? 0
		const items: ListSharedMediaResponseDto['items'] = []

		let matchedTotal = 0
		let scanOffset = 0
		let scanned = 0

		while (items.length < limit && scanned < MAX_MEDIA_SCAN_MESSAGES) {
			const response = await lastValueFrom(
				this.messagesClient.listMessages({
					conversationId: dto.conversationId,
					requesterId: id,
					limit: MEDIA_SCAN_PAGE_SIZE,
					offset: scanOffset
				})
			)
			const pageMessages = response.messages ?? []

			if (pageMessages.length === 0) {
				break
			}

			for (const message of pageMessages) {
				if (!matchesSharedMediaFilter(message, filter)) {
					continue
				}

				if (matchedTotal < offset) {
					matchedTotal += 1
					continue
				}

				items.push(toSharedMediaItem(message))
				if (items.length >= limit) {
					break
				}
			}

			scanOffset += pageMessages.length
			scanned += pageMessages.length

			if (pageMessages.length < MEDIA_SCAN_PAGE_SIZE) {
				break
			}
		}

		return { items }
	}

	@ApiOperation({ summary: 'Read-cursors беседы' })
	@ApiBody({ type: GetReadStateRequestDto })
	@ApiOkResponse({ type: GetReadStateResponseDto })
	@Post('read-state')
	@HttpCode(HttpStatus.OK)
	public async readState(
		@CurrentUser() id: string,
		@Body() dto: GetReadStateRequestDto
	) {
		return await lastValueFrom(
			this.messagesClient.getReadState({
				conversationId: dto.conversationId,
				requesterId: id
			})
		)
	}

	@ApiOperation({ summary: 'Счётчик непрочитанных сообщений в беседе' })
	@ApiBody({ type: GetUnreadCountRequestDto })
	@ApiOkResponse({ type: GetUnreadCountResponseDto })
	@Post('unread-count')
	@HttpCode(HttpStatus.OK)
	public async unreadCount(
		@CurrentUser() id: string,
		@Body() dto: GetUnreadCountRequestDto
	) {
		return await lastValueFrom(
			this.messagesClient.getUnreadCount({
				conversationId: dto.conversationId,
				requesterId: id
			})
		)
	}

	@ApiOperation({ summary: 'Редактировать сообщение' })
	@ApiBody({ type: EditMessageRequestDto })
	@ApiOkResponse({ description: 'Message edited' })
	@Post('edit')
	@HttpCode(HttpStatus.OK)
	public async edit(
		@CurrentUser() id: string,
		@Body() dto: EditMessageRequestDto
	) {
		const response = await lastValueFrom(
			this.messagesClient.editMessage({
				messageId: dto.messageId,
				actorId: id,
				text: dto.text
			})
		)

		if (response?.ok && dto.conversationId) {
			const editedAt = Date.now()

			this.chatRealtimeService.emitMessageUpdated({
				conversationId: dto.conversationId,
				messageId: dto.messageId,
				text: dto.text,
				editedAt
			})
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: dto.conversationId,
				actorId: id,
				reason: 'message.edited'
			})
		} else if (response?.ok) {
			this.chatRealtimeService.emitChatListInvalidate({
				actorId: id,
				reason: 'message.edited'
			})
		}

		return response
	}

	@ApiOperation({ summary: 'Удалить сообщение' })
	@ApiBody({ type: DeleteMessageRequestDto })
	@ApiOkResponse({ description: 'Message deleted' })
	@Post('delete')
	@HttpCode(HttpStatus.OK)
	public async delete(
		@CurrentUser() id: string,
		@Body() dto: DeleteMessageRequestDto
	) {
		const messageIds = [
			...(dto.messageId?.trim() ? [dto.messageId.trim()] : []),
			...(dto.messageIds ?? [])
				.map(messageId => messageId.trim())
				.filter(Boolean)
		].filter(
			(messageId, index, allMessageIds) =>
				allMessageIds.indexOf(messageId) === index
		)

		if (messageIds.length === 0) {
			throw new BadRequestException(
				'messageId or messageIds[] is required'
			)
		}

		const results = await Promise.allSettled(
			messageIds.map(async messageId => ({
				messageId,
				response: await lastValueFrom(
					this.messagesClient.deleteMessage({
						messageId,
						actorId: id
					})
				)
			}))
		)

		const deletedMessageIds = results.flatMap(result =>
			result.status === 'fulfilled' && result.value.response?.ok
				? [result.value.messageId]
				: []
		)
		const failedMessageIds = results.flatMap((result, index) =>
			result.status === 'rejected' ||
			(result.status === 'fulfilled' && !result.value.response?.ok)
				? [messageIds[index]]
				: []
		)

		if (dto.conversationId && deletedMessageIds.length > 0) {
			const deletedAt = Date.now()

			deletedMessageIds.forEach(messageId => {
				this.chatRealtimeService.emitMessageDeleted({
					conversationId: dto.conversationId as string,
					messageId,
					deletedAt
				})
			})
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: dto.conversationId,
				actorId: id,
				reason: 'message.deleted'
			})
		} else if (deletedMessageIds.length > 0) {
			this.chatRealtimeService.emitChatListInvalidate({
				actorId: id,
				reason: 'message.deleted'
			})
		}

		return {
			ok: failedMessageIds.length === 0,
			deletedMessageIds,
			failedMessageIds
		}
	}

	@ApiOperation({ summary: 'Обновить read-cursor' })
	@ApiBody({ type: MarkReadRequestDto })
	@ApiOkResponse({ description: 'Read cursor updated' })
	@Post('read')
	@HttpCode(HttpStatus.OK)
	public async read(
		@CurrentUser() id: string,
		@Body() dto: MarkReadRequestDto
	) {
		const response = await lastValueFrom(
			this.messagesClient.markRead({
				conversationId: dto.conversationId,
				userId: id,
				lastReadMessageId: dto.lastReadMessageId ?? ''
			})
		)

		if (response?.ok && dto.lastReadMessageId) {
			const readState = await lastValueFrom(
				this.messagesClient.getReadState({
					conversationId: dto.conversationId,
					requesterId: id
				})
			)
			const actorCursor = (readState.cursors ?? []).find(
				cursor => cursor.userId === id
			)

			if (!actorCursor?.lastReadMessageId) {
				return response
			}

			this.chatRealtimeService.emitReadCursorUpdated({
				conversationId: dto.conversationId,
				userId: id,
				lastReadMessageId: actorCursor.lastReadMessageId,
				lastReadAt: actorCursor.lastReadAt
			})
		}

		return response
	}

	@ApiOperation({
		summary: 'Заблокировать/разблокировать пользователя для личных чатов'
	})
	@ApiBody({ type: SetUserBlockRequestDto })
	@ApiOkResponse({ description: 'Block status updated' })
	@Post('block')
	@HttpCode(HttpStatus.OK)
	public async setUserBlock(
		@CurrentUser() id: string,
		@Body() dto: SetUserBlockRequestDto
	) {
		return await lastValueFrom(
			this.messagesClient.setUserBlock({
				actorId: id,
				targetUserId: dto.targetUserId,
				blocked: dto.blocked
			})
		)
	}

	@ApiOperation({ summary: 'Статус блокировки пользователя' })
	@ApiBody({ type: GetUserBlockStatusRequestDto })
	@ApiOkResponse({ type: GetUserBlockStatusResponseDto })
	@Post('block/status')
	@HttpCode(HttpStatus.OK)
	public async getUserBlockStatus(
		@CurrentUser() id: string,
		@Body() dto: GetUserBlockStatusRequestDto
	) {
		const [actorToTarget, targetToActor] = await Promise.all([
			lastValueFrom(
				this.messagesClient.getUserBlockStatus({
					actorId: id,
					targetUserId: dto.targetUserId
				})
			),
			lastValueFrom(
				this.messagesClient.getUserBlockStatus({
					actorId: dto.targetUserId,
					targetUserId: id
				})
			)
		])

		return {
			blocked: Boolean(actorToTarget?.blocked),
			blockedByTarget: Boolean(targetToActor?.blocked)
		}
	}
}
