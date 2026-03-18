import { ApiProperty } from '@nestjs/swagger'

export class AccessTokenResponseDto {
	@ApiProperty({
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
		description: 'JWT access token для Authorization Bearer'
	})
	public accessToken: string
}
