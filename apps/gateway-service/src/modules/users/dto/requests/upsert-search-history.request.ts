import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class UpsertSearchHistoryRequestDto {
	@ApiProperty({
		description: 'Текст поискового запроса',
		example: 'orisign'
	})
	@IsString()
	@MinLength(1)
	@MaxLength(160)
	public query: string
}
