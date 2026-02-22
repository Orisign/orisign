import { ApiProperty } from '@nestjs/swagger'

import { SessionResponseDto } from './session.response'

export class ListSessionsResponseDto {
	@ApiProperty({
		type: () => [SessionResponseDto],
		description: 'Список активных сессий пользователя'
	})
	public sessions: SessionResponseDto[]
}
