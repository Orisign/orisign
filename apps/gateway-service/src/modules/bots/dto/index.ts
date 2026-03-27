import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BotDeliveryMode, BotPrivacyMode } from '@repo/contracts/gen/ts/bots';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateBotRequestDto {
  @ApiProperty()
  @IsString()
  displayName: string;

  @ApiProperty({ description: 'Global bot username ending with bot' })
  @IsString()
  username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localeDefault?: string;
}

export class BotListQueryDto {
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateBotRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localeDefault?: string;

  @ApiPropertyOptional({ enum: BotDeliveryMode })
  @IsOptional()
  @IsEnum(BotDeliveryMode)
  deliveryMode?: BotDeliveryMode;

  @ApiPropertyOptional({ enum: BotPrivacyMode })
  @IsOptional()
  @IsEnum(BotPrivacyMode)
  privacyMode?: BotPrivacyMode;
}

export class BotAvatarRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class SetWebhookRequestDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedUpdates?: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxConnections?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipAllowlist?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class BotCommandInputDto {
  @ApiProperty()
  @IsString()
  scope: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chatId?: string;

  @ApiProperty()
  @IsString()
  command: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;
}

export class SetCommandsRequestDto {
  @ApiProperty({ type: [BotCommandInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BotCommandInputDto)
  commands: BotCommandInputDto[];
}

export class DeveloperSendMessageRequestDto {
  @ApiProperty()
  @IsString()
  chatId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parseMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entitiesJson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyMarkupJson?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaKeys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disableNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  protectContent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traceId?: string;
}

export class DeveloperSendMediaRequestDto extends DeveloperSendMessageRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;
}

export class DeveloperEditMessageTextRequestDto {
  @ApiProperty()
  @IsString()
  chatId: string;

  @ApiProperty()
  @IsString()
  messageId: string;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parseMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entitiesJson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyMarkupJson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traceId?: string;
}

export class DeveloperEditMessageReplyMarkupRequestDto {
  @ApiProperty()
  @IsString()
  chatId: string;

  @ApiProperty()
  @IsString()
  messageId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyMarkupJson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traceId?: string;
}

export class DeveloperDeleteMessageRequestDto {
  @ApiProperty()
  @IsString()
  chatId: string;

  @ApiProperty()
  @IsString()
  messageId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traceId?: string;
}

export class DeveloperAnswerCallbackQueryRequestDto {
  @ApiProperty()
  @IsString()
  callbackQueryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showAlert?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cacheTime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traceId?: string;
}

export class DeveloperGetUpdatesQueryDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  timeout?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedUpdates?: string[];
}
