import { ApiProperty } from '@nestjs/swagger'
import { IsEmail } from 'class-validator'

export class InitEmailChangeRequestDto {
	@ApiProperty({
		example: 'user@example.com',
		description: 'Новый email для привязки'
	})
	@IsEmail()
	public email: string
}
