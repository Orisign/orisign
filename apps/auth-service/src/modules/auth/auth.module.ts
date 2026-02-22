import { Module } from '@nestjs/common'

import { SessionRepository } from '@/shared/repo/session.repository'
import { UserRepository } from '@/shared/repo/user.repository'

import { OtpService } from '../otp/otp.service'
import { TokenService } from '../token/token.service'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
	controllers: [AuthController],
	providers: [
		AuthService,
		OtpService,
		TokenService,
		UserRepository,
		SessionRepository
	]
})
export class AuthModule {}
