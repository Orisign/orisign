import { PassportService } from '@lumina-cinema/passport'
import { Injectable, Logger } from '@nestjs/common'
import type { Message } from '@repo/contracts/gen/ts/messages'
import type { Server as HttpServer, IncomingMessage } from 'http'
import { lastValueFrom } from 'rxjs'

import { ConversationsClientGrpc } from '../conversations/conversations.grpc'
import { UsersClientGrpc } from '../users/users.grpc'

const WebSocketPackage = require('ws')
const WebSocketServer = WebSocketPackage.WebSocketServer

type SocketMeta = {
	conversationId: string
	userId: string
}

type ChatListSocketMeta = {
	userId: string
}

type CallSocketMeta = {
	conversationId: string
	userId: string
}

type ReadCursorRealtimePayload = {
	conversationId: string
	userId: string
	lastReadMessageId: string
	lastReadAt: number
}

type PresenceRealtimePayload = {
	conversationId: string
	userId: string
	online: boolean
	lastSeenAt: number
}

type TypingRealtimePayload = {
	conversationId: string
	userId: string
	active: boolean
	at: number
}

type MediaUploadRealtimePayload = {
	conversationId: string
	userId: string
	active: boolean
	at: number
}

@Injectable()
export class ChatRealtimeService {
	private readonly logger = new Logger(ChatRealtimeService.name)
	private server: InstanceType<typeof WebSocketServer> | null = null
	private readonly socketsByConversation = new Map<string, Set<any>>()
	private readonly callSocketsByConversation = new Map<string, Set<any>>()
	private readonly chatListSocketsByUserId = new Map<string, Set<any>>()
	private readonly socketMeta = new WeakMap<any, SocketMeta>()
	private readonly callSocketMeta = new WeakMap<any, CallSocketMeta>()
	private readonly chatListSocketMeta = new WeakMap<any, ChatListSocketMeta>()

	public constructor(
		private readonly passportService: PassportService,
		private readonly conversationsClient: ConversationsClientGrpc,
		private readonly usersClient: UsersClientGrpc
	) {}

	public attachServer(httpServer: HttpServer) {
		if (this.server) return

		this.server = new WebSocketServer({
			server: httpServer
		})

		this.server.on(
			'connection',
			(socket: any, request: IncomingMessage) => {
				void this.handleConnection(socket, request)
			}
		)
	}

	public emitMessageCreated(message: Message) {
		const sockets = this.socketsByConversation.get(message.conversationId)
		if (!sockets || sockets.size === 0) return

		const payload = {
			type: 'message.created',
			conversationId: message.conversationId,
			message
		}

		this.sendToConversation(message.conversationId, payload)
	}

	public emitReadCursorUpdated(payload: ReadCursorRealtimePayload) {
		const sockets = this.socketsByConversation.get(payload.conversationId)
		if (!sockets || sockets.size === 0) return

		this.sendToConversation(payload.conversationId, {
			type: 'message.read',
			conversationId: payload.conversationId,
			cursor: {
				userId: payload.userId,
				lastReadMessageId: payload.lastReadMessageId,
				lastReadAt: payload.lastReadAt
			}
		})
	}

	public emitMessageUpdated(payload: {
		conversationId: string
		messageId: string
		text: string
		editedAt: number
	}) {
		const sockets = this.socketsByConversation.get(payload.conversationId)
		if (!sockets || sockets.size === 0) return

		this.sendToConversation(payload.conversationId, {
			type: 'message.updated',
			conversationId: payload.conversationId,
			messageId: payload.messageId,
			text: payload.text,
			editedAt: payload.editedAt
		})
	}

	public emitMessageDeleted(payload: {
		conversationId: string
		messageId: string
		deletedAt: number
	}) {
		const sockets = this.socketsByConversation.get(payload.conversationId)
		if (!sockets || sockets.size === 0) return

		this.sendToConversation(payload.conversationId, {
			type: 'message.deleted',
			conversationId: payload.conversationId,
			messageId: payload.messageId,
			deletedAt: payload.deletedAt
		})
	}

	public emitPresenceUpdated(payload: PresenceRealtimePayload) {
		const sockets = this.socketsByConversation.get(payload.conversationId)
		if (!sockets || sockets.size === 0) return

		this.sendToConversation(
			payload.conversationId,
			{
				type: 'status.presence',
				conversationId: payload.conversationId,
				userId: payload.userId,
				online: payload.online,
				lastSeenAt: payload.lastSeenAt
			},
			{ excludeUserId: payload.userId }
		)
	}

