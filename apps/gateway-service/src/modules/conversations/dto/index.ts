import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  ConversationType,
  MemberState,
  MemberRole,
} from '@repo/contracts/gen/ts/conversations';

export class CreateConversationRequestDto {
  @ApiProperty({ enum: ConversationType })
  @IsEnum(ConversationType)
  type: ConversationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  about?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}

export class ConversationByIdRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;
}

export class ListMyConversationsRequestDto {
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class AddMembersRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  memberIds: string[];
}

export class RemoveMemberRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;

  @ApiProperty()
  @IsString()
  targetUserId: string;
}

export class UpdateMemberRoleRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;

  @ApiProperty()
  @IsString()
  targetUserId: string;

  @ApiProperty({ enum: MemberRole })
  @IsEnum(MemberRole)
  role: MemberRole;
}

export class ConversationMemberResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: MemberRole })
  role: MemberRole;

  @ApiProperty({ enum: MemberState })
  state: MemberState;

  @ApiProperty()
  joinedAt: number;
}

export class ConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ConversationType })
  type: ConversationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  about: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  username: string;

  @ApiProperty({ type: [ConversationMemberResponseDto] })
  members: ConversationMemberResponseDto[];

  @ApiProperty()
  createdAt: number;

  @ApiProperty()
  updatedAt: number;
}

export class CreateConversationResponseDto {
  @ApiProperty()
  ok: boolean;

  @ApiProperty({ type: ConversationResponseDto, nullable: true })
  conversation: ConversationResponseDto | null;
}

export class GetConversationResponseDto {
  @ApiProperty({ type: ConversationResponseDto, nullable: true })
  conversation: ConversationResponseDto | null;
}

export class ListMyConversationsResponseDto {
  @ApiProperty({ type: [ConversationResponseDto] })
  conversations: ConversationResponseDto[];
}

export class MutationResponseDto {
  @ApiProperty()
  ok: boolean;
}
