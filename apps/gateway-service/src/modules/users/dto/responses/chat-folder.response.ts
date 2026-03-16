import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatFolderResponseDto {
  @ApiProperty({ example: 'folder_1' })
  public id: string;

  @ApiProperty({ example: 'cmm3fwmg50000p0ur3jrgls1c' })
  public userId: string;

  @ApiProperty({ example: 'Работа' })
  public name: string;

  @ApiProperty({ type: [String], example: ['chat_1'] })
  public includedChatIds: string[];

  @ApiProperty({ type: [String], example: ['chat_2'] })
  public excludedChatIds: string[];

  @ApiProperty({ type: [String], example: ['groups'] })
  public includedTypes: string[];

  @ApiProperty({ type: [String], example: ['muted'] })
  public excludedTypes: string[];

  @ApiPropertyOptional({ example: 't.me/addlist/example' })
  public inviteLink?: string;

  @ApiProperty({ example: 0 })
  public sortOrder: number;

  @ApiProperty({ example: 1736150400000 })
  public createdAt: number;

  @ApiProperty({ example: 1736236800000 })
  public updatedAt: number;
}

export class ListChatFoldersResponseDto {
  @ApiProperty({ type: [ChatFolderResponseDto] })
  public folders: ChatFolderResponseDto[];
}

export class ChatFolderSingleResponseDto {
  @ApiProperty({ type: ChatFolderResponseDto })
  public folder: ChatFolderResponseDto;
}
