import { Injectable } from '@nestjs/common'
import { Session } from '@prisma/generated/client'
import {
	SessionUncheckedCreateInput,
	SessionUncheckedUpdateInput,
	SessionUpdateInput
} from '@prisma/generated/models'
import {
	ListSessionsRequest,
	Session as SessionResponse
} from '@repo/contracts/gen/ts/auth'

import { PrismaService } from '@/infra/prisma/prisma.service'

@Injectable()
export class SessionRepository {
	public constructor(private readonly prismaService: PrismaService) {}

	public async getCurrentSession(
		accountId: string,
		deviceId: string
	): Promise<Session | null> {
		return await this.prismaService.session.findFirst({
			where: {
				accountId,
				deviceId
			}
		})
	}

	public async getAllByAccount(
		data: ListSessionsRequest
	): Promise<SessionResponse[]> {
		const { accountId, deviceId } = data

		const sessions = await this.prismaService.session.findMany({
			where: {
				accountId,
				revokedAt: null
			},
			orderBy: {
				lastSeenAt: 'desc'
			}
		})

		return sessions.map(session => ({
			...session,
			current: session.deviceId == deviceId,
			createdAt: session.createdAt.getTime(),
			lastSeenAt: session.lastSeenAt.getTime()
		}))
	}

	public async getByRefresh(
		refreshTokenHash: string
	): Promise<Session | null> {
		return await this.prismaService.session.findFirst({
			where: {
				refreshTokenHash
			}
		})
	}

	public async getById(id: string): Promise<Session | null> {
		return await this.prismaService.session.findUnique({ where: { id } })
	}

	public async create(data: SessionUncheckedCreateInput): Promise<Session> {
		return await this.prismaService.session.create({ data })
	}

	public async delete(id: string): Promise<void> {
		await this.prismaService.session.delete({ where: { id } })
	}

	public async update(
		id: string,
		data: SessionUpdateInput
	): Promise<Session> {
		return await this.prismaService.session.update({ where: { id }, data })
	}

	public async upsert(params: {
		where: Record<string, unknown>
		create: SessionUncheckedCreateInput
		update: SessionUncheckedUpdateInput
	}): Promise<Session> {
		return await this.prismaService.session.upsert({
			where: params.where as any,
			create: params.create,
			update: params.update
		})
	}
}
