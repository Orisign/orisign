import { ApiProperty } from '@nestjs/swagger'
import { Role } from '@repo/contracts/gen/ts/account'

export class AccountResponseDto {
	@ApiProperty({ example: 'cmm0lfin000006kurwa4s2ip4' })
	public id: string

	@ApiProperty({ example: '+79001234567' })
	public phone: string

	@ApiProperty({ example: 'user@example.com', nullable: true })
	public email: string

	@ApiProperty({ example: true })
	public isPhoneVerified: boolean

	@ApiProperty({ example: false })
	public isEmailVerified: boolean

	@ApiProperty({ enum: Role, example: Role.USER })
	public role: Role
}
