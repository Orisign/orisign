import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MessageKind } from '@repo/contracts/gen/ts/messages'
import { Type } from 'class-transformer'
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min,
	ValidateNested
} from 'class-validator'

export class SendMessageRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty({ enum: MessageKind })
	@IsEnum(MessageKind)
	kind: MessageKind

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	text?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyToId?: string

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	mediaKeys?: string[]

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	entitiesJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyMarkupJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	attachmentsJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	sourceBotId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	metadataJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	locale?: string
}

export class SendDirectMessageRequestDto {
	@ApiProperty()
	@IsString()
	targetUserId: string

	@ApiProperty({ enum: MessageKind })
	@IsEnum(MessageKind)
	kind: MessageKind

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	text?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyToId?: string

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	mediaKeys?: string[]

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	entitiesJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyMarkupJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	attachmentsJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	sourceBotId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	metadataJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	locale?: string
}

export class ForwardMessageRequestDto {
	@ApiProperty()
	@IsString()
	sourceConversationId: string

	@ApiProperty()
	@IsString()
	messageId: string

	@ApiProperty()
	@IsString()
	targetConversationId: string
}

export class ListMessagesRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	discussionChannelId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyToId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	messageId?: string

	@ApiPropertyOptional({ default: 30 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit?: number

	@ApiPropertyOptional({ default: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number
}

export class EditMessageRequestDto {
	@ApiProperty()
	@IsString()
	messageId: string

	@ApiProperty()
	@IsString()
	text: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	conversationId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyMarkupJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	entitiesJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	metadataJson?: string
}

export class DeleteMessageRequestDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	messageId?: string

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	messageIds?: string[]

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	conversationId?: string
}

export class InvokeMessageCallbackRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsString()
	messageId: string

	@ApiProperty()
	@IsString()
	callbackData: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	locale?: string
}

export class RealtimeMessageDto {
	@ApiProperty()
	@IsString()
	id: string

	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsString()
	authorId: string

	@ApiProperty({ enum: MessageKind })
	@IsEnum(MessageKind)
	kind: MessageKind

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	text?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyToId?: string

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	mediaKeys?: string[]

	@ApiProperty()
	@Type(() => Number)
	@IsInt()
	createdAt: number

	@ApiPropertyOptional()
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	editedAt?: number

	@ApiPropertyOptional()
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	deletedAt?: number

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	entitiesJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyMarkupJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	attachmentsJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	sourceBotId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	metadataJson?: string
}

export class InternalMessageCreatedRequestDto {
	@ApiProperty({ type: RealtimeMessageDto })
	@ValidateNested()
	@Type(() => RealtimeMessageDto)
	message: RealtimeMessageDto

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	actorId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	reason?: string
}

export class InternalMessageUpdatedRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsString()
	messageId: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	text?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	replyMarkupJson?: string

	@ApiPropertyOptional()
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	editedAt?: number

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	actorId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	reason?: string
}

export class InternalMessageDeletedRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsString()
	messageId: string

	@ApiPropertyOptional()
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	deletedAt?: number

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	actorId?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	reason?: string
}

export class MarkReadRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	lastReadMessageId?: string
}

export class GetReadStateRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string
}

export class GetUnreadCountRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string
}

export class GetUnreadCountResponseDto {
	@ApiProperty()
	count: number
}

export class ReadCursorResponseDto {
	@ApiProperty()
	userId: string

	@ApiProperty()
	lastReadMessageId: string

	@ApiProperty()
	lastReadAt: number
}

export class GetReadStateResponseDto {
	@ApiProperty({ type: [ReadCursorResponseDto] })
	cursors: ReadCursorResponseDto[]
}

export class SetUserBlockRequestDto {
	@ApiProperty()
	@IsString()
	targetUserId: string

	@ApiProperty()
	@IsBoolean()
	blocked: boolean
}

export class GetUserBlockStatusRequestDto {
	@ApiProperty()
	@IsString()
	targetUserId: string
}

export class GetUserBlockStatusResponseDto {
	@ApiProperty()
	blocked: boolean

	@ApiProperty()
	blockedByTarget: boolean
}

export const SHARED_MEDIA_FILTERS = [
	'media',
	'files',
	'links',
	'voice'
] as const

export type SharedMediaFilter = (typeof SHARED_MEDIA_FILTERS)[number]

export class ListSharedMediaRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiPropertyOptional({
		enum: SHARED_MEDIA_FILTERS,
		default: 'media'
	})
	@IsOptional()
	@IsIn(SHARED_MEDIA_FILTERS)
	filter?: SharedMediaFilter

	@ApiPropertyOptional({ default: 40 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number

	@ApiPropertyOptional({ default: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number
}

export class SharedMediaItemResponseDto {
	@ApiProperty()
	messageId: string

	@ApiProperty()
	conversationId: string

	@ApiProperty()
	authorId: string

	@ApiProperty()
	text: string

	@ApiProperty({ type: [String] })
	mediaKeys: string[]

	@ApiProperty()
	createdAt: number
}

export class ListSharedMediaResponseDto {
	@ApiProperty({ type: [SharedMediaItemResponseDto] })
	items: SharedMediaItemResponseDto[]
}

export class GetCommentSummaryRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty({ type: [String] })
	@IsArray()
	@IsString({ each: true })
	replyToIds: string[]
}

export class CommentSummaryItemResponseDto {
	@ApiProperty()
	replyToId: string

	@ApiProperty()
	count: number
}

export class GetCommentSummaryResponseDto {
	@ApiProperty({ type: [CommentSummaryItemResponseDto] })
	items: CommentSummaryItemResponseDto[]
}
