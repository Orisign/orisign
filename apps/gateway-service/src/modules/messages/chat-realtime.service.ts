import { PassportService } from '@lumina-cinema/passport';
import { Injectable, Logger } from '@nestjs/common';
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Message } from '@repo/contracts/gen/ts/messages';
import { lastValueFrom } from 'rxjs';
import { ConversationsClientGrpc } from '../conversations/conversations.grpc';

const WebSocketPackage = require('ws');
const WebSocketServer = WebSocketPackage.WebSocketServer;

type SocketMeta = {
  conversationId: string;
  userId: string;
};

type ReadCursorRealtimePayload = {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: number;
};

@Injectable()
export class ChatRealtimeService {
  private readonly logger = new Logger(ChatRealtimeService.name);
  private server: InstanceType<typeof WebSocketServer> | null = null;
  private readonly socketsByConversation = new Map<string, Set<any>>();
  private readonly socketMeta = new WeakMap<any, SocketMeta>();

  public constructor(
    private readonly passportService: PassportService,
    private readonly conversationsClient: ConversationsClientGrpc,
  ) {}

  public attachServer(httpServer: HttpServer) {
    if (this.server) return;

    this.server = new WebSocketServer({
      server: httpServer,
      path: '/ws/chat',
    });

    this.server.on('connection', (socket: any, request: IncomingMessage) => {
      void this.handleConnection(socket, request);
    });
  }

  public emitMessageCreated(message: Message) {
    const sockets = this.socketsByConversation.get(message.conversationId);
    if (!sockets || sockets.size === 0) return;

    const payload = JSON.stringify({
      type: 'message.created',
      conversationId: message.conversationId,
      message,
    });

    for (const socket of sockets) {
      if (socket.readyState !== 1) continue;
      socket.send(payload);
    }
  }

  public emitReadCursorUpdated(payload: ReadCursorRealtimePayload) {
    const sockets = this.socketsByConversation.get(payload.conversationId);
    if (!sockets || sockets.size === 0) return;

    const body = JSON.stringify({
      type: 'message.read',
      conversationId: payload.conversationId,
      cursor: {
        userId: payload.userId,
        lastReadMessageId: payload.lastReadMessageId,
        lastReadAt: payload.lastReadAt,
      },
    });

    for (const socket of sockets) {
      if (socket.readyState !== 1) continue;
      socket.send(body);
    }
  }

  private async handleConnection(socket: any, request: IncomingMessage) {
    try {
      const meta = await this.authenticateRequest(request);

      if (!meta) {
        socket.close(1008, 'Unauthorized');
        return;
      }

      this.registerSocket(socket, meta);

      socket.on('close', () => {
        this.unregisterSocket(socket);
      });

      socket.on('error', () => {
        this.unregisterSocket(socket);
      });

      socket.send(
        JSON.stringify({
          type: 'ready',
          conversationId: meta.conversationId,
        }),
      );
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Failed to initialize chat websocket',
      );
      socket.close(1011, 'Initialization failed');
    }
  }

  private async authenticateRequest(request: IncomingMessage): Promise<SocketMeta | null> {
    const requestUrl = new URL(
      request.url ?? '',
      `http://${request.headers.host ?? 'localhost'}`,
    );

    const token = requestUrl.searchParams.get('token')?.trim();
    const conversationId = requestUrl.searchParams.get('conversationId')?.trim();

    if (!token || !conversationId) {
      return null;
    }

    const verification = this.passportService.verify(token);

    if (!verification.valid || !verification.userId) {
      return null;
    }

    const permission = await lastValueFrom(
      this.conversationsClient.canRead({
        conversationId,
        userId: verification.userId,
      }),
    );

    if (!permission.allowed) {
      return null;
    }

    return {
      conversationId,
      userId: verification.userId,
    };
  }

  private registerSocket(socket: any, meta: SocketMeta) {
    this.socketMeta.set(socket, meta);

    const sockets = this.socketsByConversation.get(meta.conversationId) ?? new Set<any>();
    sockets.add(socket);
    this.socketsByConversation.set(meta.conversationId, sockets);
  }

  private unregisterSocket(socket: any) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return;

    const sockets = this.socketsByConversation.get(meta.conversationId);
    if (!sockets) return;

    sockets.delete(socket);

    if (sockets.size === 0) {
      this.socketsByConversation.delete(meta.conversationId);
    }
  }
}
