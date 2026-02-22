import { PassportModule } from '@lumina-cinema/passport'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { getPassportConfig } from '@/config'

import { TokenService } from './token.service'

@Module({
	imports: [
		PassportModule.registerAsync({
			useFactory: getPassportConfig,
			inject: [ConfigService]
		})
	],
	providers: [TokenService],
	exports: [TokenService]
})
export class TokenModule {}
