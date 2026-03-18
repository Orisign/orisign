import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class SendOtpRequest {
	@ApiProperty({
		example: '+79001234567',
		description: 'Номер телефона в международном формате (E.164 или без +)'
	})
	@IsString()
	@Matches(/^\+?\d{10,15}$/, {
		message: 'Введён некорректный номер телефона'
	})
	public phone: string

	@ApiProperty({
		example: '59a43f03-4d56-4adc-aee2-20d9c5dcbf69',
		description: 'Уникальный идентификатор устройства клиента'
	})
	@IsString()
	public deviceId: string
}
