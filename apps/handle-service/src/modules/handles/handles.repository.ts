import { PrismaService } from "@/infra/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import type { Handle as HandleEntity } from "@prisma/generated/client";
import type { Handle } from "@repo/contracts/gen/ts/handles";
import { HandleKind, HandleStatus } from "@repo/contracts/gen/ts/handles";

@Injectable()
export class HandlesRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public async findByNormalizedUsername(normalizedUsername: string) {
    return await this.prismaService.handle.findUnique({
      where: {
        normalizedUsername,
      },
    });
  }

  public async findActiveByTarget(targetId: string, kind: HandleKind) {
    return await this.prismaService.handle.findFirst({
      where: {
        targetId,
        kind: kind as never,
        status: "ACTIVE",
      },
    });
  }

  public async reserve(params: {
    username: string;
    normalizedUsername: string;
    kind: HandleKind;
    targetId: string;
    actorId: string;
    traceId: string;
    allowReplaceSameTarget: boolean;
  }): Promise<Handle> {
    const entity = await this.prismaService.$transaction(async (tx) => {
      const existing = await tx.handle.findUnique({
        where: { normalizedUsername: params.normalizedUsername },
      });

      if (!existing) {
        const created = await tx.handle.create({
          data: {
            username: params.username,
            normalizedUsername: params.normalizedUsername,
            kind: params.kind as never,
            targetId: params.targetId,
            status: "ACTIVE",
            version: 1,
          },
        });

        await tx.handleAuditLog.create({
          data: {
            handleId: created.id,
            actorId: params.actorId,
            action: "reserved",
            traceId: params.traceId || null,
            payloadJson: JSON.stringify({
              username: params.username,
              targetId: params.targetId,
              kind: params.kind,
            }),
          },
        });

        return created;
      }

      const sameTarget =
        existing.targetId === params.targetId &&
        existing.kind === (params.kind as never);

      if (!sameTarget && existing.status !== "RELEASED") {
        throw new Error("HANDLE_ALREADY_TAKEN");
      }

      if (
        !sameTarget &&
        !params.allowReplaceSameTarget &&
        existing.status === "RELEASED"
      ) {
        const currentTargetHandle = await tx.handle.findFirst({
          where: {
            targetId: params.targetId,
            kind: params.kind as never,
            status: "ACTIVE",
          },
        });

        if (currentTargetHandle) {
          throw new Error("TARGET_ALREADY_HAS_HANDLE");
        }
      }

      const updated = await tx.handle.update({
        where: {
          id: existing.id,
        },
        data: {
          username: params.username,
          normalizedUsername: params.normalizedUsername,
          kind: params.kind as never,
          targetId: params.targetId,
          status: "ACTIVE",
          releasedAt: null,
          version: {
            increment: 1,
          },
        },
      });

      await tx.handleAuditLog.create({
        data: {
          handleId: updated.id,
          actorId: params.actorId,
          action: sameTarget ? "reconfirmed" : "reserved",
          traceId: params.traceId || null,
          payloadJson: JSON.stringify({
            username: params.username,
            targetId: params.targetId,
            kind: params.kind,
          }),
        },
      });

      return updated;
    });

    return this.toProtoHandle(entity);
  }

  public async release(params: {
    username: string;
    normalizedUsername: string;
    kind: HandleKind;
    targetId: string;
    actorId: string;
    traceId: string;
  }) {
    return await this.prismaService.$transaction(async (tx) => {
      const existing = await tx.handle.findUnique({
        where: { normalizedUsername: params.normalizedUsername },
      });

      if (!existing) {
        return false;
      }

      if (
        existing.targetId !== params.targetId ||
        existing.kind !== (params.kind as never)
      ) {
        return false;
      }

      const updated = await tx.handle.update({
        where: { id: existing.id },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
          version: {
            increment: 1,
          },
        },
      });

      await tx.handleAuditLog.create({
        data: {
          handleId: updated.id,
          actorId: params.actorId,
          action: "released",
          traceId: params.traceId || null,
          payloadJson: JSON.stringify({
            username: params.username,
            targetId: params.targetId,
            kind: params.kind,
          }),
        },
      });

      return true;
    });
  }

  public toProtoHandle(entity: HandleEntity): Handle {
    return {
      id: entity.id,
      username: entity.username,
      normalizedUsername: entity.normalizedUsername,
      kind: this.toProtoKind(entity.kind),
      targetId: entity.targetId,
      status: this.toProtoStatus(entity.status),
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
      releasedAt: entity.releasedAt ? entity.releasedAt.getTime() : 0,
      version: entity.version,
    };
  }

  private toProtoKind(kind: string) {
    return kind as HandleKind;
  }

  private toProtoStatus(status: string) {
    return status as HandleStatus;
  }
}
