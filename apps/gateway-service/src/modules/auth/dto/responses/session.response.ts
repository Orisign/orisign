import { ApiProperty } from '@nestjs/swagger'

export class SessionResponseDto {
	@ApiProperty({
		example: 'fd63364d-ac57-4626-9fa6-8f69bcf6c176',
		description: 'ID сессии'
	})
	public id: string

	@ApiProperty({
		example: '59a43f03-4d56-4adc-aee2-20d9c5dcbf69',
		description: 'Идентификатор устройства'
	})
	public deviceId: string

	@ApiProperty({
		example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		description: 'User-Agent клиента'
	})
	public userAgent: string

	@ApiProperty({
		example: '203.0.113.17',
		description: 'IP-адрес клиента'
	})
	public ip: string

	@ApiProperty({
		example: 1735393485000,
		description: 'Unix timestamp создания сессии'
	})
	public createdAt: number

	@ApiProperty({
		example: 1735393588000,
		description: 'Unix timestamp последней активности'
	})
	public lastSeenAt: number

	@ApiProperty({
		example: true,
		description: 'Текущая ли это сессия для вызывающего устройства'
	})
	public current: boolean
}