	public emitTypingUpdated(payload: TypingRealtimePayload) {
		const sockets = this.socketsByConversation.get(payload.conversationId)
		if (!sockets || sockets.size === 0) return

		this.sendToConversation(
			payload.conversationId,
			{
				type: 'status.typing',
				conversationId: payload.conversationId,
				userId: payload.userId,
				active: payload.active,
				at: payload.at
			},
			{ excludeUserId: payload.userId }
		)
	}

	public emitMediaUploadUpdated(payload: MediaUploadRealtimePayload) {
		const sockets = this.socketsByConversation.get(payload.conversationId)
		if (!sockets || sockets.size === 0) return

		this.sendToConversation(
			payload.conversationId,
			{
				type: 'status.media-upload',
				conversationId: payload.conversationId,
				userId: payload.userId,
				active: payload.active,
				at: payload.at
			},
			{ excludeUserId: payload.userId }
		)
	}

	public emitChatListInvalidate(params?: {
		conversationId?: string
		actorId?: string
		reason?: string
	}) {
		const body = JSON.stringify({
			type: 'chat-list.invalidate',
			conversationId: params?.conversationId ?? '',
			actorId: params?.actorId ?? '',
			reason: params?.reason ?? ''
		})

		for (const sockets of this.chatListSocketsByUserId.values()) {
			for (const socket of sockets) {
				if (socket.readyState !== 1) continue
				socket.send(body)
			}
		}
	}

	private async handleConnection(socket: any, request: IncomingMessage) {
		const requestUrl = new URL(
			request.url ?? '',
			`http://${request.headers.host ?? 'localhost'}`
		)

		const pathname = requestUrl.pathname

		if (pathname === '/ws/chat-list') {
			await this.handleChatListConnection(socket, request)
			return
		}

		if (pathname === '/ws/chat') {
			await this.handleChatConnection(socket, request)
			return
		}

		if (pathname === '/ws/call') {
			await this.handleCallConnection(socket, request)
			return
		}

		socket.close(1008, 'Unsupported websocket route')
	}

	private async handleChatConnection(socket: any, request: IncomingMessage) {
		try {
			const meta = await this.authenticateChatRequest(request)

			if (!meta) {
				socket.close(1008, 'Unauthorized')
				return
			}

			this.registerSocket(socket, meta)

			socket.on('close', () => {
				this.unregisterSocket(socket)
			})

			socket.on('message', (rawPayload: unknown) => {
				this.handleChatSignal(socket, rawPayload)
			})

			socket.on('error', () => {
				this.unregisterSocket(socket)
			})

			socket.send(
				JSON.stringify({
					type: 'ready',
					conversationId: meta.conversationId
				})
			)
		} catch (error) {
			this.logger.warn(
				error instanceof Error
					? error.message
					: 'Failed to initialize chat websocket'
			)
			socket.close(1011, 'Initialization failed')
		}
	}

	private async handleChatListConnection(
		socket: any,
		request: IncomingMessage
	) {
		try {
			const meta = this.authenticateChatListRequest(request)
			if (!meta) {
				socket.close(1008, 'Unauthorized')
				return
			}

			this.registerChatListSocket(socket, meta)

			socket.on('close', () => {
				this.unregisterChatListSocket(socket)
			})

			socket.on('error', () => {
				this.unregisterChatListSocket(socket)
			})

			socket.send(
				JSON.stringify({
					type: 'ready'
				})
			)
		} catch (error) {
			this.logger.warn(
				error instanceof Error
					? error.message
					: 'Failed to initialize chat-list websocket'
			)
			socket.close(1011, 'Initialization failed')
		}
	}

	private async handleCallConnection(socket: any, request: IncomingMessage) {
		try {
			const meta = await this.authenticateChatRequest(request)

			if (!meta) {
				socket.close(1008, 'Unauthorized')
				return
			}

			this.registerCallSocket(socket, meta)

			socket.on('message', (rawPayload: unknown) => {
				this.handleCallSignal(socket, rawPayload)
			})

			socket.on('close', () => {
				this.unregisterCallSocket(socket)
			})

			socket.on('error', () => {
				this.unregisterCallSocket(socket)
			})

			socket.send(
				JSON.stringify({
					type: 'ready',
					conversationId: meta.conversationId
				})
			)
		} catch (error) {
			this.logger.warn(
				error instanceof Error
					? error.message
					: 'Failed to initialize call websocket'
			)
			socket.close(1011, 'Initialization failed')
		}
	}

