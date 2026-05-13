import type { AdminAuditLogRecord, AdminSession } from "@return-game/shared";
import type { Prisma } from "@prisma/client";
import { adminUserSummary } from "./gameRepository.js";
import { prisma } from "./db.js";

export async function recordAdminAuditLog(input: {
  admin?: AdminSession;
  action: string;
  targetType: string;
  targetId?: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.admin?.id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      metadata: input.metadata
    }
  });
}

export async function listAdminAuditLogs(): Promise<AdminAuditLogRecord[]> {
  const logs = await prisma.adminAuditLog.findMany({
    include: {
      adminUser: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId ?? undefined,
    summary: log.summary,
    admin: log.adminUser ? adminUserSummary(log.adminUser) : undefined,
    createdAt: log.createdAt.toISOString()
  }));
}
