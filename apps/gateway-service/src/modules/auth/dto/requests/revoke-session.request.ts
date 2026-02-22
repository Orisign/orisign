import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class RevokeSessionRequestDto {
	@ApiProperty({
		example: 'fd63364d-ac57-4626-9fa6-8f69bcf6c176',
		description: 'ID сессии для завершения'
	})
	@IsString()
	@IsNotEmpty()
	public id: string
}
