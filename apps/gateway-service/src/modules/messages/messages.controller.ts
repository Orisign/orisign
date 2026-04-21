import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
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
import { ConversationType } from '@repo/contracts/gen/ts/conversations'
import { MessageKind } from '@repo/contracts/gen/ts/messages'
import { lastValueFrom } from 'rxjs'
import { CurrentUser, Protected } from 'src/shared/decorators'

import { BotsClientGrpc } from '../bots/bots.grpc'
import { ChatRealtimeService } from './chat-realtime.service'
import { ConversationsClientGrpc } from '../conversations/conversations.grpc'
import { UsersClientGrpc } from '../users/users.grpc'
import {
	CommentSummaryItemResponseDto,
	DeleteMessageRequestDto,
	EditMessageRequestDto,
	ForwardMessageRequestDto,
	GetCommentSummaryRequestDto,
	GetCommentSummaryResponseDto,
	InvokeMessageCallbackRequestDto,
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
	SendDirectMessageRequestDto,
	SendMessageRequestDto,
	SharedMediaFilter,
	SetUserBlockRequestDto
} from './dto'
import { MessagesClientGrpc } from './messages.grpc'

const MEDIA_SCAN_PAGE_SIZE = 120
const MAX_MEDIA_SCAN_MESSAGES = 5000
const COMMENT_SUMMARY_SCAN_PAGE_SIZE = 200
const MAX_COMMENT_SUMMARY_MESSAGES = 5000
const DISCUSSION_TIMELINE_SCAN_PAGE_SIZE = 200
const MAX_DISCUSSION_TIMELINE_MESSAGES = 5000
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
		private readonly chatRealtimeService: ChatRealtimeService,
		private readonly conversationsClient: ConversationsClientGrpc,
		private readonly botsClient: BotsClientGrpc,
		private readonly usersClient: UsersClientGrpc
	) {}

	private parseJsonValue(value?: string): unknown {
		if (!value?.trim()) return undefined

		try {
			return JSON.parse(value)
		} catch {
			return undefined
		}
	}

	private normalizeBotChatType(type?: ConversationType) {
		switch (type) {
			case ConversationType.GROUP:
				return 'group'
			case ConversationType.SUPERGROUP:
				return 'supergroup'
			case ConversationType.CHANNEL:
				return 'channel'
			case ConversationType.DM:
			default:
				return 'private'
		}
	}

	private resolveDirectPeerUserId(
		conversation:
			| {
					type?: ConversationType
					members?: Array<{ userId?: string }>
			  }
			| null
			| undefined,
		requesterId: string
	) {
		if (!conversation || conversation.type !== ConversationType.DM) {
			return ''
		}

		return (
			conversation.members?.find(member => member.userId && member.userId !== requesterId)
				?.userId ?? ''
		)
	}

	private resolveUserDisplayName(
		user:
			| {
					firstName?: string
					lastName?: string
					username?: string
			  }
			| null
			| undefined,
		fallback = 'User'
	) {
		const fullName = [user?.firstName, user?.lastName]
			.filter(Boolean)
			.join(' ')
			.trim()

		if (fullName) {
			return fullName
		}

		if (user?.username) {
			return `@${user.username}`
		}

		return fallback
	}

	private async emitBotExternalEvent(
		eventName: string,
		payload: Record<string, unknown>
	) {
		await lastValueFrom(
			this.botsClient.consumeExternalEvent({
				eventName,
				traceId: '',
				payloadJson: JSON.stringify(payload)
			})
		)
	}

	private async emitDirectBotMessageCreated(params: {
		botUserId: string
		conversationId: string
		senderUserId: string
		locale?: string
		message: {
			id?: string
			text?: string
			createdAt?: number
			mediaKeys?: string[]
			entitiesJson?: string
			replyMarkupJson?: string
			attachmentsJson?: string
		}
		conversation?: {
			type?: ConversationType
		} | null
	}) {
		if (!params.botUserId) {
			return
		}

		const botResponse = await lastValueFrom(
			this.botsClient.getBotByUserId({ botUserId: params.botUserId })
		)
		const bot = botResponse.bot
		if (!bot) {
			return
		}

		const chatType = this.normalizeBotChatType(params.conversation?.type)
		const entities = this.parseJsonValue(params.message.entitiesJson)
		const replyMarkup = this.parseJsonValue(params.message.replyMarkupJson)
		const attachments = this.parseJsonValue(params.message.attachmentsJson)

		await this.emitBotExternalEvent('message.created', {
			botId: bot.id,
			chatId: params.conversationId,
			userId: params.senderUserId,
			locale: params.locale ?? '',
			messageId: params.message.id ?? '',
			text: params.message.text ?? '',
			mediaKeys: params.message.mediaKeys ?? [],
			entities,
			replyMarkup,
			attachments,
			chatType,
			chat: {
				id: params.conversationId,
				type: chatType
			},
			from: {
				id: params.senderUserId
			},
			message: {
				id: params.message.id ?? '',
				date: params.message.createdAt ?? 0,
				text: params.message.text ?? '',
				entities,
				replyMarkup,
				attachments,
				chat: {
					id: params.conversationId,
					type: chatType
				},
				from: {
					id: params.senderUserId
				}
			}
		})
	}

	private async resolveDiscussionLink(
		conversationId: string,
		requesterId: string
	) {
		const response = await lastValueFrom(
			this.conversationsClient.getConversation({
				conversationId,
				requesterId,
				username: ''
			})
		)
		const conversation = response.conversation
		const discussionConversationId =
			conversation?.type === ConversationType.CHANNEL
				? conversation.discussionConversationId?.trim() ?? ''
				: ''
		const discussionChannelId =
			conversation?.type === ConversationType.GROUP ||
			conversation?.type === ConversationType.SUPERGROUP
				? conversation.discussionChannelId?.trim() ?? ''
				: ''

		return {
			conversation,
			discussionConversationId,
			discussionChannelId
		}
	}

	private async loadTimelineWindow(
		conversationId: string,
		requesterId: string,
		targetCount: number
	) {
		const messages: SharedMediaMessage[] = []
		let offset = 0

		while (
			messages.length < targetCount &&
			offset < MAX_DISCUSSION_TIMELINE_MESSAGES
		) {
			const response = await lastValueFrom(
				this.messagesClient.listMessages({
					conversationId,
					requesterId,
					limit: Math.min(
						DISCUSSION_TIMELINE_SCAN_PAGE_SIZE,
						targetCount - messages.length
					),
					offset,
					replyToId: '',
					messageId: ''
				})
			)
			const pageMessages = response.messages ?? []

			if (pageMessages.length === 0) {
				break
			}

			messages.push(...pageMessages)
			offset += pageMessages.length

			if (pageMessages.length < DISCUSSION_TIMELINE_SCAN_PAGE_SIZE) {
				break
			}
		}

		return messages
	}

	private async listDiscussionTimeline(
		discussionConversationId: string,
		channelConversationId: string,
		requesterId: string,
		limit: number,
		offset: number
	) {
		const targetCount = Math.max(limit + offset, limit)
		const [discussionMessages, channelMessages] = await Promise.all([
			this.loadTimelineWindow(
				discussionConversationId,
				requesterId,
				targetCount
			),
			this.loadTimelineWindow(
				channelConversationId,
				requesterId,
				targetCount
			)
		])

		return [...discussionMessages, ...channelMessages]
			.sort((left, right) => {
				const leftCreatedAt = left.createdAt ?? 0
				const rightCreatedAt = right.createdAt ?? 0
				if (leftCreatedAt !== rightCreatedAt) {
					return rightCreatedAt - leftCreatedAt
				}

				return String(right.id ?? '').localeCompare(String(left.id ?? ''))
			})
			.slice(offset, offset + limit)
	}

	@ApiOperation({ summary: 'Отправить сообщение' })
	@ApiBody({ type: SendMessageRequestDto })
	@ApiOkResponse({ description: 'Message sent' })
	@Post('send')
	@HttpCode(HttpStatus.OK)
	public async send(
		@CurrentUser() id: string,
		@Body() dto: SendMessageRequestDto
	) {
		const discussionLink = await this.resolveDiscussionLink(
			dto.conversationId,
			id
		)
		const response = await lastValueFrom(
			this.messagesClient.sendMessage({
				conversationId: dto.conversationId,
				authorId: id,
				kind: dto.kind,
				text: dto.text ?? '',
				replyToId: dto.replyToId ?? '',
				mediaKeys: dto.mediaKeys ?? [],
				entitiesJson: dto.entitiesJson ?? '',
				replyMarkupJson: dto.replyMarkupJson ?? '',
				attachmentsJson: dto.attachmentsJson ?? '',
				sourceBotId: dto.sourceBotId ?? '',
				metadataJson: dto.metadataJson ?? ''
			})
		)

		if (response?.ok && response.message) {
			this.chatRealtimeService.emitMessageCreated(response.message)
			if (discussionLink.discussionConversationId) {
				this.chatRealtimeService.emitMessageCreatedToConversation(
					discussionLink.discussionConversationId,
					response.message
				)
			}
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: response.message.conversationId,
				actorId: id,
				reason: 'message.sent'
			})
			if (discussionLink.discussionConversationId) {
				this.chatRealtimeService.emitChatListInvalidate({
					conversationId: discussionLink.discussionConversationId,
					actorId: id,
					reason: 'discussion.message.mirrored'
				})
			}

			const directPeerUserId = this.resolveDirectPeerUserId(
				discussionLink.conversation,
				id
			)
			if (directPeerUserId) {
				await this.emitDirectBotMessageCreated({
					botUserId: directPeerUserId,
					conversationId: dto.conversationId,
					senderUserId: id,
					locale: dto.locale ?? '',
					message: response.message,
					conversation: discussionLink.conversation
				})
			}
		}

		return response
	}

	@ApiOperation({ summary: 'Отправить первое сообщение в личный чат' })
	@ApiBody({ type: SendDirectMessageRequestDto })
	@ApiOkResponse({ description: 'Direct message sent' })
	@Post('send-direct')
	@HttpCode(HttpStatus.OK)
	public async sendDirect(
		@CurrentUser() id: string,
		@Body() dto: SendDirectMessageRequestDto
	) {
		const targetUserId = dto.targetUserId?.trim() ?? ''

		if (!targetUserId) {
			throw new BadRequestException('targetUserId is required')
		}

		if (targetUserId === id) {
			throw new BadRequestException('Cannot create direct chat with yourself')
		}

		const [actorToTarget, targetToActor] = await Promise.all([
			lastValueFrom(
				this.messagesClient.getUserBlockStatus({
					actorId: id,
					targetUserId
				})
			),
			lastValueFrom(
				this.messagesClient.getUserBlockStatus({
					actorId: targetUserId,
					targetUserId: id
				})
			)
		])

		if (actorToTarget?.blocked || targetToActor?.blocked) {
			throw new ForbiddenException('Messaging is blocked for this direct chat')
		}

		const directConversation = await lastValueFrom(
			this.conversationsClient.createConversation({
				type: ConversationType.DM,
				creatorId: id,
				title: '',
				about: '',
				isPublic: false,
				username: '',
				memberIds: [targetUserId],
				avatarKey: ''
			})
		)
		const conversation = directConversation.conversation
		const conversationId = conversation?.id?.trim() ?? ''

		if (!conversationId) {
			throw new BadRequestException('Direct conversation was not created')
		}

		const response = await this.send(id, {
			conversationId,
			kind: dto.kind,
			text: dto.text,
			replyToId: dto.replyToId,
			mediaKeys: dto.mediaKeys,
			entitiesJson: dto.entitiesJson,
			replyMarkupJson: dto.replyMarkupJson,
			attachmentsJson: dto.attachmentsJson,
			sourceBotId: dto.sourceBotId,
			metadataJson: dto.metadataJson,
			locale: dto.locale
		})

		return {
			...response,
			conversation
		}
	}

	@ApiOperation({ summary: 'Переслать сообщение в другой чат' })
	@ApiBody({ type: ForwardMessageRequestDto })
	@ApiOkResponse({ description: 'Message forwarded' })
	@Post('forward')
	@HttpCode(HttpStatus.OK)
	public async forward(
		@CurrentUser() id: string,
		@Body() dto: ForwardMessageRequestDto
	) {
		const sourceConversationId = dto.sourceConversationId?.trim() ?? ''
		const targetConversationId = dto.targetConversationId?.trim() ?? ''
		const messageId = dto.messageId?.trim() ?? ''

		if (!sourceConversationId) {
			throw new BadRequestException('sourceConversationId is required')
		}

		if (!targetConversationId) {
			throw new BadRequestException('targetConversationId is required')
		}

		if (!messageId) {
			throw new BadRequestException('messageId is required')
		}

		if (sourceConversationId === targetConversationId) {
			throw new BadRequestException('Target conversation must be different')
		}

		const sourceResponse = await lastValueFrom(
			this.messagesClient.listMessages({
				conversationId: sourceConversationId,
				requesterId: id,
				limit: 1,
				offset: 0,
				replyToId: '',
				messageId
			})
		)
		const sourceMessage = sourceResponse.messages?.at(0)

		if (!sourceMessage) {
			throw new BadRequestException('Source message was not found')
		}

		if (sourceMessage.kind === MessageKind.SYSTEM) {
			throw new BadRequestException('System messages cannot be forwarded')
		}

		const [sourceConversationResponse, sourceAuthorResponse] = await Promise.all([
			lastValueFrom(
				this.conversationsClient.getConversation({
					conversationId: sourceConversationId,
					requesterId: id,
					username: ''
				})
			),
			lastValueFrom(this.usersClient.getUser({ id: sourceMessage.authorId ?? '' })).catch(
				() => ({ user: null })
			)
		])
		const sourceConversation = sourceConversationResponse.conversation ?? null
		const sourceAuthor = sourceAuthorResponse.user ?? null
		const sourceConversationTitle =
			sourceConversation?.title?.trim() ||
			(sourceConversation?.username ? `@${sourceConversation.username}` : '')
		const sourceAuthorName = this.resolveUserDisplayName(
			sourceAuthor,
			sourceMessage.authorId || 'User'
		)
		const sourceConversationType = sourceConversation?.type ?? ''
		const linksToSourceMessage =
			sourceConversationType === ConversationType.CHANNEL ||
			sourceConversationType === ConversationType.GROUP ||
			sourceConversationType === ConversationType.SUPERGROUP
		const sourceTitle =
			linksToSourceMessage
				? sourceConversationTitle || sourceAuthorName
				: sourceAuthorName || sourceConversationTitle
		const sourceAuthorAvatars = sourceAuthor?.avatars ?? []
		const sourceAvatarKey = linksToSourceMessage
			? (sourceConversation?.avatarKey ?? '')
			: (sourceAuthorAvatars[sourceAuthorAvatars.length - 1] ?? '')

		const existingMetadata = this.parseJsonValue(sourceMessage.metadataJson)
		const metadata =
			existingMetadata &&
			typeof existingMetadata === 'object' &&
			!Array.isArray(existingMetadata)
				? { ...existingMetadata }
				: {}

		const response = await this.send(id, {
			conversationId: targetConversationId,
			kind: sourceMessage.kind,
			text: sourceMessage.text ?? '',
			mediaKeys: sourceMessage.mediaKeys ?? [],
			entitiesJson: sourceMessage.entitiesJson ?? '',
			replyMarkupJson: sourceMessage.replyMarkupJson ?? '',
			attachmentsJson: sourceMessage.attachmentsJson ?? '',
			sourceBotId: sourceMessage.sourceBotId ?? '',
			metadataJson: JSON.stringify({
				...metadata,
				forwardedFrom: {
					conversationId: sourceConversationId,
					messageId: sourceMessage.id ?? messageId,
					authorId: sourceMessage.authorId ?? '',
					createdAt: sourceMessage.createdAt ?? 0,
					sourceType: sourceConversationType,
					sourceTitle,
					sourceAvatarKey,
					sourceConversationTitle,
					sourceConversationUsername: sourceConversation?.username ?? '',
					sourceAuthorName,
					sourceAuthorUsername: sourceAuthor?.username ?? ''
				}
			})
		})

		return {
			...response,
			sourceMessage
		}
	}

	@ApiOperation({ summary: 'Invoke callback button on an interactive bot message' })
	@ApiBody({ type: InvokeMessageCallbackRequestDto })
	@ApiOkResponse({ description: 'Callback query created and dispatched' })
	@Post('callback')
	@HttpCode(HttpStatus.OK)
	public async invokeCallback(
		@CurrentUser() id: string,
		@Body() dto: InvokeMessageCallbackRequestDto
	) {
		const discussionLink = await this.resolveDiscussionLink(dto.conversationId, id)
		const response = await lastValueFrom(
			this.messagesClient.invokeMessageCallback({
				conversationId: dto.conversationId,
				actorId: id,
				messageId: dto.messageId,
				callbackData: dto.callbackData
			})
		)

		if (response.ok && response.message?.sourceBotId) {
			const chatType = this.normalizeBotChatType(discussionLink.conversation?.type)
			const message = response.message
			const entities = this.parseJsonValue(message.entitiesJson)
			const replyMarkup = this.parseJsonValue(message.replyMarkupJson)
			const attachments = this.parseJsonValue(message.attachmentsJson)

			await this.emitBotExternalEvent('message.callback_invoked', {
				botId: message.sourceBotId,
				callbackQueryId: response.callbackQueryId,
				chatId: dto.conversationId,
				userId: id,
				locale: dto.locale ?? '',
				messageId: dto.messageId,
				data: dto.callbackData,
				chatType,
				chat: {
					id: dto.conversationId,
					type: chatType
				},
				from: {
					id
				},
				message: {
					id: message.id,
					date: message.createdAt,
					text: message.text,
					entities,
					replyMarkup,
					attachments,
					chat: {
						id: dto.conversationId,
						type: chatType
					}
				}
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
		const replyToId = dto.replyToId?.trim() ?? ''
		const messageId = dto.messageId?.trim() ?? ''
		const discussionChannelId = dto.discussionChannelId?.trim() ?? ''

		if (!replyToId && !messageId && discussionChannelId) {
			return {
				messages: await this.listDiscussionTimeline(
					dto.conversationId,
					discussionChannelId,
					id,
					dto.limit ?? 30,
					dto.offset ?? 0
				)
			}
		}

		return await lastValueFrom(
			this.messagesClient.listMessages({
				conversationId: dto.conversationId,
				requesterId: id,
				limit: dto.limit ?? 30,
				offset: dto.offset ?? 0,
				replyToId,
				messageId
			})
		)
	}

	@ApiOperation({ summary: 'Счётчики комментариев для постов канала' })
	@ApiBody({ type: GetCommentSummaryRequestDto })
	@ApiOkResponse({ type: GetCommentSummaryResponseDto })
	@Post('comment-summary')
	@HttpCode(HttpStatus.OK)
	public async getCommentSummary(
		@CurrentUser() id: string,
		@Body() dto: GetCommentSummaryRequestDto
	) {
		const replyToIds = [...new Set((dto.replyToIds ?? []).filter(Boolean))]
		const counts = new Map<string, number>(
			replyToIds.map(replyToId => [replyToId, 0])
		)

		if (replyToIds.length === 0) {
			return {
				items: [] as CommentSummaryItemResponseDto[]
			}
		}

		let offset = 0
		let scanned = 0

		while (scanned < MAX_COMMENT_SUMMARY_MESSAGES) {
			const response = await lastValueFrom(
				this.messagesClient.listMessages({
					conversationId: dto.conversationId,
					requesterId: id,
					limit: COMMENT_SUMMARY_SCAN_PAGE_SIZE,
					offset,
					replyToId: '',
					messageId: ''
				})
			)

			const messages = response.messages ?? []
			if (messages.length === 0) {
				break
			}

			scanned += messages.length

			for (const message of messages) {
				const replyToId = message.replyToId ?? ''
				if (!counts.has(replyToId)) {
					continue
				}

				counts.set(replyToId, (counts.get(replyToId) ?? 0) + 1)
			}

			if (messages.length < COMMENT_SUMMARY_SCAN_PAGE_SIZE) {
				break
			}

			offset += messages.length
		}

		return {
			items: replyToIds.map(replyToId => ({
				replyToId,
				count: counts.get(replyToId) ?? 0
			}))
		}
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
					offset: scanOffset,
					replyToId: '',
					messageId: ''
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
				text: dto.text,
				replyMarkupJson: dto.replyMarkupJson ?? '',
				entitiesJson: dto.entitiesJson ?? '',
				metadataJson: dto.metadataJson ?? ''
			})
		)

		if (response?.ok && dto.conversationId) {
			const editedAt = Date.now()
			const discussionLink = await this.resolveDiscussionLink(
				dto.conversationId,
				id
			)

			this.chatRealtimeService.emitMessageUpdated({
				conversationId: dto.conversationId,
				messageId: dto.messageId,
				text: dto.text,
				editedAt
			})
			if (discussionLink.discussionConversationId) {
				this.chatRealtimeService.emitMessageUpdatedToConversation({
					targetConversationId: discussionLink.discussionConversationId,
					messageId: dto.messageId,
					text: dto.text,
					editedAt
				})
			}
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: dto.conversationId,
				actorId: id,
				reason: 'message.edited'
			})
			if (discussionLink.discussionConversationId) {
				this.chatRealtimeService.emitChatListInvalidate({
					conversationId: discussionLink.discussionConversationId,
					actorId: id,
					reason: 'discussion.message.edited'
				})
			}
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
			const discussionLink = await this.resolveDiscussionLink(
				dto.conversationId,
				id
			)

			deletedMessageIds.forEach(messageId => {
				this.chatRealtimeService.emitMessageDeleted({
					conversationId: dto.conversationId as string,
					messageId,
					deletedAt
				})
				if (discussionLink.discussionConversationId) {
					this.chatRealtimeService.emitMessageDeletedToConversation({
						targetConversationId:
							discussionLink.discussionConversationId,
						messageId,
						deletedAt
					})
				}
			})
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: dto.conversationId,
				actorId: id,
				reason: 'message.deleted'
			})
			if (discussionLink.discussionConversationId) {
				this.chatRealtimeService.emitChatListInvalidate({
					conversationId: discussionLink.discussionConversationId,
					actorId: id,
					reason: 'discussion.message.deleted'
				})
			}
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
