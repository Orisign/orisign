import { ApiProperty } from '@nestjs/swagger'

export class OkResponseDto {
	@ApiProperty({
		example: true,
		description: 'Признак успешного выполнения операции'
	})
	public ok: boolean
}
