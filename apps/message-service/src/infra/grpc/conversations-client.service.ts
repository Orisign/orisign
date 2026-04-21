import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import type {
  ConversationsServiceClient,
  GetConversationRequest,
  GetConversationResponse,
  PermissionRequest,
  PermissionResponse,
  TouchConversationRequest,
} from '@repo/contracts/gen/ts/conversations';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ConversationsClientService implements OnModuleInit {
  private conversationsClient!: ConversationsServiceClient;

  public constructor(
    @Inject('CONVERSATIONS_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  public onModuleInit() {
    this.conversationsClient =
      this.client.getService<ConversationsServiceClient>('ConversationsService');
  }

  public async canRead(request: PermissionRequest): Promise<PermissionResponse> {
    return await lastValueFrom(this.conversationsClient.canRead(request));
  }

  public async canPost(request: PermissionRequest): Promise<PermissionResponse> {
    return await lastValueFrom(this.conversationsClient.canPost(request));
  }

  public async getConversation(
    request: GetConversationRequest,
  ): Promise<GetConversationResponse> {
    return await lastValueFrom(this.conversationsClient.getConversation(request));
  }

  public async touchConversation(request: TouchConversationRequest): Promise<void> {
    await lastValueFrom(this.conversationsClient.touchConversation(request));
  }
}
