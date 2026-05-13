import bcrypt from "bcryptjs";
import { Router } from "express";
import type { LoginResponse } from "@return-game/shared";
import { requireAdmin, requireSuperAdmin, type AdminRequest } from "../middleware/requireAdmin.js";
import { createAdminToken, ensureConfiguredSuperAdmin, toAdminSession } from "../services/auth.js";
import { prisma } from "../services/db.js";
import { listAdminAuditLogs, recordAdminAuditLog } from "../services/adminAuditLog.js";
import {
  adminUserSummary,
  archiveAdminGame,
  getAdminGameById,
  listAdminGames,
  updateAdminGame,
  userCanManageGame
} from "../services/gameRepository.js";
import { deleteCommentAsAdmin, listAdminCommentsByGameId } from "../services/commentRepository.js";

export const adminRouter = Router();

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nameField(value: unknown) {
  return stringField(value).replace(/\s+/g, " ");
}

function optionalNumberField(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function difficultyField(value: unknown) {
  const parsed = optionalNumberField(value);
  if (parsed === null) return null;

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("Difficulty must be an integer between 1 and 5.");
  }

  return parsed;
}

function statusField(value: unknown) {
  const status = stringField(value);
  if (status !== "PUBLISHED" && status !== "DRAFT" && status !== "ARCHIVED") {
    throw new Error("Invalid game status.");
  }

  return status;
}

