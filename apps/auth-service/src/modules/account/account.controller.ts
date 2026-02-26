import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import {
	ChangeResponse,
	ConfirmEmailChangeRequest,
	ConfirmPhoneChangeRequest,
	GetAccountRequest,
	GetAccountResponse,
	InitEmailChangeRequest,
	InitPhoneChangeRequest
} from '@repo/contracts/gen/ts/account'

import { AccountService } from './account.service'

@Controller()
export class AccountController {
	constructor(private readonly accountService: AccountService) {}

	@GrpcMethod('AccountService', 'GetAccount')
	public async getAccount(
		data: GetAccountRequest
	): Promise<GetAccountResponse> {
		return await this.accountService.getAccount(data)
	}

	@GrpcMethod('AccountService', 'InitEmailChange')
	public async initEmailChange(
		data: InitEmailChangeRequest
	): Promise<ChangeResponse> {
		return await this.accountService.initEmailChange(data)
	}

	@GrpcMethod('AccountService', 'ConfirmEmailChange')
	public async confirmEmailChange(
		data: ConfirmEmailChangeRequest
	): Promise<ChangeResponse> {
		return await this.accountService.confirmEmailChange(data)
	}

	@GrpcMethod('AccountService', 'InitPhoneChange')
	public async initPhoneChange(
		data: InitPhoneChangeRequest
	): Promise<ChangeResponse> {
		return await this.accountService.initPhoneChange(data)
	}

	@GrpcMethod('AccountService', 'ConfirmPhoneChange')
	public async confirmPhoneChange(
		data: ConfirmPhoneChangeRequest
	): Promise<ChangeResponse> {
		return await this.accountService.confirmPhoneChange(data)
	}
}