	private async authenticateChatRequest(
		request: IncomingMessage
	): Promise<SocketMeta | null> {
		const requestUrl = new URL(
			request.url ?? '',
			`http://${request.headers.host ?? 'localhost'}`
		)

		const token = requestUrl.searchParams.get('token')?.trim()
		const conversationId = requestUrl.searchParams
			.get('conversationId')
			?.trim()

		if (!token || !conversationId) {
			return null
		}

		const verification = this.passportService.verify(token)

		if (!verification.valid || !verification.userId) {
			return null
		}

		const permission = await lastValueFrom(
			this.conversationsClient.canRead({
				conversationId,
				userId: verification.userId
			})
		)

		if (!permission.allowed) {
			return null
		}

		return {
			conversationId,
			userId: verification.userId
		}
	}

	private authenticateChatListRequest(
		request: IncomingMessage
	): ChatListSocketMeta | null {
		const requestUrl = new URL(
			request.url ?? '',
			`http://${request.headers.host ?? 'localhost'}`
		)

		const token = requestUrl.searchParams.get('token')?.trim()
		if (!token) {
			return null
		}

		const verification = this.passportService.verify(token)
		if (!verification.valid || !verification.userId) {
			return null
		}

		return {
			userId: verification.userId
		}
	}

	private registerSocket(socket: any, meta: SocketMeta) {
		const previousUserSocketCount = this.countConversationUserSockets(
			meta.conversationId,
			meta.userId
		)

		this.socketMeta.set(socket, meta)

		const sockets =
			this.socketsByConversation.get(meta.conversationId) ??
			new Set<any>()
		sockets.add(socket)
		this.socketsByConversation.set(meta.conversationId, sockets)

		this.sendPresenceSnapshotToSocket(socket, meta.conversationId)

		if (previousUserSocketCount === 0) {
			const now = Date.now()
			void this.patchLastSeenAt(meta.userId, now)
			this.emitPresenceUpdated({
				conversationId: meta.conversationId,
				userId: meta.userId,
				online: true,
				lastSeenAt: now
			})
		}
	}

	private unregisterSocket(socket: any) {
		const meta = this.socketMeta.get(socket)
		if (!meta) return

		const sockets = this.socketsByConversation.get(meta.conversationId)
		if (!sockets) return

		sockets.delete(socket)

		if (sockets.size === 0) {
			this.socketsByConversation.delete(meta.conversationId)
		}

		const remainingUserSocketCount = this.countConversationUserSockets(
			meta.conversationId,
			meta.userId
		)

		if (remainingUserSocketCount === 0) {
			const now = Date.now()
			void this.patchLastSeenAt(meta.userId, now)
			this.emitPresenceUpdated({
				conversationId: meta.conversationId,
				userId: meta.userId,
				online: false,
				lastSeenAt: now
			})
		}
	}

	private registerChatListSocket(socket: any, meta: ChatListSocketMeta) {
		const hadSockets = (this.chatListSocketsByUserId.get(meta.userId)?.size ?? 0) > 0
		this.chatListSocketMeta.set(socket, meta)

		const sockets =
			this.chatListSocketsByUserId.get(meta.userId) ?? new Set<any>()
		sockets.add(socket)
		this.chatListSocketsByUserId.set(meta.userId, sockets)

		if (!hadSockets) {
			void this.patchLastSeenAt(meta.userId, Date.now())
		}
	}

	private unregisterChatListSocket(socket: any) {
		const meta = this.chatListSocketMeta.get(socket)
		if (!meta) return

		const sockets = this.chatListSocketsByUserId.get(meta.userId)
		if (!sockets) return

		sockets.delete(socket)
		if (sockets.size === 0) {
			this.chatListSocketsByUserId.delete(meta.userId)
			void this.patchLastSeenAt(meta.userId, Date.now())
		}
	}

	private registerCallSocket(socket: any, meta: CallSocketMeta) {
		this.callSocketMeta.set(socket, meta)

		const sockets =
			this.callSocketsByConversation.get(meta.conversationId) ??
			new Set<any>()
		sockets.add(socket)
		this.callSocketsByConversation.set(meta.conversationId, sockets)
	}

