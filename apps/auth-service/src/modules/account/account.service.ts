import { Injectable } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import type { Role as PrismaRole } from '@prisma/generated/enums'
import { RpcStatus } from '@repo/common'
import {
	ChangeResponse,
	ConfirmEmailChangeRequest,
	ConfirmPhoneChangeRequest,
	GetAccountRequest,
	GetAccountResponse,
	InitEmailChangeRequest,
	InitPhoneChangeRequest,
	Role as ProtoRole
} from '@repo/contracts/gen/ts/account'

import { MessagingService } from '@/infra/messaging/messaging.service'
import { UserRepository } from '@/shared/repo/user.repository'

import { OtpService } from '../otp/otp.service'

import { AccountRepository } from './account.repository'

@Injectable()
export class AccountService {
	public constructor(
		private readonly messagingService: MessagingService,
		private readonly accountRepo: AccountRepository,
		private readonly userRepo: UserRepository,
		private readonly otpService: OtpService
	) {}

	public async getAccount(
		data: GetAccountRequest
	): Promise<GetAccountResponse> {
		const account = await this.accountRepo.findById(data.id)

		if (!account) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Account not found'
			})
		}

		return {
			id: account.id,
			phone: account.phone,
			email: account.email ?? '',
			isPhoneVerified: account.isPhoneVerified,
			isEmailVerified: account.isEmailVerified,
			role: this.toProtoRole(account.role)
		}
	}

	public async initEmailChange(
		data: InitEmailChangeRequest
	): Promise<ChangeResponse> {
		const { email, userId } = data

		const existing = await this.userRepo.findByEmail(email)

		if (existing) {
			throw new RpcException({
				code: RpcStatus.ALREADY_EXISTS,
				details: 'Email already in use'
			})
		}

		const { code, hash, challengeId } = await this.otpService.send(
			email,
			'email',
			userId
		)

		await this.messagingService.emailChanged({ email, code })

		await this.accountRepo.upsertPendingChange({
			accountId: userId,
			type: 'email',
			value: email,
			codeHash: hash,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000)
		})

		return { ok: true, challengeId }
	}

	public async confirmEmailChange(
		data: ConfirmEmailChangeRequest
	): Promise<ChangeResponse> {
		const { challengeId, email, code, userId } = data

		const pending = await this.accountRepo.findPendingChange(
			userId,
			'email'
		)

		if (!pending)
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'No pending requests'
			})

		if (pending.value !== email)
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: 'Email mismatch'
			})

		if (pending.expiresAt < new Date())
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Code expired'
			})

		await this.otpService.verify(challengeId, code, {
			identifier: pending.value,
			type: 'email',
			deviceId: userId
		})

		await this.userRepo.update(userId, {
			email,
			isEmailVerified: true
		})

		await this.accountRepo.deletePendingChange(userId, 'email')

		return { ok: true, challengeId: '' }
	}

	public async initPhoneChange(data: InitPhoneChangeRequest) {
		const { phone, userId } = data

		const existing = await this.userRepo.findByPhone(phone)

		if (existing)
			throw new RpcException({
				code: RpcStatus.ALREADY_EXISTS,
				details: 'Phone already in use'
			})

		const { code, hash, challengeId } = await this.otpService.send(
			phone,
			'phone',
			userId
		)

		await this.messagingService.phoneChanged({ phone, code })

		await this.accountRepo.upsertPendingChange({
			accountId: userId,
			type: 'phone',
			value: phone,
			codeHash: hash,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000)
		})

		return { ok: true, challengeId }
	}

	public async confirmPhoneChange(data: ConfirmPhoneChangeRequest) {
		const { challengeId, phone, code, userId } = data

		const pending = await this.accountRepo.findPendingChange(
			userId,
			'phone'
		)

		if (!pending)
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'No pending requests'
			})

		if (pending.value !== phone)
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: 'Phone mismatch'
			})

		if (pending.expiresAt < new Date())
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: 'Code expired'
			})

		await this.otpService.verify(challengeId, code, {
			identifier: pending.value,
			type: 'phone',
			deviceId: userId
		})

		await this.userRepo.update(userId, {
			phone,
			isPhoneVerified: true
		})

		await this.accountRepo.deletePendingChange(userId, 'phone')

		return { ok: true, challengeId: '' }
	}

	private toProtoRole(role: PrismaRole): ProtoRole {
		switch (role) {
			case 'ADMIN':
				return ProtoRole.ADMIN
			case 'USER':
			default:
				return ProtoRole.USER
		}
	}
}
