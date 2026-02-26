import { ApiProperty } from '@nestjs/swagger'
import {
	IsNotEmpty,
	IsNumberString,
	IsString,
	Length,
	Matches
} from 'class-validator'

export class ConfirmPhoneChangeRequestDto {
	@ApiProperty({
		example: '7701ad6a-95f3-44a6-9303-0d541fcb167f',
		description: 'Challenge ID, полученный при инициации смены телефона'
	})
	@IsString()
	@IsNotEmpty()
	public challengeId: string

	@ApiProperty({
		example: '+79001234567',
		description: 'Новый номер телефона'
	})
	@IsString()
	@Matches(/^\+?\d{10,15}$/, {
		message: 'Введён некорректный номер телефона'
	})
	public phone: string

	@ApiProperty({
		example: '123456',
		description: 'Код подтверждения',
		minLength: 6,
		maxLength: 6
	})
	@IsNumberString()
	@IsNotEmpty()
	@Length(6)
	public code: string
}
