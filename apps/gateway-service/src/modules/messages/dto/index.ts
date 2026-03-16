import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MessageKind } from '@repo/contracts/gen/ts/messages';

export class SendMessageRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;

  @ApiProperty({ enum: MessageKind })
  @IsEnum(MessageKind)
  kind: MessageKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyToId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaKeys?: string[];
}

export class ListMessagesRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;

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

export class EditMessageRequestDto {
  @ApiProperty()
  @IsString()
  messageId: string;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class DeleteMessageRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  messageIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class MarkReadRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastReadMessageId?: string;
}

export class GetReadStateRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;
}

export class GetUnreadCountRequestDto {
  @ApiProperty()
  @IsString()
  conversationId: string;
}

export class GetUnreadCountResponseDto {
  @ApiProperty()
  count: number;
}

export class ReadCursorResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  lastReadMessageId: string;

  @ApiProperty()
  lastReadAt: number;
}

export class GetReadStateResponseDto {
  @ApiProperty({ type: [ReadCursorResponseDto] })
  cursors: ReadCursorResponseDto[];
}

export class SetUserBlockRequestDto {
  @ApiProperty()
  @IsString()
  targetUserId: string;

  @ApiProperty()
  @IsBoolean()
  blocked: boolean;
}

export class GetUserBlockStatusRequestDto {
  @ApiProperty()
  @IsString()
  targetUserId: string;
}

export class GetUserBlockStatusResponseDto {
  @ApiProperty()
  blocked: boolean;

  @ApiProperty()
  blockedByTarget: boolean;
}
