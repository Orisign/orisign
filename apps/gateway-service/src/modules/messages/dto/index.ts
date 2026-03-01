import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
}

export class DeleteMessageRequestDto {
  @ApiProperty()
  @IsString()
  messageId: string;
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
