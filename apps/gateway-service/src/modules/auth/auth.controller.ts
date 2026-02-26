import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiCookieAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTooManyRequestsResponse,
	ApiUnauthorizedResponse,
	ApiTags
} from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { UserInfo as UserInfoData } from '@repo/contracts/gen/ts/auth'
import { Request, Response } from 'express'
import { lastValueFrom } from 'rxjs'
import { CurrentUser, Protected } from 'src/shared/decorators'
import { UserInfo } from 'src/shared/decorators/user-info.decorator'

import { AuthClientGrpc } from './auth.grpc'
import {
	AccessTokenResponseDto,
	ListSessionRequest,
	ListSessionsResponseDto,
	OkResponseDto,
	RevokeSessionRequestDto,
	SendOtpResponseDto,
	SendOtpRequest,
	VerifyOtpRequest
} from './dto'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthClientGrpc,
		private readonly configService: ConfigService
	) {}

	@ApiOperation({
		summary: 'Отправка OTP-кода',
		description:
			'Отправляет одноразовый 6-значный код на указанный номер телефона для входа.'
	})
	@ApiBody({
		type: SendOtpRequest,
		description: 'Данные для отправки OTP'
	})
	@ApiOkResponse({
		type: SendOtpResponseDto,
		description: 'OTP-код успешно отправлен, возвращён challengeId для подтверждения'
	})
	@ApiBadRequestResponse({
		description: 'Невалидный номер телефона или deviceId'
	})
	@ApiTooManyRequestsResponse({
		description: 'Превышен лимит: 1 запрос / 30 секунд'
	})
	@Throttle({ default: { limit: 1, ttl: 30000 } })
	@Post('otp/send')
	@HttpCode(HttpStatus.OK)
	public async sendOtp(@Body() dto: SendOtpRequest) {
		return this.authService.sendOtp(dto)
	}

	@ApiOperation({
		summary: 'Подтверждение OTP-кода',
		description:
			'Проверяет OTP-код, создает сессию и возвращает access token. Refresh token сохраняется в HttpOnly cookie.'
	})
	@ApiBody({
		type: VerifyOtpRequest,
		description: 'Телефон, OTP-код и deviceId'
	})
	@ApiOkResponse({
		type: AccessTokenResponseDto,
		description:
			'Успешная авторизация. accessToken возвращается в body, refreshToken выставляется в cookie.'
	})
	@ApiBadRequestResponse({
		description: 'Неверный OTP-код, номер телефона или deviceId'
	})
	@Post('otp/verify')
	@HttpCode(HttpStatus.OK)
	public async verify(
		@Body() dto: VerifyOtpRequest,
		@UserInfo() userInfo: UserInfoData,
		@Res({ passthrough: true }) res: Response
	) {
		const payload = {
			...dto,
			userInfo: userInfo
		}

		const { accessToken, refreshToken } = await lastValueFrom(
			this.authService.verifyOtp(payload)
		)

		res.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: this.configService.get('NODE_ENV') !== 'development',
			domain: this.configService.getOrThrow<string>('COOKIES_DOMAIN'),
			sameSite: 'lax',
			maxAge: 30 * 24 * 60 * 60 * 1000
		})

		return { accessToken }
	}

	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Получение активных сессий пользователя',
		description:
			'Возвращает список активных сессий текущего пользователя. Поле `current=true` у текущего устройства.'
	})
	@ApiBody({
		type: ListSessionRequest,
		description: 'Текущий deviceId (для маркировки активной сессии)'
	})
	@ApiOkResponse({
		type: ListSessionsResponseDto,
		description: 'Список активных сессий получен'
	})
	@ApiUnauthorizedResponse({
		description: 'Отсутствует или невалиден Bearer access token'
	})
	@ApiBadRequestResponse({
		description: 'Невалидный deviceId'
	})
	@Protected()
	@Post('list')
	@HttpCode(HttpStatus.OK)
	public async list(
		@Body() dto: ListSessionRequest,
		@CurrentUser() id: string
	) {
		return await lastValueFrom(
			this.authService.list({ accountId: id, deviceId: dto.deviceId })
		)
	}

	@ApiOperation({
		summary: 'Обновление access token',
		description:
			'Выпускает новый access token по refresh token из cookie и одновременно ротирует refresh token.'
	})
	@ApiCookieAuth('refresh-token')
	@ApiOkResponse({
		type: AccessTokenResponseDto,
		description:
			'Access token обновлен. Новый refreshToken установлен в HttpOnly cookie.'
	})
	@ApiUnauthorizedResponse({
		description: 'Refresh token отсутствует в cookie или невалиден'
	})
	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	public async refresh(
		@Req() req: Request,
		@UserInfo() userInfo: UserInfoData,
		@Res({ passthrough: true }) res: Response
	) {
		const refreshToken = req.cookies?.refreshToken

		const { accessToken, refreshToken: newRefreshToken } =
			await lastValueFrom(
				this.authService.refresh({ refreshToken, userInfo })
			)

		res.cookie('refreshToken', newRefreshToken, {
			httpOnly: true,
			secure: this.configService.get('NODE_ENV') !== 'development',
			domain: this.configService.getOrThrow<string>('COOKIES_DOMAIN'),
			sameSite: 'lax',
			maxAge: 30 * 24 * 60 * 60 * 1000
		})

		return { accessToken }
	}

	@ApiOperation({
		summary: 'Выход из сессии',
		description:
			'Завершает текущую сессию клиента: очищает refresh token из cookie.'
	})
	@ApiBearerAuth('access-token')
	@ApiOkResponse({
		type: OkResponseDto,
		description: 'Сессия завершена, refreshToken удален из cookie'
	})
	@ApiUnauthorizedResponse({
		description: 'Отсутствует или невалиден Bearer access token'
	})
	@SkipThrottle()
	@Protected()
	@Post('logout')
	@HttpCode(HttpStatus.OK)
	public async logout(
		@CurrentUser() id: string,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response
	) {
		const refreshToken = req.cookies?.refreshToken

		if (refreshToken) {
			await lastValueFrom(this.authService.logout({ accountId: id, refreshToken }))
		}

		res.cookie('refreshToken', '', {
			httpOnly: true,
			secure: this.configService.get('NODE_ENV') !== 'development',
			domain: this.configService.getOrThrow<string>('COOKIES_DOMAIN'),
			sameSite: 'lax',
			expires: new Date(0)
		})

		return { ok: true }
	}

	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Завершение конкретной сессии пользователя',
		description: 'Завершает выбранную сессию по её `id`.'
	})
	@ApiBody({
		type: RevokeSessionRequestDto,
		description: 'ID сессии для завершения'
	})
	@ApiOkResponse({
		type: OkResponseDto,
		description: 'Указанная сессия завершена'
	})
	@ApiUnauthorizedResponse({
		description: 'Отсутствует или невалиден Bearer access token'
	})
	@ApiBadRequestResponse({
		description: 'Невалидный id сессии'
	})
	@Protected()
	@Post('revoke')
	@HttpCode(HttpStatus.OK)
	public async revokeSession(
		@Body() dto: RevokeSessionRequestDto,
		@CurrentUser() id: string
	) {
		return await lastValueFrom(this.authService.revoke({ id: dto.id, accountId: id }))
	}
}
