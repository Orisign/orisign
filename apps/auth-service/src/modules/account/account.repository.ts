import { Injectable } from '@nestjs/common'
import { Account, PendingContactChange } from '@prisma/generated/client'

import { PrismaService } from '@/infra/prisma/prisma.service'

@Injectable()
export class AccountRepository {
	public constructor(private readonly prismaService: PrismaService) {}

	public findById(id: string): Promise<Account | null> {
		return this.prismaService.account.findUnique({
			where: {
				id
			}
		})
	}

	public findPendingChange(
		accountId: string,
		type: 'email' | 'phone'
	): Promise<PendingContactChange | null> {
		return this.prismaService.pendingContactChange.findUnique({
			where: {
				accountId_type: {
					accountId,
					type
				}
			}
		})
	}

	public upsertPendingChange(data: {
		accountId: string
		type: 'email' | 'phone'
		value: string
		codeHash: string
		expiresAt: Date
	}) {
		return this.prismaService.pendingContactChange.upsert({
			where: {
				accountId_type: {
					accountId: data.accountId,
					type: data.type
				}
			},
			create: data,
			update: data
		})
	}

	public deletePendingChange(
		accountId: string,
		type: 'email' | 'phone'
	): Promise<PendingContactChange> {
		return this.prismaService.pendingContactChange.delete({
			where: {
				accountId_type: {
					accountId,
					type
				}
			}
		})
	}
}
