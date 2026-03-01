import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  AddMembersRequest,
  CreateConversationRequest,
  CreateConversationResponse,
  GetConversationRequest,
  GetConversationResponse,
  JoinConversationRequest,
  LeaveConversationRequest,
  ListMyConversationsRequest,
  ListMyConversationsResponse,
  MutationResponse,
  PermissionRequest,
  PermissionResponse,
  RemoveMemberRequest,
  UpdateMemberRoleRequest,
} from '@repo/contracts/gen/ts/conversations';
import { ConversationsService } from './conversations.service';

@Controller()
export class ConversationsController {
  public constructor(private readonly conversationsService: ConversationsService) {}

  @GrpcMethod('ConversationsService', 'CreateConversation')
  public async createConversation(
    data: CreateConversationRequest,
  ): Promise<CreateConversationResponse> {
    return await this.conversationsService.createConversation(data);
  }

  @GrpcMethod('ConversationsService', 'GetConversation')
  public async getConversation(
    data: GetConversationRequest,
  ): Promise<GetConversationResponse> {
    return await this.conversationsService.getConversation(data);
  }

  @GrpcMethod('ConversationsService', 'ListMyConversations')
  public async listMyConversations(
    data: ListMyConversationsRequest,
  ): Promise<ListMyConversationsResponse> {
    return await this.conversationsService.listMyConversations(data);
  }

  @GrpcMethod('ConversationsService', 'AddMembers')
  public async addMembers(data: AddMembersRequest): Promise<MutationResponse> {
    return await this.conversationsService.addMembers(data);
  }

  @GrpcMethod('ConversationsService', 'RemoveMember')
  public async removeMember(data: RemoveMemberRequest): Promise<MutationResponse> {
    return await this.conversationsService.removeMember(data);
  }

  @GrpcMethod('ConversationsService', 'UpdateMemberRole')
  public async updateMemberRole(
    data: UpdateMemberRoleRequest,
  ): Promise<MutationResponse> {
    return await this.conversationsService.updateMemberRole(data);
  }

  @GrpcMethod('ConversationsService', 'JoinConversation')
  public async joinConversation(data: JoinConversationRequest): Promise<MutationResponse> {
    return await this.conversationsService.joinConversation(data);
  }

  @GrpcMethod('ConversationsService', 'LeaveConversation')
  public async leaveConversation(data: LeaveConversationRequest): Promise<MutationResponse> {
    return await this.conversationsService.leaveConversation(data);
  }

  @GrpcMethod('ConversationsService', 'CanRead')
  public async canRead(data: PermissionRequest): Promise<PermissionResponse> {
    return await this.conversationsService.canRead(data);
  }

  @GrpcMethod('ConversationsService', 'CanPost')
  public async canPost(data: PermissionRequest): Promise<PermissionResponse> {
    return await this.conversationsService.canPost(data);
  }
}
