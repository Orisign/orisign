import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientGrpc } from '@nestjs/microservices'
import type {
	AddMembersRequest,
	ConversationsServiceClient,
	CreateConversationRequest,
	GetConversationRequest,
	JoinConversationRequest,
	LeaveConversationRequest,
	ListMyConversationsRequest,
	PermissionRequest,
	RemoveMemberRequest,
	DeleteConversationRequest,
	UpdateConversationRequest,
	UpdateConversationNotificationsRequest,
	UpdateMemberRoleRequest
} from '@repo/contracts/gen/ts/conversations'

@Injectable()
export class ConversationsClientGrpc implements OnModuleInit {
	private conversationsClient!: ConversationsServiceClient

	public constructor(
		@Inject('CONVERSATIONS_PACKAGE') private readonly client: ClientGrpc
	) {}

	public onModuleInit() {
		this.conversationsClient =
			this.client.getService<ConversationsServiceClient>(
				'ConversationsService'
			)
	}

	public createConversation(request: CreateConversationRequest) {
		return this.conversationsClient.createConversation(request)
	}

	public getConversation(request: GetConversationRequest) {
		return this.conversationsClient.getConversation(request)
	}

	public listMyConversations(request: ListMyConversationsRequest) {
		return this.conversationsClient.listMyConversations(request)
	}

	public addMembers(request: AddMembersRequest) {
		return this.conversationsClient.addMembers(request)
	}

	public removeMember(request: RemoveMemberRequest) {
		return this.conversationsClient.removeMember(request)
	}

	public updateMemberRole(request: UpdateMemberRoleRequest) {
		return this.conversationsClient.updateMemberRole(request)
	}

	public updateConversation(request: UpdateConversationRequest) {
		return this.conversationsClient.updateConversation(request)
	}

	public deleteConversation(request: DeleteConversationRequest) {
		return this.conversationsClient.deleteConversation(request)
	}

	public updateNotifications(request: UpdateConversationNotificationsRequest) {
		return this.conversationsClient.updateNotifications(request)
	}

	public joinConversation(request: JoinConversationRequest) {
		return this.conversationsClient.joinConversation(request)
	}

	public leaveConversation(request: LeaveConversationRequest) {
		return this.conversationsClient.leaveConversation(request)
	}

	public canRead(request: PermissionRequest) {
		return this.conversationsClient.canRead(request)
	}

	public canPost(request: PermissionRequest) {
		return this.conversationsClient.canPost(request)
	}
}
