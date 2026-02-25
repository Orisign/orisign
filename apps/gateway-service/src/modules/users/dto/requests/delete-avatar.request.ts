import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteAvatarRequestDto {
  @ApiProperty({
    example: 'avatars/cmm0lfin000006kurwa4s2ip4/5fa2b1da.webp',
    description: 'S3 object key avatar file',
  })
  @IsString()
  @MinLength(3)
  public key: string;
}
