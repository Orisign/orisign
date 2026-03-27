import { ApiPropertyOptional } from '@nestjs/swagger'
import { PrivacyType } from '@repo/contracts/gen/ts/users'
import { IsEnum, IsOptional } from 'class-validator'

export class PatchPrivacyRequestDto {
	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public phone?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public lastSeenTime?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public photo?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public bio?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public call?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public reply?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public invite?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public mediaMessage?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public message?: PrivacyType

	@ApiPropertyOptional({ enum: PrivacyType })
	@IsOptional()
	@IsEnum(PrivacyType)
	public birthDate?: PrivacyType
}
