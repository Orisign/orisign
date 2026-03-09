import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  GetUnreadCountRequest,
  GetReadStateRequest,
  DeleteMessageRequest,
  EditMessageRequest,
  ListMessagesRequest,
  MarkReadRequest,
  MessagesServiceClient,
  GetReadStateResponse,
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

  public getReadState(request: GetReadStateRequest) {
    return this.messagesClient.getReadState(request) as ReturnType<
      MessagesServiceClient['getReadState']
    >;
  }

  public getUnreadCount(request: GetUnreadCountRequest) {
    return this.messagesClient.getUnreadCount(request);
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
