import { ApiProperty } from '@nestjs/swagger'

export class ChangeResponseDto {
	@ApiProperty({ example: true })
	public ok: boolean

	@ApiProperty({
		example: '7701ad6a-95f3-44a6-9303-0d541fcb167f',
		required: false
	})
	public challengeId?: string
}
