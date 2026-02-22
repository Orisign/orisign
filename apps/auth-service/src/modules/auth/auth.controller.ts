import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import {
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

import { AuthService } from './auth.service'

@Controller()
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@GrpcMethod('AuthService', 'SendOtp')
	public async sendOtp(data: SendOtpRequest): Promise<SendOtpResponse> {
		return await this.authService.sendOtp(data)
	}

	@GrpcMethod('AuthService', 'VerifyOtp')
	public async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
		return await this.authService.verifyOtp(data)
	}

	@GrpcMethod('AuthService', 'RefreshToken')
	public async refreshToken(
		data: RefreshTokenRequest
	): Promise<RefreshTokenResponse> {
		return await this.authService.refresh(data)
	}

	@GrpcMethod('AuthService', 'Logout')
	public async logout(data: LogoutRequest): Promise<LogoutResponse> {
		return await this.authService.logout(data)
	}

	@GrpcMethod('AuthService', 'RevokeSession')
	public async revokeSession(
		data: RevokeSessionRequest
	): Promise<RevokeSessionResponse> {
		return await this.authService.revokeSession(data)
	}

	@GrpcMethod('AuthService', 'ListSessions')
	public async listSessions(
		data: ListSessionsRequest
	): Promise<ListSessionsResponse> {
		return await this.authService.list(data)
	}
}
