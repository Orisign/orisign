import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { UserInfo as UserInfoData } from '@repo/contracts/gen/ts/auth'
import type { Request } from 'express'

export const UserInfo = createParamDecorator(
	(data: unknown, ctx: ExecutionContext): UserInfoData => {
		const request = ctx.switchToHttp().getRequest<Request>()
		const forwarded = request.headers['x-forwarded-for']

		const ip =
			(Array.isArray(forwarded)
				? forwarded[0]
				: forwarded?.split(',')[0]) ||
			request.ip ||
			request.socket?.remoteAddress ||
			''

		const userAgent = request.headers['user-agent'] ?? ''

		return { ip, userAgent }
	}
)
