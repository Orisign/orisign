import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class GetUserRequestDto {
  @ApiPropertyOptional({
    example: 'cm4y5f4hd0000kvx9w7h1y9s2',
    description: 'ID пользователя',
  })
  @IsOptional()
  @IsString()
  public id?: string;

  @ApiPropertyOptional({
    example: 'vllad',
    description: 'Username пользователя',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Username может содержать только английские буквы, цифры и _',
  })
  public username?: string;
}
