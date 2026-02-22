import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class ListSessionRequest {
	@ApiProperty({
		example: '59a43f03-4d56-4adc-aee2-20d9c5dcbf69',
		description: 'Идентификатор текущего устройства клиента'
	})
	@IsString()
	@IsNotEmpty()
	public deviceId: string
}
