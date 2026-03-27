import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
	ConversationType,
	MemberRole,
	MemberState
} from '@repo/contracts/gen/ts/conversations'
import { Type } from 'class-transformer'
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Min
} from 'class-validator'

export class CreateConversationRequestDto {
	@ApiProperty({ enum: ConversationType })
	@IsEnum(ConversationType)
	type: ConversationType

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	title?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	about?: string

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	isPublic?: boolean

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	username?: string

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	memberIds?: string[]

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	avatarKey?: string
}

export class ConversationByIdRequestDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	conversationId?: string

	@ApiPropertyOptional({
		description: 'Публичный username беседы без или с префиксом @'
	})
	@IsOptional()
	@IsString()
	username?: string
}

export class ListMyConversationsRequestDto {
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

export class AddMembersRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	memberIds: string[]
}

export class RemoveMemberRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsString()
	targetUserId: string
}

export class UpdateMemberRoleRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsString()
	targetUserId: string

	@ApiProperty({ enum: MemberRole })
	@IsEnum(MemberRole)
	role: MemberRole
}

export class UpdateConversationRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsString()
	title: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	about?: string

	@ApiProperty({ default: false })
	@IsBoolean()
	isPublic: boolean

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	username?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	avatarKey?: string

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	discussionConversationId?: string
}

export class UpdateConversationNotificationsRequestDto {
	@ApiProperty()
	@IsString()
	conversationId: string

	@ApiProperty()
	@IsBoolean()
	notificationsEnabled: boolean
}

export class ConversationMemberResponseDto {
	@ApiProperty()
	userId: string

	@ApiProperty({ enum: MemberRole })
	role: MemberRole

	@ApiProperty({ enum: MemberState })
	state: MemberState

	@ApiProperty()
	joinedAt: number
}

export class ConversationResponseDto {
	@ApiProperty()
	id: string

	@ApiProperty({ enum: ConversationType })
	type: ConversationType

	@ApiProperty()
	title: string

	@ApiProperty()
	about: string

	@ApiProperty()
	ownerId: string

	@ApiProperty()
	isPublic: boolean

	@ApiProperty()
	username: string

	@ApiProperty()
	avatarKey: string

	@ApiProperty({ default: true })
	notificationsEnabled: boolean

	@ApiProperty()
	discussionConversationId: string

	@ApiProperty()
	discussionChannelId: string

	@ApiProperty({ type: [ConversationMemberResponseDto] })
	members: ConversationMemberResponseDto[]

	@ApiProperty()
	createdAt: number

	@ApiProperty()
	updatedAt: number
}

export class CreateConversationResponseDto {
	@ApiProperty()
	ok: boolean

	@ApiProperty({ type: ConversationResponseDto, nullable: true })
	conversation: ConversationResponseDto | null
}

export class GetConversationResponseDto {
	@ApiProperty({ type: ConversationResponseDto, nullable: true })
	conversation: ConversationResponseDto | null
}

export class ListMyConversationsResponseDto {
	@ApiProperty({ type: [ConversationResponseDto] })
	conversations: ConversationResponseDto[]
}

export class MutationResponseDto {
	@ApiProperty()
	ok: boolean
}

export class ConversationAvatarObjectResponseDto {
	@ApiProperty()
	key: string

	@ApiProperty()
	url: string

	@ApiProperty()
	expiresAt: number
}

export class UploadConversationAvatarResponseDto {
	@ApiProperty()
	ok: boolean

	@ApiProperty({ type: ConversationAvatarObjectResponseDto, nullable: true })
	avatar: ConversationAvatarObjectResponseDto | null
}

export class UploadConversationMediaResponseDto {
	@ApiProperty()
	ok: boolean

	@ApiProperty({ type: ConversationAvatarObjectResponseDto, nullable: true })
	media: ConversationAvatarObjectResponseDto | null
}

export class DeleteConversationMediaRequestDto {
	@ApiProperty()
	@IsString()
	key: string
}
