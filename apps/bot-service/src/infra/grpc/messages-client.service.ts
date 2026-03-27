import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  DeleteMessageRequest,
  EditMessageRequest,
  MessagesServiceClient,
  SendMessageRequest,
} from '@repo/contracts/gen/ts/messages';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class MessagesClientService implements OnModuleInit {
  private messagesClient!: MessagesServiceClient;

  public constructor(@Inject('MESSAGES_PACKAGE') private readonly client: ClientGrpc) {}

  public onModuleInit() {
    this.messagesClient = this.client.getService<MessagesServiceClient>('MessagesService');
  }

  public async sendMessage(request: SendMessageRequest) {
    return await lastValueFrom(this.messagesClient.sendMessage(request));
  }

  public async editMessage(request: EditMessageRequest) {
    return await lastValueFrom(this.messagesClient.editMessage(request));
  }

  public async deleteMessage(request: DeleteMessageRequest) {
    return await lastValueFrom(this.messagesClient.deleteMessage(request));
  }
}
