import { applyDecorators, UseGuards } from '@nestjs/common'

import { AuthGuard } from '../guards'

export const Protected = () => {
	return applyDecorators(UseGuards(AuthGuard))
}
