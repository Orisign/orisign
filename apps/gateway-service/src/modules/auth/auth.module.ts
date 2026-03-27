import { PassportModule } from '@lumina-cinema/passport'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { PROTO_PATHS } from '@repo/contracts'
import { GRPC_LOADER_OPTIONS } from 'src/shared/grpc-loader.options'
import { AuthGuard } from 'src/shared/guards'

import { AuthController } from './auth.controller'
import { AuthClientGrpc } from './auth.grpc'

@Module({
	imports: [
		PassportModule.registerAsync({
			useFactory: (configService: ConfigService) => ({
				secretKey: configService.getOrThrow<string>(
					'PASSPORT_SECRET_KEY'
				)
			}),
			inject: [ConfigService]
		}),
		ClientsModule.registerAsync([
			{
				name: 'AUTH_PACKAGE',
				useFactory: (configService: ConfigService) => ({
					transport: Transport.GRPC,
					options: {
						package: ['auth.v1'],
						protoPath: [PROTO_PATHS.AUTH],
						url: configService.getOrThrow<string>('AUTH_GRPC_URL'),
						loader: GRPC_LOADER_OPTIONS
					}
				}),
				inject: [ConfigService]
			}
		])
	],
	controllers: [AuthController],
	providers: [AuthClientGrpc, AuthGuard]
})
export class AuthModule {}
