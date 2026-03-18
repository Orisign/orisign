import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientGrpc } from '@nestjs/microservices'
import type {
	ClearSearchHistoryRequest,
	CreateChatFolderRequest,
	CreateUserRequest,
	DeleteSearchHistoryEntryRequest,
	DeleteChatFolderRequest,
	GetUserRequest,
	ListChatFoldersRequest,
	ListSearchHistoryRequest,
	ListUsersRequest,
	PatchLastSeenAtRequest,
	PatchPrivacySettingsRequest,
	PatchUserRequest,
	ReorderChatFoldersRequest,
	UpsertSearchHistoryRequest,
	UpdateChatFolderRequest,
	UsersServiceClient
} from '@repo/contracts/gen/ts/users'

@Injectable()
export class UsersClientGrpc implements OnModuleInit {
	private usersClient!: UsersServiceClient

	public constructor(
		@Inject('USERS_PACKAGE') private readonly client: ClientGrpc
	) {}

	public onModuleInit() {
		this.usersClient =
			this.client.getService<UsersServiceClient>('UsersService')
	}

	public getUser(request: GetUserRequest) {
		return this.usersClient.getUser(request)
	}

	public listUsers(request: ListUsersRequest) {
		return this.usersClient.listUsers(request)
	}

	public createUser(request: CreateUserRequest) {
		return this.usersClient.createUser(request)
	}

	public patchUser(request: PatchUserRequest) {
		return this.usersClient.patchUser(request)
	}

	public patchPrivacySettings(request: PatchPrivacySettingsRequest) {
		return this.usersClient.patchPrivacySettings(request)
	}

	public listChatFolders(request: ListChatFoldersRequest) {
		return this.usersClient.listChatFolders(request)
	}

	public createChatFolder(request: CreateChatFolderRequest) {
		return this.usersClient.createChatFolder(request)
	}

	public updateChatFolder(request: UpdateChatFolderRequest) {
		return this.usersClient.updateChatFolder(request)
	}

	public deleteChatFolder(request: DeleteChatFolderRequest) {
		return this.usersClient.deleteChatFolder(request)
	}

	public reorderChatFolders(request: ReorderChatFoldersRequest) {
		return this.usersClient.reorderChatFolders(request)
	}

	public listSearchHistory(request: ListSearchHistoryRequest) {
		return this.usersClient.listSearchHistory(request)
	}

	public upsertSearchHistory(request: UpsertSearchHistoryRequest) {
		return this.usersClient.upsertSearchHistory(request)
	}

	public deleteSearchHistoryEntry(request: DeleteSearchHistoryEntryRequest) {
		return this.usersClient.deleteSearchHistoryEntry(request)
	}

	public clearSearchHistory(request: ClearSearchHistoryRequest) {
		return this.usersClient.clearSearchHistory(request)
	}

	public patchLastSeenAt(request: PatchLastSeenAtRequest) {
		return this.usersClient.patchLastSeenAt(request)
	}
}
