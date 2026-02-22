import { PassportService, TokenPayload } from '@lumina-cinema/passport'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class TokenService {
	private readonly ACCESS_TOKEN_TTL: number
	private readonly REFRESH_TOKEN_TTL: number

	public constructor(
		private readonly configService: ConfigService,
		private readonly passportService: PassportService
	) {
		this.ACCESS_TOKEN_TTL = configService.getOrThrow('PASSPORT_ACCESS_TTL')
		this.REFRESH_TOKEN_TTL = configService.getOrThrow(
			'PASSPORT_REFRESH_TTL'
		)
	}

	public generate(userId: string) {
		const payload: TokenPayload = {
			sub: userId
		}

		const accessToken = this.passportService.generate(
			String(payload.sub),
			this.ACCESS_TOKEN_TTL
		)

		const refreshToken = this.passportService.generate(
			String(payload.sub),
			this.REFRESH_TOKEN_TTL
		)

		return { accessToken, refreshToken }
	}

	public verify(token: string) {
		return this.passportService.verify(token)
	}
}
