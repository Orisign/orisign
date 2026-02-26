import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class InitPhoneChangeRequestDto {
	@ApiProperty({
		example: '+79001234567',
		description: 'Новый номер телефона'
	})
	@IsString()
	@Matches(/^\+?\d{10,15}$/, {
		message: 'Введён некорректный номер телефона'
	})
	public phone: string
}
