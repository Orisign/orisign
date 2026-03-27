import {
	Body,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
	ApiBody,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiTags
} from '@nestjs/swagger'
import { ConversationType } from '@repo/contracts/gen/ts/conversations'
import type { Message } from '@repo/contracts/gen/ts/messages'
import { lastValueFrom } from 'rxjs'

import { ConversationsClientGrpc } from '../conversations/conversations.grpc'

import {
	InternalMessageCreatedRequestDto,
	InternalMessageDeletedRequestDto,
	InternalMessageUpdatedRequestDto
} from './dto'
import { ChatRealtimeService } from './chat-realtime.service'

@ApiTags('Messages Internal')
@Controller('internal/messages/realtime')
export class MessagesInternalController {
	public constructor(
		private readonly configService: ConfigService,
		private readonly chatRealtimeService: ChatRealtimeService,
		private readonly conversationsClient: ConversationsClientGrpc
	) {}

	private assertInternalToken(headerValue?: string) {
		const providedToken = (headerValue ?? '').trim()
		const expectedToken =
			this.configService.get<string>('INTERNAL_API_TOKEN')?.trim() ||
			this.configService.get<string>('PASSPORT_SECRET_KEY')?.trim() ||
			''
		const nodeEnv = this.configService.get<string>('NODE_ENV')?.trim() || 'development'

		if (!expectedToken) {
			if (nodeEnv === 'development') {
				return
			}

			throw new UnauthorizedException('Internal realtime token is not configured')
		}

		if (providedToken !== expectedToken) {
			throw new UnauthorizedException('Invalid internal realtime token')
		}
	}

	private async resolveDiscussionLink(
		conversationId: string,
		requesterId: string
	) {
		if (!conversationId || !requesterId) {
			return {
				discussionConversationId: '',
				conversation: null
			}
		}

		try {
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

			return {
				conversation,
				discussionConversationId
			}
		} catch {
			return {
				discussionConversationId: '',
				conversation: null
			}
		}
	}

	private toRealtimeMessage(dto: InternalMessageCreatedRequestDto['message']): Message {
		return {
			id: dto.id,
			conversationId: dto.conversationId,
			authorId: dto.authorId,
			kind: dto.kind,
			text: dto.text ?? '',
			replyToId: dto.replyToId ?? '',
			mediaKeys: dto.mediaKeys ?? [],
			createdAt: dto.createdAt,
			editedAt: dto.editedAt ?? 0,
			deletedAt: dto.deletedAt ?? 0,
			entitiesJson: dto.entitiesJson ?? '',
			replyMarkupJson: dto.replyMarkupJson ?? '',
			attachmentsJson: dto.attachmentsJson ?? '',
			sourceBotId: dto.sourceBotId ?? '',
			metadataJson: dto.metadataJson ?? ''
		}
	}

