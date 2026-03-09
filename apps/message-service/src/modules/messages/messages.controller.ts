import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  GetUnreadCountRequest,
  GetUnreadCountResponse,
  GetReadStateRequest,
  GetReadStateResponse,
  DeleteMessageRequest,
  EditMessageRequest,
  ListMessagesRequest,
  ListMessagesResponse,
  MarkReadRequest,
  MutationResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@repo/contracts/gen/ts/messages';
import { MessagesService } from './messages.service';

@Controller()
export class MessagesController {
  public constructor(private readonly messagesService: MessagesService) {}

  @GrpcMethod('MessagesService', 'SendMessage')
  public async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    return await this.messagesService.sendMessage(data);
  }

  @GrpcMethod('MessagesService', 'ListMessages')
  public async listMessages(data: ListMessagesRequest): Promise<ListMessagesResponse> {
    return await this.messagesService.listMessages(data);
  }

  @GrpcMethod('MessagesService', 'GetReadState')
  public async getReadState(data: GetReadStateRequest): Promise<GetReadStateResponse> {
    return await this.messagesService.getReadState(data);
  }

  @GrpcMethod('MessagesService', 'GetUnreadCount')
  public async getUnreadCount(
    data: GetUnreadCountRequest,
  ): Promise<GetUnreadCountResponse> {
    return await this.messagesService.getUnreadCount(data);
  }

  @GrpcMethod('MessagesService', 'EditMessage')
  public async editMessage(data: EditMessageRequest): Promise<MutationResponse> {
    return await this.messagesService.editMessage(data);
  }

  @GrpcMethod('MessagesService', 'DeleteMessage')
  public async deleteMessage(data: DeleteMessageRequest): Promise<MutationResponse> {
    return await this.messagesService.deleteMessage(data);
  }

  @GrpcMethod('MessagesService', 'MarkRead')
  public async markRead(data: MarkReadRequest): Promise<MutationResponse> {
    return await this.messagesService.markRead(data);
  }
}
