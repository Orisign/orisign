import {
	createParamDecorator,
	ExecutionContext,
	UnauthorizedException
} from '@nestjs/common'

export const CurrentUser = createParamDecorator(
	(_: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest()

		if (!request.user?.id) {
			throw new UnauthorizedException('User is not authenticated')
		}

		return request.user.id
	}
)
