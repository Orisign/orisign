import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  ConversationsServiceClient,
  GetConversationRequest,
  JoinConversationRequest,
  PermissionRequest,
} from '@repo/contracts/gen/ts/conversations';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ConversationsClientService implements OnModuleInit {
  private conversationsClient!: ConversationsServiceClient;

  public constructor(@Inject('CONVERSATIONS_PACKAGE') private readonly client: ClientGrpc) {}

  public onModuleInit() {
    this.conversationsClient =
      this.client.getService<ConversationsServiceClient>('ConversationsService');
  }

  public async getConversation(request: GetConversationRequest) {
    return await lastValueFrom(this.conversationsClient.getConversation(request));
  }

  public async canRead(request: PermissionRequest) {
    return await lastValueFrom(this.conversationsClient.canRead(request));
  }

  public async canPost(request: PermissionRequest) {
    return await lastValueFrom(this.conversationsClient.canPost(request));
  }

  public async joinConversation(request: JoinConversationRequest) {
    return await lastValueFrom(this.conversationsClient.joinConversation(request));
  }
}