	private unregisterCallSocket(socket: any) {
		const meta = this.callSocketMeta.get(socket)
		if (!meta) return

		const sockets = this.callSocketsByConversation.get(meta.conversationId)
		if (!sockets) return

		sockets.delete(socket)
		if (sockets.size === 0) {
			this.callSocketsByConversation.delete(meta.conversationId)
		}
	}

	private handleCallSignal(socket: any, rawPayload: unknown) {
		const meta = this.callSocketMeta.get(socket)
		if (!meta) return

		let payload: Record<string, unknown> | null = null

		try {
			payload =
				typeof rawPayload === 'string'
					? JSON.parse(rawPayload)
					: JSON.parse(String(rawPayload))
		} catch {
			return
		}

		if (!payload || typeof payload.type !== 'string') {
			return
		}

		const allowedSignalTypes = new Set([
			'call.offer',
			'call.answer',
			'call.ice',
			'call.end'
		])

		if (!allowedSignalTypes.has(payload.type)) {
			return
		}

		const sockets = this.callSocketsByConversation.get(meta.conversationId)
		if (!sockets || sockets.size === 0) {
			return
		}

		const body = JSON.stringify({
			...payload,
			fromUserId: meta.userId,
			conversationId: meta.conversationId
		})

		for (const targetSocket of sockets) {
			if (targetSocket === socket || targetSocket.readyState !== 1) {
				continue
			}

			targetSocket.send(body)
		}
	}

	private handleChatSignal(socket: any, rawPayload: unknown) {
		const meta = this.socketMeta.get(socket)
		if (!meta) return

		let payload: Record<string, unknown> | null = null

		try {
			payload =
				typeof rawPayload === 'string'
					? JSON.parse(rawPayload)
					: JSON.parse(String(rawPayload))
		} catch {
			return
		}

		if (!payload || typeof payload.type !== 'string') {
			return
		}

		const signalType = payload.type
		const active = typeof payload.active === 'boolean' ? payload.active : null
		if (active === null) {
			return
		}

		const at = Date.now()

		if (signalType === 'status.typing') {
			this.emitTypingUpdated({
				conversationId: meta.conversationId,
				userId: meta.userId,
				active,
				at
			})
			return
		}

		if (signalType === 'status.media-upload') {
			this.emitMediaUploadUpdated({
				conversationId: meta.conversationId,
				userId: meta.userId,
				active,
				at
			})
		}
	}

	private sendPresenceSnapshotToSocket(socket: any, conversationId: string) {
		const sockets = this.socketsByConversation.get(conversationId)
		if (!sockets || sockets.size === 0 || socket.readyState !== 1) {
			return
		}

		const now = Date.now()
		const onlineUserIds = new Set<string>()
		for (const targetSocket of sockets) {
			const targetMeta = this.socketMeta.get(targetSocket)
			if (!targetMeta?.userId) continue
			onlineUserIds.add(targetMeta.userId)
		}

		for (const userId of onlineUserIds) {
			socket.send(
				JSON.stringify({
					type: 'status.presence',
					conversationId,
					userId,
					online: true,
					lastSeenAt: now
				})
			)
		}
	}

	private countConversationUserSockets(conversationId: string, userId: string) {
		const sockets = this.socketsByConversation.get(conversationId)
		if (!sockets || sockets.size === 0) {
			return 0
		}

		let counter = 0

		for (const socket of sockets) {
			const socketMeta = this.socketMeta.get(socket)
			if (socketMeta?.userId === userId) {
				counter += 1
			}
		}

		return counter
	}

	private async patchLastSeenAt(userId: string, lastSeenAt: number) {
		if (!userId || !Number.isFinite(lastSeenAt) || lastSeenAt <= 0) {
			return
		}

		try {
			await lastValueFrom(
				this.usersClient.patchLastSeenAt({
					userId,
					lastSeenAt
				})
			)
		} catch (error) {
			this.logger.warn(
				`Failed to patch last seen for user ${userId}: ${String(error)}`
			)
		}
	}

	private sendToConversation(
		conversationId: string,
		payload: Record<string, unknown>,
		options?: {
			excludeUserId?: string
		}
	) {
		const sockets = this.socketsByConversation.get(conversationId)
		if (!sockets || sockets.size === 0) return

		const body = JSON.stringify(payload)

		for (const socket of sockets) {
			if (socket.readyState !== 1) continue

			if (options?.excludeUserId) {
				const socketMeta = this.socketMeta.get(socket)
				if (socketMeta?.userId === options.excludeUserId) {
					continue
				}
			}

			socket.send(body)
		}
	}
}
