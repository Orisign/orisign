import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class PatchUserRequestDto {
  @ApiPropertyOptional({
    example: 'vllad',
    description: 'Новый username',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  public username?: string;

  @ApiPropertyOptional({
    example: 'Vlad',
    description: 'Имя',
  })
  @IsOptional()
  @IsString()
  public firstName?: string;

  @ApiPropertyOptional({
    example: 'Ivanov',
    description: 'Фамилия',
  })
  @IsOptional()
  @IsString()
  public lastName?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.example.com/avatar.jpg'],
    description: 'Ссылки на аватары пользователя',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public avatars?: string[];

  @ApiPropertyOptional({
    example: '1998-01-20T00:00:00.000Z',
    description: 'Дата рождения в ISO-формате',
  })
  @IsOptional()
  @IsDateString()
  public birthDate?: string;
}
