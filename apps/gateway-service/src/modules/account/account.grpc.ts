import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientGrpc } from '@nestjs/microservices'
import type {
	AccountServiceClient,
	ConfirmEmailChangeRequest,
	ConfirmPhoneChangeRequest,
	GetAccountRequest,
	InitEmailChangeRequest,
	InitPhoneChangeRequest
} from '@repo/contracts/gen/ts/account'

@Injectable()
export class AccountClientGrpc implements OnModuleInit {
	private accountClient!: AccountServiceClient

	public constructor(
		@Inject('ACCOUNT_PACKAGE') private readonly client: ClientGrpc
	) {}

	public onModuleInit() {
		this.accountClient =
			this.client.getService<AccountServiceClient>('AccountService')
	}

	public getAccount(request: GetAccountRequest) {
		return this.accountClient.getAccount(request)
	}

	public initEmailChange(request: InitEmailChangeRequest) {
		return this.accountClient.initEmailChange(request)
	}

	public confirmEmailChange(request: ConfirmEmailChangeRequest) {
		return this.accountClient.confirmEmailChange(request)
	}

	public initPhoneChange(request: InitPhoneChangeRequest) {
		return this.accountClient.initPhoneChange(request)
	}

	public confirmPhoneChange(request: ConfirmPhoneChangeRequest) {
		return this.accountClient.confirmPhoneChange(request)
	}
}
