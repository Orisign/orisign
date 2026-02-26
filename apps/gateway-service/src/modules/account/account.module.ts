import { PassportModule } from '@lumina-cinema/passport'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { PROTO_PATHS } from '@repo/contracts'

import { AccountController } from './account.controller'
import { AccountClientGrpc } from './account.grpc'

@Module({
	imports: [
		PassportModule.registerAsync({
			useFactory: (configService: ConfigService) => ({
				secretKey: configService.getOrThrow<string>('PASSPORT_SECRET_KEY')
			}),
			inject: [ConfigService]
		}),
		ClientsModule.registerAsync([
			{
				name: 'ACCOUNT_PACKAGE',
				useFactory: (configService: ConfigService) => ({
					transport: Transport.GRPC,
					options: {
						package: ['account.v1'],
						protoPath: [PROTO_PATHS.ACCOUNT],
						url: configService.getOrThrow<string>('AUTH_GRPC_URL')
					}
				}),
				inject: [ConfigService]
			}
		])
	],
	controllers: [AccountController],
	providers: [AccountClientGrpc]
})
export class AccountModule {}
