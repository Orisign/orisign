import { Injectable } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import { RpcStatus } from '@repo/common'
import { createHash } from 'crypto'

import { RedisService } from '@/infra/redis/redis.service'

@Injectable()
export class OtpService {
	public constructor(private readonly redisService: RedisService) {}

	public async send(phone: string, deviceId: string) {
		const { code, hash } = this.generateCode()

		await this.redisService.set(
			`otp:${phone}`,
			JSON.stringify({ hash, deviceId }),
			'EX',
			300
		)

		return { code, hash }
	}

	public async verify(phone: string, code: string, device: string) {
		const { hash, deviceId } = JSON.parse(
			await this.redisService.get(`otp:${phone}`)
		)

		if (!hash || deviceId !== device) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Invalid or expired code'
			})
		}

		const incomingHash = createHash('sha256').update(code).digest('hex')

		if (incomingHash !== hash) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Invalid or expired code'
			})
		}

		await this.redisService.del(`otp:${phone}`)
	}

	private generateCode() {
		const code = Math.floor(Math.random() * 1000000)
			.toString()
			.padStart(6, '0')
		const hash = createHash('sha256').update(code).digest('hex')

		return { code, hash }
	}
}
