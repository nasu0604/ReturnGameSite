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

function looksCorruptedKorean(value: string) {
  return /[�]|[愿寃鍮醫뚯李쎌怨꾩젙몃쒓렇섏젙]|(?:\?[가-힣])/u.test(value);
}

function extractSubject(summary: string) {
  const markers = [
    " 게임",
    " 연혁",
    " 계정",
    " 관리자",
    " 寃",
    " ?고",
    " 怨",
    " 愿",
    " ?몃",
    " ?쒖",
    " 鍮",
    " ?볤"
  ];
  const positions = markers
    .map((marker) => summary.indexOf(marker))
    .filter((position) => position > 0);
  if (positions.length === 0) return "";
  return summary.slice(0, Math.min(...positions)).trim();
}

function displayAuditSummary(log: {
  action: string;
  summary: string;
  targetType: string;
  adminUser?: { name: string | null; loginId: string | null } | null;
}) {
  if (!looksCorruptedKorean(log.summary)) {
    return log.summary;
  }

  const subject = extractSubject(log.summary);
  const adminName = log.adminUser?.name ?? log.adminUser?.loginId ?? "관리자";

  switch (log.action) {
    case "ADMIN_SIGNUP":
      return `${subject || adminName} 관리자가 가입했습니다.`;
    case "PASSWORD_CHANGE":
      return `${adminName} 관리자가 자기 비밀번호를 변경했습니다.`;
    case "GAME_CREATOR_REGISTRATION_DELETE":
      return `${subject || "관리자"}의 게임 제작자 등록을 삭제했습니다.`;
    case "SIGNUP_CODE_UPDATE":
      return "세부 관리자 회원가입 보안코드를 변경했습니다.";
    case "HISTORY_CREATE":
      return `${subject || "연혁"} 연혁을 추가했습니다.`;
    case "HISTORY_UPDATE":
      return `${subject || "연혁"} 연혁을 수정했습니다.`;
    case "HISTORY_DELETE":
      return `${subject || "연혁"} 연혁을 삭제했습니다.`;
    case "ADMIN_STATUS_UPDATE":
      return `${subject || "관리자 계정"} 상태를 변경했습니다.`;
    case "ADMIN_PASSWORD_RESET":
      return `${subject || "관리자 계정"} 계정의 비밀번호를 초기화했습니다.`;
    case "GAME_UPDATE":
      return `${subject || "게임"} 게임 정보를 수정했습니다.`;
    case "GAME_CREATOR_SELF_REGISTER":
      return `${adminName} 관리자가 ${subject || "게임"} 게임 제작자로 등록했습니다.`;
    case "GAME_DELETE":
      return `${subject || "게임"} 게임을 완전히 삭제했습니다.`;
    case "COMMENT_DELETE":
      return "관리자 권한으로 댓글을 삭제했습니다.";
    default:
      return `${log.action} 작업이 기록되었습니다.`;
  }
}

export async function listAdminAuditLogs(input?: {
  adminUserId?: string;
  action?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ logs: AdminAuditLogRecord[]; total: number; page: number; pageSize: number; actions: string[] }> {
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, input?.pageSize ?? 20));
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(input?.adminUserId ? { adminUserId: input.adminUserId } : {}),
    ...(input?.action ? { action: input.action } : {}),
    ...(input?.q
      ? {
          OR: [
            {
              action: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              targetType: {
                contains: input.q,
                mode: "insensitive"
              }
            },
            {
              summary: {
                contains: input.q,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };

  const [logs, total, actionRows] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      include: {
        adminUser: true
      },
      orderBy: {
        createdAt: "desc"
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      distinct: ["action"],
      orderBy: {
        action: "asc"
      },
      select: {
        action: true
      }
    })
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId ?? undefined,
      summary: displayAuditSummary(log),
      admin: log.adminUser ? adminUserSummary(log.adminUser) : undefined,
      createdAt: log.createdAt.toISOString()
    })),
    total,
    page,
    pageSize,
    actions: actionRows.map((row) => row.action)
  };
}
