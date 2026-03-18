import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post
} from '@nestjs/common'
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiBody,
	ApiOkResponse,
	ApiOperation,
	ApiTags
} from '@nestjs/swagger'
import { lastValueFrom } from 'rxjs'
import { CurrentUser, Protected } from 'src/shared/decorators'

import { AccountClientGrpc } from './account.grpc'
import {
	AccountResponseDto,
	ChangeResponseDto,
	ConfirmEmailChangeRequestDto,
	ConfirmPhoneChangeRequestDto,
	InitEmailChangeRequestDto,
	InitPhoneChangeRequestDto
} from './dto'

@ApiTags('Account')
@ApiBearerAuth('access-token')
@Protected()
@Controller('account')
export class AccountController {
	public constructor(private readonly accountClient: AccountClientGrpc) {}

	@ApiOperation({
		summary: 'Текущий аккаунт',
		description:
			'Возвращает данные аккаунта текущего авторизованного пользователя'
	})
	@ApiOkResponse({ type: AccountResponseDto })
	@Get('me')
	@HttpCode(HttpStatus.OK)
	public async me(@CurrentUser() id: string) {
		return await lastValueFrom(this.accountClient.getAccount({ id }))
	}

	@ApiOperation({
		summary: 'Инициация смены email',
		description: 'Отправляет код подтверждения на новый email'
	})
	@ApiBody({ type: InitEmailChangeRequestDto })
	@ApiOkResponse({ type: ChangeResponseDto })
	@ApiBadRequestResponse({ description: 'Некорректный email' })
	@Post('email/init')
	@HttpCode(HttpStatus.OK)
	public async initEmail(
		@CurrentUser() id: string,
		@Body() dto: InitEmailChangeRequestDto
	) {
		return await lastValueFrom(
			this.accountClient.initEmailChange({ email: dto.email, userId: id })
		)
	}

	@ApiOperation({
		summary: 'Подтверждение смены email',
		description: 'Подтверждает email по коду'
	})
	@ApiBody({ type: ConfirmEmailChangeRequestDto })
	@ApiOkResponse({ type: ChangeResponseDto })
	@Post('email/confirm')
	@HttpCode(HttpStatus.OK)
	public async confirmEmail(
		@CurrentUser() id: string,
		@Body() dto: ConfirmEmailChangeRequestDto
	) {
		return await lastValueFrom(
			this.accountClient.confirmEmailChange({
				challengeId: dto.challengeId,
				email: dto.email,
				code: dto.code,
				userId: id
			})
		)
	}

	@ApiOperation({
		summary: 'Инициация смены телефона',
		description: 'Отправляет код подтверждения на новый номер телефона'
	})
	@ApiBody({ type: InitPhoneChangeRequestDto })
	@ApiOkResponse({ type: ChangeResponseDto })
	@Post('phone/init')
	@HttpCode(HttpStatus.OK)
	public async initPhone(
		@CurrentUser() id: string,
		@Body() dto: InitPhoneChangeRequestDto
	) {
		return await lastValueFrom(
			this.accountClient.initPhoneChange({ phone: dto.phone, userId: id })
		)
	}

	@ApiOperation({
		summary: 'Подтверждение смены телефона',
		description: 'Подтверждает номер телефона по коду'
	})
	@ApiBody({ type: ConfirmPhoneChangeRequestDto })
	@ApiOkResponse({ type: ChangeResponseDto })
	@Post('phone/confirm')
	@HttpCode(HttpStatus.OK)
	public async confirmPhone(
		@CurrentUser() id: string,
		@Body() dto: ConfirmPhoneChangeRequestDto
	) {
		return await lastValueFrom(
			this.accountClient.confirmPhoneChange({
				challengeId: dto.challengeId,
				phone: dto.phone,
				code: dto.code,
				userId: id
			})
		)
	}
}
