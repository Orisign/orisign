import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListSearchHistoryRequestDto {
	@ApiPropertyOptional({
		description: 'Максимальное число записей',
		example: 20,
		default: 20
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	public limit?: number
}
