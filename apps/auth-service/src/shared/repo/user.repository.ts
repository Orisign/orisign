import { Injectable } from '@nestjs/common'
import { Account } from '@prisma/generated/client'
import {
	AccountCreateInput,
	AccountUpdateInput
} from '@prisma/generated/models'

import { PrismaService } from '@/infra/prisma/prisma.service'

@Injectable()
export class UserRepository {
	public constructor(private readonly prismaService: PrismaService) {}

	public async create(data: AccountCreateInput): Promise<Account> {
		return await this.prismaService.account.create({
			data
		})
	}

	public async findByPhone(phone: string): Promise<Account | null> {
		return await this.prismaService.account.findUnique({
			where: {
				phone
			}
		})
	}

	public async update(
		id: string,
		data: AccountUpdateInput
	): Promise<Account> {
		return await this.prismaService.account.update({
			where: {
				id
			},
			data
		})
	}
}
