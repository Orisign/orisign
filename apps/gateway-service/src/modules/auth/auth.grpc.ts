import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientGrpc } from '@nestjs/microservices'
import {
	AuthServiceClient,
	ListSessionsRequest,
	LogoutRequest,
	RefreshTokenRequest,
	RevokeSessionRequest,
	SendOtpRequest,
	VerifyOtpRequest
} from '@repo/contracts/gen/ts/auth'

@Injectable()
export class AuthClientGrpc implements OnModuleInit {
	private authClient: AuthServiceClient

	public constructor(
		@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc
	) {}

	public onModuleInit() {
		this.authClient =
			this.client.getService<AuthServiceClient>('AuthService')
	}

	public sendOtp(request: SendOtpRequest) {
		return this.authClient.sendOtp(request)
	}

	public verifyOtp(request: VerifyOtpRequest) {
		return this.authClient.verifyOtp(request)
	}

	public refresh(request: RefreshTokenRequest) {
		return this.authClient.refreshToken(request)
	}

	public logout(request: LogoutRequest) {
		return this.authClient.logout(request)
	}

	public list(request: ListSessionsRequest) {
		return this.authClient.listSessions(request)
	}

	public revoke(request: RevokeSessionRequest) {
		return this.authClient.revokeSession(request)
	}
}
