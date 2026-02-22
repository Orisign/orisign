import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { CallMessage } from '@repo/contracts/gen/ts/call';

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  private readonly userStreams = new Map<string, Subject<CallMessage>>();

  handleStream(inputStream: Observable<CallMessage>): Observable<CallMessage> {
    const outputStream = new Subject<CallMessage>();
    let authenticatedUserId: string | null = null;

    inputStream.subscribe({
      next: async (message) => {
        if (message.init) {
          const userId = await this.validateToken(message.init.accessToken);
          if (userId) {
            authenticatedUserId = userId;
            this.userStreams.set(userId, outputStream);
            this.logger.log(`User authenticated: ${userId}`);
          } else {
            this.logger.error('Invalid access token');
            outputStream.error(new Error('Unauthorized'));
          }
          return;
        }

        if (!authenticatedUserId) {
          this.logger.warn('Received message before authentication');
          return;
        }

        this.routeMessage(authenticatedUserId, message);
      },
      error: (err) => this.cleanup(authenticatedUserId),
      complete: () => this.cleanup(authenticatedUserId),
    });

    return outputStream.asObservable();
  }

  private routeMessage(senderId: string, message: CallMessage) {
    if (message.offer) {
      message.offer.callerUserId = senderId;
      this.sendMessage(message.offer.targetUserId, message);
    } else if (message.answer) {
      message.answer.answeringUserId = senderId;
      this.sendMessage(message.answer.targetUserId, message);
    } else if (message.ice) {
      message.ice.senderUserId = senderId;
      this.sendMessage(message.ice.targetUserId, message);
    } else if (message.end) {
      message.end.senderUserId = senderId;
      this.sendMessage(message.end.targetUserId, message);
    }
  }

  private sendMessage(targetId: string, message: CallMessage) {
    const stream = this.userStreams.get(targetId);
    if (stream) {
      stream.next(message);
    } else {
      this.logger.warn(`Target user ${targetId} not found or offline`);
    }
  }

  private async validateToken(token: string): Promise<string | null> {
    if (token === 'valid-token') return 'user-123';
    return null;
  }

  private cleanup(userId: string | null) {
    if (userId) {
      this.userStreams.delete(userId);
      this.logger.log(`Cleanup: User ${userId} disconnected`);
    }
  }
}
