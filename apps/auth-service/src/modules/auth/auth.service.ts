import { Injectable } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import { Account } from '@prisma/generated/client'
import { RpcStatus } from '@repo/common'
import type {
	ListSessionsRequest,
	ListSessionsResponse,
	LogoutRequest,
	LogoutResponse,
	RefreshTokenRequest,
	RefreshTokenResponse,
	RevokeSessionRequest,
	RevokeSessionResponse,
	SendOtpRequest,
	SendOtpResponse,
	VerifyOtpRequest,
	VerifyOtpResponse
} from '@repo/contracts/gen/ts/auth'
import { createHash } from 'node:crypto'

import { UsersClientService } from '@/infra/grpc/users-client.service'
import { SessionRepository } from '@/shared/repo/session.repository'
import { UserRepository } from '@/shared/repo/user.repository'

import { OtpService } from '../otp/otp.service'
import { TokenService } from '../token/token.service'

@Injectable()
export class AuthService {
	public constructor(
		private readonly userRepo: UserRepository,
		private readonly sessionRepo: SessionRepository,
		private readonly usersClient: UsersClientService,
		private readonly otpService: OtpService,
		private readonly tokenService: TokenService
	) {}

	public async sendOtp(data: SendOtpRequest): Promise<SendOtpResponse> {
		const { phone, deviceId } = data

		if (!phone || !deviceId) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: 'Phone and device id are required'
			})
		}

		let account: Account | null

		account = await this.userRepo.findByPhone(phone)

		if (!account) {
			account = await this.userRepo.create({ phone })
		}

		const { code, challengeId } = await this.otpService.send(
			phone,
			'phone',
			deviceId
		)

		console.log('CODE: ', code)

		return {
			ok: true,
			challengeId
		}
	}

	public async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
		const { challengeId, code, deviceId, phone, userInfo } = data

		if (!challengeId || !code || !phone || !deviceId) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: 'Challenge id, phone, code and device id are required'
			})
		}

		await this.otpService.verify(challengeId, code, {
			identifier: phone,
			type: 'phone',
			deviceId
		})

		const account = await this.userRepo.findByPhone(phone)

		if (!account) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Account not found'
			})
		}

		if (!account.isPhoneVerified) {
			await this.userRepo.update(account.id, { isPhoneVerified: true })
			await this.usersClient.createUser({ id: account.id })
		}

		const { refreshToken, accessToken } = this.tokenService.generate(
			account.id
		)

		const refreshTokenHash = createHash('sha256')
			.update(refreshToken)
			.digest('hex')

		const currentSession = await this.sessionRepo.getCurrentSession(
			account.id,
			deviceId
		)

		if (currentSession) {
			await this.sessionRepo.update(currentSession.id, {
				refreshTokenHash,
				ip: userInfo.ip,
				userAgent: userInfo.userAgent,
				lastSeenAt: new Date()
			})
		} else {
			await this.sessionRepo.create({
				accountId: account.id,
				refreshTokenHash,
				deviceId,
				ip: userInfo.ip,
				userAgent: userInfo.userAgent
			})
		}

		return { accessToken, refreshToken }
	}

	public async revokeSession(
		data: RevokeSessionRequest
	): Promise<RevokeSessionResponse> {
		const { id, accountId } = data

		if (!id || !accountId) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: 'Session id and account id are required'
			})
		}

		const session = await this.sessionRepo.getById(id)

		if (!session) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Session not found'
			})
		}

		if (session.accountId !== accountId) {
			throw new RpcException({
				code: RpcStatus.PERMISSION_DENIED,
				details: 'You cannot revoke another user session'
			})
		}

		await this.sessionRepo.delete(id)

		return {
			ok: true
		}
	}

	public async logout(data: LogoutRequest): Promise<LogoutResponse> {
		const { accountId, refreshToken } = data

		if (!accountId || !refreshToken) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: 'Account id and refresh token are required'
			})
		}

		const refreshTokenHash = createHash('sha256')
			.update(refreshToken)
			.digest('hex')

		const session = await this.sessionRepo.getByRefresh(refreshTokenHash)

		if (!session) {
			return { ok: true }
		}

		if (session.accountId !== accountId) {
			throw new RpcException({
				code: RpcStatus.PERMISSION_DENIED,
				details: 'You cannot logout another user session'
			})
		}

		await this.sessionRepo.delete(session.id)

		return { ok: true }
	}

	public async refresh(
		data: RefreshTokenRequest
	): Promise<RefreshTokenResponse> {
		const { refreshToken, userInfo } = data

		if (!refreshToken) {
			throw new RpcException({
				code: RpcStatus.UNAUTHENTICATED,
				details: 'Refresh token is required'
			})
		}

		const inputToken = createHash('sha256')
			.update(refreshToken)
			.digest('hex')

		const session = await this.sessionRepo.getByRefresh(inputToken)

		if (!session) {
			throw new RpcException({
				code: RpcStatus.UNAUTHENTICATED,
				details: 'Invalid refresh token'
			})
		}

		if (session.revokedAt) {
			await this.sessionRepo.update(session.id, {
				reuseDetectedAt: new Date()
			})

			throw new RpcException({
				code: RpcStatus.UNAUTHENTICATED,
				details: 'Token reuse detected. Please login again.'
			})
		}

		const result = this.tokenService.verify(refreshToken)

		if (!result.valid) {
			throw new RpcException({
				code: RpcStatus.UNAUTHENTICATED,
				details: result.reason
			})
		}

		const tokens = this.tokenService.generate(result.userId)

		const refreshTokenHash = createHash('sha256')
			.update(tokens.refreshToken)
			.digest('hex')

		await this.sessionRepo.update(session.id, {
			refreshTokenHash,
			ip: userInfo.ip,
			userAgent: userInfo.userAgent
		})

		return tokens
	}

	public async list(
		data: ListSessionsRequest
	): Promise<ListSessionsResponse> {
		const sessions = await this.sessionRepo.getAllByAccount(data)

		return { sessions }
	}
}
