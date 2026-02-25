import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const PRIVACY_MIN = 0;
const PRIVACY_MAX = 3;

export class PatchPrivacyRequestDto {
  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public phone?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public lastSeenTime?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public photo?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public bio?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public call?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public reply?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public invite?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public mediaMessage?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public message?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(PRIVACY_MIN)
  @Max(PRIVACY_MAX)
  public birthDate?: number;
}
