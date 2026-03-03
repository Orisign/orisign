import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrivacyType } from '@repo/contracts/gen/ts/users';

export class PrivacySettingsResponseDto {
  @ApiProperty({ enum: PrivacyType, example: PrivacyType.ALL })
  public phone: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.CONTACTS })
  public lastSeenTime: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.ALL })
  public photo: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.CONTACTS })
  public bio: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.CONTACTS })
  public call: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.CONTACTS })
  public reply: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.ALL })
  public invite: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.CONTACTS })
  public mediaMessage: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.CONTACTS })
  public message: PrivacyType;

  @ApiProperty({ enum: PrivacyType, example: PrivacyType.NOBODY })
  public birthDate: PrivacyType;
}

export class UserResponseDto {
  @ApiProperty({ example: 'cmm0lfin000006kurwa4s2ip4' })
  public id: string;

  @ApiPropertyOptional({ example: 'john_doe' })
  public username?: string;

  @ApiProperty({ example: 'John' })
  public firstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  public lastName?: string;

  @ApiPropertyOptional({ example: 'Backend engineer from Novosibirsk' })
  public bio?: string;

  @ApiProperty({ type: [String], example: ['avatars/user-1.jpg'] })
  public avatars: string[];

  @ApiPropertyOptional({
    example: 946684800000,
    description: 'Дата рождения в epoch milliseconds',
  })
  public birthDate?: number;

  @ApiProperty({ type: PrivacySettingsResponseDto })
  public privacySettings: PrivacySettingsResponseDto;

  @ApiProperty({ example: 1736150400000 })
  public createdAt: number;

  @ApiProperty({ example: 1736236800000 })
  public updatedAt: number;
}

export class GetUserResponseDto {
  @ApiProperty({ type: UserResponseDto, nullable: true })
  public user: UserResponseDto | null;
}