	@ApiHeader({
		name: 'x-internal-token',
		required: false,
		description: 'Internal service token for realtime fanout'
	})
	@ApiOperation({
		summary: 'Emit realtime event for a bot-originated message create'
	})
	@ApiBody({ type: InternalMessageCreatedRequestDto })
	@ApiOkResponse({ description: 'Realtime event emitted' })
	@Post('message-created')
	@HttpCode(HttpStatus.OK)
	public async emitMessageCreated(
		@Headers('x-internal-token') internalToken: string | undefined,
		@Body() dto: InternalMessageCreatedRequestDto
	) {
		this.assertInternalToken(internalToken)

		const actorId = dto.actorId?.trim() || dto.message.authorId
		const message = this.toRealtimeMessage(dto.message)
		const discussionLink = await this.resolveDiscussionLink(
			message.conversationId,
			actorId
		)

		this.chatRealtimeService.emitMessageCreated(message)
		if (discussionLink.discussionConversationId) {
			this.chatRealtimeService.emitMessageCreatedToConversation(
				discussionLink.discussionConversationId,
				message
			)
		}

		this.chatRealtimeService.emitChatListInvalidate({
			conversationId: message.conversationId,
			actorId,
			reason: dto.reason ?? 'bot.message.created'
		})
		if (discussionLink.discussionConversationId) {
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: discussionLink.discussionConversationId,
				actorId,
				reason: 'discussion.bot.message.mirrored'
			})
		}

		return { ok: true }
	}

	@ApiHeader({
		name: 'x-internal-token',
		required: false,
		description: 'Internal service token for realtime fanout'
	})
	@ApiOperation({
		summary: 'Emit realtime event for a bot-originated message update'
	})
	@ApiBody({ type: InternalMessageUpdatedRequestDto })
	@ApiOkResponse({ description: 'Realtime event emitted' })
	@Post('message-updated')
	@HttpCode(HttpStatus.OK)
	public async emitMessageUpdated(
		@Headers('x-internal-token') internalToken: string | undefined,
		@Body() dto: InternalMessageUpdatedRequestDto
	) {
		this.assertInternalToken(internalToken)

		const actorId = dto.actorId?.trim() ?? ''
		const discussionLink = await this.resolveDiscussionLink(
			dto.conversationId,
			actorId
		)

		this.chatRealtimeService.emitMessageUpdated({
			conversationId: dto.conversationId,
			messageId: dto.messageId,
			text: dto.text,
			replyMarkupJson: dto.replyMarkupJson,
			editedAt: dto.editedAt ?? Date.now()
		})
		if (discussionLink.discussionConversationId) {
			this.chatRealtimeService.emitMessageUpdatedToConversation({
				targetConversationId: discussionLink.discussionConversationId,
				messageId: dto.messageId,
				text: dto.text,
				replyMarkupJson: dto.replyMarkupJson,
				editedAt: dto.editedAt ?? Date.now()
			})
		}

		this.chatRealtimeService.emitChatListInvalidate({
			conversationId: dto.conversationId,
			actorId,
			reason: dto.reason ?? 'bot.message.updated'
		})
		if (discussionLink.discussionConversationId) {
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: discussionLink.discussionConversationId,
				actorId,
				reason: 'discussion.bot.message.updated'
			})
		}

		return { ok: true }
	}

	@ApiHeader({
		name: 'x-internal-token',
		required: false,
		description: 'Internal service token for realtime fanout'
	})
	@ApiOperation({
		summary: 'Emit realtime event for a bot-originated message delete'
	})
	@ApiBody({ type: InternalMessageDeletedRequestDto })
	@ApiOkResponse({ description: 'Realtime event emitted' })
	@Post('message-deleted')
	@HttpCode(HttpStatus.OK)
	public async emitMessageDeleted(
		@Headers('x-internal-token') internalToken: string | undefined,
		@Body() dto: InternalMessageDeletedRequestDto
	) {
		this.assertInternalToken(internalToken)

		const actorId = dto.actorId?.trim() ?? ''
		const discussionLink = await this.resolveDiscussionLink(
			dto.conversationId,
			actorId
		)

		this.chatRealtimeService.emitMessageDeleted({
			conversationId: dto.conversationId,
			messageId: dto.messageId,
			deletedAt: dto.deletedAt ?? Date.now()
		})
		if (discussionLink.discussionConversationId) {
			this.chatRealtimeService.emitMessageDeletedToConversation({
				targetConversationId: discussionLink.discussionConversationId,
				messageId: dto.messageId,
				deletedAt: dto.deletedAt ?? Date.now()
			})
		}

		this.chatRealtimeService.emitChatListInvalidate({
			conversationId: dto.conversationId,
			actorId,
			reason: dto.reason ?? 'bot.message.deleted'
		})
		if (discussionLink.discussionConversationId) {
			this.chatRealtimeService.emitChatListInvalidate({
				conversationId: discussionLink.discussionConversationId,
				actorId,
				reason: 'discussion.bot.message.deleted'
			})
		}

		return { ok: true }
	}
}
