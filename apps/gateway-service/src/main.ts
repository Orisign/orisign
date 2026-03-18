import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as cookieParser from 'cookie-parser'

import { AppModule } from './core/app.module'
import { getCorsConfig, getValidationPipeConfig } from './core/config'
import { ChatRealtimeService } from './modules/messages/chat-realtime.service'
import { GrpcExceptionFilter } from './shared/filters'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	const config = app.get(ConfigService)
	const logger = new Logger()

	app.use(cookieParser(config.getOrThrow<string>('COOKIES_SECRET')))

	app.enableCors(getCorsConfig(config))

	app.useGlobalFilters(new GrpcExceptionFilter())

	app.useGlobalPipes(new ValidationPipe(getValidationPipeConfig()))

	const swaggerConfig = new DocumentBuilder()
		.setTitle('orisign API')
		.setDescription(
			[
				'HTTP gateway для сервисов orisign.',
				'',
				'Аутентификация:',
				"- `Authorization: Bearer <accessToken>` для защищенных endpoint'ов.",
				'- `refreshToken` хранится в HttpOnly cookie и используется в `POST /auth/refresh`.',
				'',
				'Ограничения:',
				'- Глобальный rate limit настраивается через `THROTTLE_LIMIT` и `THROTTLE_TTL_MS`.',
				'- Для `POST /auth/otp/send`: 1 запрос / 30 секунд.'
			].join('\n')
		)
		.setVersion('1.0.0')
		.addBearerAuth(
			{
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
				description: 'Access token в заголовке Authorization'
			},
			'access-token'
		)
		.addCookieAuth(
			'refreshToken',
			{
				type: 'apiKey',
				in: 'cookie',
				description: 'Refresh token в HttpOnly cookie'
			},
			'refresh-token'
		)
		.build()

	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)

	SwaggerModule.setup('/docs', app, swaggerDocument, {
		yamlDocumentUrl: '/openapi.yaml'
	})

	const port = config.getOrThrow<number>('HTTP_PORT')
	const host = config.getOrThrow<string>('HTTP_HOST')
	const chatRealtimeService = app.get(ChatRealtimeService)

	chatRealtimeService.attachServer(app.getHttpServer())

	await app.listen(port)

	logger.log(`🚀 Gateway started: ${host}`)
	logger.log(`📚 Swagger: ${host}/docs`)
}
bootstrap()
