import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateChatFolderRequestDto {
  @ApiProperty({
    description: 'Название папки',
    example: 'Работа',
  })
  @IsString()
  public name: string;

  @ApiPropertyOptional({ type: [String], example: ['chat_1', 'chat_2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public includedChatIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['chat_3'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public excludedChatIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['groups', 'channels'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public includedTypes?: string[];

  @ApiPropertyOptional({ type: [String], example: ['muted'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public excludedTypes?: string[];

  @ApiPropertyOptional({ example: 't.me/addlist/example' })
  @IsOptional()
  @IsString()
  public inviteLink?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public sortOrder?: number;
}