adminRouter.post("/login", async (request, response, next) => {
  try {
    await ensureConfiguredSuperAdmin();

    const loginId = stringField(request.body.loginId ?? request.body.email);
    const password = typeof request.body.password === "string" ? request.body.password : "";

    const admin = await prisma.adminUser.findFirst({
      where: {
        OR: [{ loginId }, { email: loginId }]
      }
    });

    if (!admin || admin.status !== "ACTIVE") {
      response.status(401).json({ message: "Invalid admin credentials." });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      response.status(401).json({ message: "Invalid admin credentials." });
      return;
    }

    const updatedAdmin = await prisma.adminUser.update({
      where: {
        id: admin.id
      },
      data: {
        lastLoginAt: new Date()
      }
    });
    const session = toAdminSession(updatedAdmin);
    const payload: LoginResponse = {
      token: createAdminToken(session),
      admin: session
    };

    response.json(payload);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/signup", async (request, response, next) => {
  try {
    const name = nameField(request.body.name);
    const loginId = stringField(request.body.loginId);
    const securityCode = typeof request.body.securityCode === "string" ? request.body.securityCode : "";
    const password = typeof request.body.password === "string" ? request.body.password : "";
    const passwordConfirm = typeof request.body.passwordConfirm === "string" ? request.body.passwordConfirm : "";

    if (!name || !loginId || !securityCode || password.length < 6 || password !== passwordConfirm) {
      response.status(400).json({ message: "Name, login ID, security code, and matching password are required." });
      return;
    }

    const existingUser = await prisma.adminUser.findFirst({
      where: {
        loginId
      }
    });
    if (existingUser) {
      response.status(409).json({ message: "Login ID is already in use." });
      return;
    }

    const signupCode = await prisma.adminSignupCode.findUnique({
      where: {
        codeKey: "MANAGER_SIGNUP"
      }
    });
    if (!signupCode) {
      response.status(403).json({ message: "Manager signup security code is not configured." });
      return;
    }

    const isSecurityCodeValid = await bcrypt.compare(securityCode, signupCode.codeHash);
    if (!isSecurityCodeValid) {
      response.status(403).json({ message: "Invalid manager signup security code." });
      return;
    }

    const admin = await prisma.adminUser.create({
      data: {
        name,
        displayName: name,
        loginId,
        passwordHash: await bcrypt.hash(password, 12),
        role: "MANAGER",
        status: "ACTIVE"
      }
    });

    const session = toAdminSession(admin);
    await recordAdminAuditLog({
      admin: session,
      action: "ADMIN_SIGNUP",
      targetType: "AdminUser",
      targetId: admin.id,
      summary: `${session.name} 관리자가 가입했습니다.`
    });
    response.status(201).json({
      token: createAdminToken(session),
      admin: session
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/me", requireAdmin, (request: AdminRequest, response) => {
  response.json({ admin: request.admin });
});

adminRouter.patch("/me/password", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const currentPassword = typeof request.body.currentPassword === "string" ? request.body.currentPassword : "";
    const newPassword = typeof request.body.newPassword === "string" ? request.body.newPassword : "";

    if (!request.admin || newPassword.length < 6) {
      response.status(400).json({ message: "New password must be at least 6 characters." });
      return;
    }

    const admin = await prisma.adminUser.findUniqueOrThrow({
      where: {
        id: request.admin.id
      }
    });
    const isPasswordValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isPasswordValid) {
      response.status(401).json({ message: "Current password does not match." });
      return;
    }

    await prisma.adminUser.update({
      where: {
        id: admin.id
      },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12)
      }
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "PASSWORD_CHANGE",
      targetType: "AdminUser",
      targetId: admin.id,
      summary: `${request.admin.name} 관리자가 자기 비밀번호를 변경했습니다.`
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/audit-logs", requireSuperAdmin, async (_request, response, next) => {
  try {
    const logs = await listAdminAuditLogs();
    response.json({ logs });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/managers", requireSuperAdmin, async (_request, response, next) => {
  try {
    const managers = await prisma.adminUser.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }]
    });
    response.json({ managers: managers.map(adminUserSummary) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/signup-code", requireSuperAdmin, async (_request, response, next) => {
  try {
    const signupCode = await prisma.adminSignupCode.findUnique({
      where: {
        codeKey: "MANAGER_SIGNUP"
      }
    });
    response.json({
      configured: Boolean(signupCode),
      updatedAt: signupCode?.updatedAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/signup-code", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    const securityCode = typeof request.body.securityCode === "string" ? request.body.securityCode.trim() : "";
    if (securityCode.length < 6) {
      response.status(400).json({ message: "Security code must be at least 6 characters." });
      return;
    }

    const signupCode = await prisma.adminSignupCode.upsert({
      where: {
        codeKey: "MANAGER_SIGNUP"
      },
      create: {
        codeKey: "MANAGER_SIGNUP",
        codeHash: await bcrypt.hash(securityCode, 12)
      },
      update: {
        codeHash: await bcrypt.hash(securityCode, 12)
      }
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "SIGNUP_CODE_UPDATE",
      targetType: "AdminSignupCode",
      targetId: signupCode.id,
      summary: "세부 관리자 회원가입 보안코드를 변경했습니다."
    });
    response.json({
      configured: true,
      updatedAt: signupCode.updatedAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/managers/:id/status", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    const status = stringField(request.body.status);
    if (status !== "ACTIVE" && status !== "DISABLED") {
      response.status(400).json({ message: "Invalid status." });
      return;
    }

    const manager = await prisma.adminUser.update({
      where: {
        id: String(request.params.id)
      },
      data: {
        status
      }
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "ADMIN_STATUS_UPDATE",
      targetType: "AdminUser",
      targetId: manager.id,
      summary: `${manager.name ?? manager.loginId} 계정을 ${status} 상태로 변경했습니다.`
    });
    response.json({ manager: adminUserSummary(manager) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/managers/:id/password", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    const password = typeof request.body.password === "string" ? request.body.password : "";
    if (password.length < 6) {
      response.status(400).json({ message: "Password must be at least 6 characters." });
      return;
    }

    const manager = await prisma.adminUser.update({
      where: {
        id: String(request.params.id)
      },
      data: {
        passwordHash: await bcrypt.hash(password, 12)
      }
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "ADMIN_PASSWORD_RESET",
      targetType: "AdminUser",
      targetId: manager.id,
      summary: `${manager.name ?? manager.loginId} 계정의 비밀번호를 초기화했습니다.`
    });
    response.json({ manager: adminUserSummary(manager) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users/search", requireAdmin, async (request, response, next) => {
  try {
    const q = stringField(request.query.q);
    if (!q) {
      response.json({ users: [] });
      return;
    }

    const users = await prisma.adminUser.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          {
            name: {
              contains: q,
              mode: "insensitive"
            }
          },
          {
            loginId: {
              contains: q,
              mode: "insensitive"
            }
          }
        ]
      },
      orderBy: {
        name: "asc"
      },
      take: 10
    });

    response.json({ users: users.map(adminUserSummary) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/games", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (!request.admin) return;
    const games = await listAdminGames(request.admin);
    response.json({ games });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/games/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (!request.admin) return;
    const game = await getAdminGameById(String(request.params.id), request.admin);

    if (!game) {
      response.status(404).json({ message: "Game not found." });
      return;
    }

    response.json({ game });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/games/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (!request.admin) return;
    const gameId = String(request.params.id);
    const canManage = await userCanManageGame(request.admin, gameId);
    if (!canManage) {
      response.status(403).json({ message: "You cannot manage this game." });
      return;
    }

    const title = stringField(request.body.title);
    const shortDescription = stringField(request.body.shortDescription);

    if (!title || !shortDescription) {
      response.status(400).json({ message: "Title and short description are required." });
      return;
    }

    const previousGame = await getAdminGameById(gameId, request.admin);
    if (!previousGame) {
      response.status(404).json({ message: "Game not found." });
      return;
    }

    const requestedStatus = statusField(request.body.status);
    const status = request.admin.role === "SUPER_ADMIN" ? requestedStatus : previousGame.status;
    const rawCreatorIds = Array.isArray(request.body.creatorIds) ? request.body.creatorIds.map(String) : undefined;
    const creatorIds =
      request.admin.role === "SUPER_ADMIN"
        ? rawCreatorIds
        : [...new Set([request.admin.id, ...(rawCreatorIds ?? previousGame.creators.map((creator) => creator.id))])];

    const game = await updateAdminGame(gameId, {
      title,
      slug: previousGame.slug,
      year: optionalNumberField(request.body.year),
      developer: stringField(request.body.developer) || null,
      difficulty: difficultyField(request.body.difficulty),
      shortDescription,
      description: stringField(request.body.description) || null,
      status,
      creatorIds
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "GAME_UPDATE",
      targetType: "Game",
      targetId: game.id,
      summary: `${game.title} 게임 정보를 수정했습니다.`
    });

    response.json({ game });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/games/:id/archive", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (request.admin?.role !== "SUPER_ADMIN") {
      response.status(403).json({ message: "Only super admins can archive games." });
      return;
    }

    const game = await archiveAdminGame(String(request.params.id));
    await recordAdminAuditLog({
      admin: request.admin,
      action: "GAME_ARCHIVE",
      targetType: "Game",
      targetId: game.id,
      summary: `${game.title} 게임을 보관 처리했습니다.`
    });
    response.json({ game });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/games/:id/comments", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (!request.admin) return;
    const gameId = String(request.params.id);
    const canManage = await userCanManageGame(request.admin, gameId);
    if (!canManage) {
      response.status(403).json({ message: "You cannot manage this game's comments." });
      return;
    }

    const comments = await listAdminCommentsByGameId(gameId);
    response.json({ comments });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/comments/:commentId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (!request.admin) return;
    const comment = await prisma.comment.findUnique({
      where: {
        id: String(request.params.commentId)
      }
    });

    if (!comment) {
      response.status(404).json({ message: "Comment not found." });
      return;
    }

    const canManage = await userCanManageGame(request.admin, comment.gameId);
    if (!canManage) {
      response.status(403).json({ message: "You cannot delete this comment." });
      return;
    }

    await deleteCommentAsAdmin(comment.id);
    await recordAdminAuditLog({
      admin: request.admin,
      action: "COMMENT_DELETE",
      targetType: "Comment",
      targetId: comment.id,
      summary: "관리자 권한으로 댓글을 삭제했습니다.",
      metadata: {
        gameId: comment.gameId
      }
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
