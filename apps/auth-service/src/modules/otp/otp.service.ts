import { Injectable } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import { RpcStatus } from '@repo/common'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

import { RedisService } from '@/infra/redis/redis.service'

type OtpKind = 'phone' | 'email'

type OtpChallengePayload = {
	hash: string
	identifier: string
	type: OtpKind
	deviceId: string
	attempts: number
	maxAttempts: number
}

@Injectable()
export class OtpService {
	public constructor(private readonly redisService: RedisService) {}

	public async send(
		identifier: string,
		type: OtpKind,
		deviceId: string
	) {
		const { code, hash } = this.generateCode()
		const challengeId = uuidv4()
		const payload: OtpChallengePayload = {
			hash,
			identifier,
			type,
			deviceId,
			attempts: 0,
			maxAttempts: 5
		}

		await this.redisService.set(
			this.challengeKey(challengeId),
			JSON.stringify(payload),
			'EX',
			300
		)

		return { code, hash, challengeId }
	}

	public async verify(
		challengeId: string,
		code: string,
		expected: {
			identifier: string
			type: OtpKind
			deviceId: string
		}
	) {
		const payload = await this.redisService.get(this.challengeKey(challengeId))
		if (!payload) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Invalid or expired code'
			})
		}

		let challenge: OtpChallengePayload | undefined
		try {
			challenge = JSON.parse(payload) as OtpChallengePayload
		} catch {
			await this.redisService.del(this.challengeKey(challengeId))

			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Invalid or expired code'
			})
		}

		if (
			!challenge ||
			!challenge.hash ||
			challenge.identifier !== expected.identifier ||
			challenge.type !== expected.type ||
			challenge.deviceId !== expected.deviceId
		) {
			await this.redisService.del(this.challengeKey(challengeId))

			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Invalid or expired code'
			})
		}

		const incomingHash = createHash('sha256').update(code).digest('hex')

		if (incomingHash !== challenge.hash) {
			const nextAttempts = challenge.attempts + 1
			if (nextAttempts >= challenge.maxAttempts) {
				await this.redisService.del(this.challengeKey(challengeId))
			} else {
				challenge.attempts = nextAttempts
				await this.redisService.set(
					this.challengeKey(challengeId),
					JSON.stringify(challenge),
					'EX',
					300
				)
			}

			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Invalid or expired code'
			})
		}

		await this.redisService.del(this.challengeKey(challengeId))
	}

	private generateCode() {
		const code = Math.floor(Math.random() * 1000000)
			.toString()
			.padStart(6, '0')
		const hash = createHash('sha256').update(code).digest('hex')

		return { code, hash }
	}

	private challengeKey(challengeId: string) {
		return `otp:challenge:${challengeId}`
	}
}
