import { ApiProperty } from '@nestjs/swagger'

import { UserResponseDto } from './get-user.response'

export class ListUsersResponseDto {
	@ApiProperty({ type: [UserResponseDto] })
	public users: UserResponseDto[]
}
