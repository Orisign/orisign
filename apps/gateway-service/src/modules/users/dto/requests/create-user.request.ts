import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateUserRequestDto {
  @ApiProperty({
    example: 'cm4y5f4hd0000kvx9w7h1y9s2',
    description: 'ID пользователя (обычно равен accountId из auth-service)',
  })
  @IsString()
  public id: string;
}
