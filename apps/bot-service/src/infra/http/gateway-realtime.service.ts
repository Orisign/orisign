import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Message } from '@repo/contracts/gen/ts/messages'
import axios from 'axios'

@Injectable()
export class GatewayRealtimeService {
	private readonly logger = new Logger(GatewayRealtimeService.name)
	private readonly baseUrl: string
	private readonly internalToken: string

	public constructor(private readonly configService: ConfigService) {
		this.baseUrl =
			this.configService.get<string>('GATEWAY_HTTP_URL')?.trim() ||
			this.configService.get<string>('GATEWAY_URL')?.trim() ||
			'http://localhost:4000'
		this.internalToken =
			this.configService.get<string>('INTERNAL_API_TOKEN')?.trim() ||
			this.configService.get<string>('PASSPORT_SECRET_KEY')?.trim() ||
			''
	}

	private getHeaders() {
		return this.internalToken
			? {
					'x-internal-token': this.internalToken
			  }
			: {}
	}

	private toNumber(value: unknown) {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value
		}

		if (typeof value === 'string' && value.trim()) {
			const parsed = Number(value)
			return Number.isFinite(parsed) ? parsed : 0
		}

		if (
			value &&
			typeof value === 'object' &&
			'low' in value &&
			'high' in value &&
			typeof (value as { low: unknown }).low === 'number' &&
			typeof (value as { high: unknown }).high === 'number'
		) {
			const low = (value as { low: number }).low >>> 0
			const high = (value as { high: number }).high
			return high * 0x100000000 + low
		}

		return 0
	}

	private normalizeMessage(message: Message) {
		return {
			...message,
			createdAt: this.toNumber(message.createdAt),
			editedAt: this.toNumber(message.editedAt),
			deletedAt: this.toNumber(message.deletedAt)
		}
	}

	public async emitMessageCreated(message: Message, actorId: string, reason = 'bot.message.created') {
		await this.post('/internal/messages/realtime/message-created', {
			message: this.normalizeMessage(message),
			actorId,
			reason
		})
	}

	public async emitMessageUpdated(params: {
		conversationId: string
		messageId: string
		text?: string
		replyMarkupJson?: string
		editedAt: number
		actorId: string
		reason?: string
	}) {
		await this.post('/internal/messages/realtime/message-updated', {
			conversationId: params.conversationId,
			messageId: params.messageId,
			text: params.text,
			replyMarkupJson: params.replyMarkupJson,
			editedAt: params.editedAt,
			actorId: params.actorId,
			reason: params.reason ?? 'bot.message.updated'
		})
	}

	public async emitMessageDeleted(params: {
		conversationId: string
		messageId: string
		deletedAt: number
		actorId: string
		reason?: string
	}) {
		await this.post('/internal/messages/realtime/message-deleted', {
			conversationId: params.conversationId,
			messageId: params.messageId,
			deletedAt: params.deletedAt,
			actorId: params.actorId,
			reason: params.reason ?? 'bot.message.deleted'
		})
	}

	private async post(pathname: string, body: Record<string, unknown>) {
		try {
			await axios.post(`${this.baseUrl}${pathname}`, body, {
				headers: this.getHeaders(),
				timeout: 3000
			})
		} catch (error) {
			const details = axios.isAxiosError(error)
				? `${error.message}${error.response?.data ? `: ${JSON.stringify(error.response.data)}` : ''}`
				: error instanceof Error
					? error.message
					: String(error)
			this.logger.warn(`Failed to propagate realtime bridge event to gateway: ${details}`)
		}
	}
}
