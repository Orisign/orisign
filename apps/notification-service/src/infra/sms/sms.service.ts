import { HttpService } from '@nestjs/axios'
import { Inject, Injectable, Logger } from '@nestjs/common'
import {
	catchError,
	firstValueFrom,
	retry,
	throwError,
	timeout,
	timer
} from 'rxjs'

import { SMS_OPTIONS } from './constants'
import { SendSmsRequest, SendSmsResponse, SmsOptions } from './types'

@Injectable()
export class SmsService {
	private readonly logger = new Logger(SmsService.name)

	private readonly BASE_URL: string

	public constructor(
		private readonly httpService: HttpService,
		@Inject(SMS_OPTIONS) private readonly options: SmsOptions
	) {
		this.BASE_URL = 'https://api.exolve.ru'
	}

	public async sendOtp(phone: string, code: string) {
		return this.send({
			destination: phone,
			text: `Ваш код подтверждения: ${code}`
		})
	}

	public async send(data: SendSmsRequest): Promise<SendSmsResponse> {
		const payload = {
			number: data.sender ?? this.options.sender,
			destination: data.destination.replace('+', ''),
			text: data.text
		}

		return this.request<SendSmsResponse>(
			'POST',
			'/messaging/v1/SendSMS',
			payload
		)
	}

	private async request<T>(
		method: 'GET' | 'POST',
		path: string,
		body?: any
	): Promise<T> {
		const url = `${this.BASE_URL}${path}`

		try {
			const request = this.httpService
				.request<T>({
					method,
					url,
					data: body,
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this.options.apiKey}`
					}
				})
				.pipe(
					timeout(7000),
					retry({
						count: 2,
						delay: (_error, retryCount) => {
							this.logger.warn(
								`Retry request ${method} ${path}: attempt ${retryCount + 1}/3`
							)

							return timer(500)
						}
					}),
					catchError(error => {
						const details =
							error.response.data ?? error.message ?? error

						this.logger.error(
							`Exolve API error (${method} ${path})\n${JSON.stringify(details)}`
						)

						return throwError(() => error)
					})
				)

			const response = await firstValueFrom(request)

			return response.data
		} catch (error) {
			this.logger.error(
				`Request failed (${method} ${path}): ${error.message}`
			)

			throw error
		}
	}
}
