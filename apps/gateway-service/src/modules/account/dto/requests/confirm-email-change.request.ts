import { ApiProperty } from '@nestjs/swagger'
import {
	IsEmail,
	IsNotEmpty,
	IsNumberString,
	IsString,
	Length
} from 'class-validator'

export class ConfirmEmailChangeRequestDto {
	@ApiProperty({
		example: '7701ad6a-95f3-44a6-9303-0d541fcb167f',
		description: 'Challenge ID, полученный при инициации смены email'
	})
	@IsString()
	@IsNotEmpty()
	public challengeId: string

	@ApiProperty({
		example: 'user@example.com',
		description: 'Email, который подтверждается'
	})
	@IsEmail()
	public email: string

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
