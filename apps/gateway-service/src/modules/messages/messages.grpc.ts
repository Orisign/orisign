import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  DeleteMessageRequest,
  EditMessageRequest,
  ListMessagesRequest,
  MarkReadRequest,
  MessagesServiceClient,
  SendMessageRequest,
} from '@repo/contracts/gen/ts/messages';

@Injectable()
export class MessagesClientGrpc implements OnModuleInit {
  private messagesClient!: MessagesServiceClient;

  public constructor(@Inject('MESSAGES_PACKAGE') private readonly client: ClientGrpc) {}

  public onModuleInit() {
    this.messagesClient = this.client.getService<MessagesServiceClient>('MessagesService');
  }

  public sendMessage(request: SendMessageRequest) {
    return this.messagesClient.sendMessage(request);
  }

  public listMessages(request: ListMessagesRequest) {
    return this.messagesClient.listMessages(request);
  }

  public editMessage(request: EditMessageRequest) {
    return this.messagesClient.editMessage(request);
  }

  public deleteMessage(request: DeleteMessageRequest) {
    return this.messagesClient.deleteMessage(request);
  }

  public markRead(request: MarkReadRequest) {
    return this.messagesClient.markRead(request);
  }
}
