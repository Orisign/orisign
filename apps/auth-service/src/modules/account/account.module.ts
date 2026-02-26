import { Module } from '@nestjs/common'

import { AccountController } from './account.controller'
import { AccountRepository } from './account.repository'
import { AccountService } from './account.service'
import { UserRepository } from '@/shared/repo/user.repository'
import { OtpService } from '../otp/otp.service'

@Module({
	controllers: [AccountController],
	providers: [AccountService, AccountRepository, UserRepository, OtpService]
})
export class AccountModule {}
