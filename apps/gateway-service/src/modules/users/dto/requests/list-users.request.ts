import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class ListUsersRequestDto {
	@ApiPropertyOptional({
		description: 'Поисковый запрос по имени или username',
		example: 'арт'
	})
	@IsOptional()
	@IsString()
	public query?: string

	@ApiPropertyOptional({ default: 30 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	public limit?: number

	@ApiPropertyOptional({ default: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	public offset?: number

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public excludeIds?: string[]
}
