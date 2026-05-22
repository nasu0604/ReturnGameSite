import bcrypt from "bcryptjs";
import { Router } from "express";
import type { LoginResponse } from "@return-game/shared";
import { requireAdmin, requireSuperAdmin, type AdminRequest } from "../middleware/requireAdmin.js";
import { createAdminToken, ensureConfiguredSuperAdmin, toAdminSession } from "../services/auth.js";
import { prisma } from "../services/db.js";
import { listAdminAuditLogs, recordAdminAuditLog } from "../services/adminAuditLog.js";
import {
  createHistory,
  deleteHistory,
  getAdminHistoryById,
  listAdminHistory,
  updateHistory
} from "../services/historyRepository.js";
import {
  adminUserSummary,
  deleteAdminGame,
  getAdminGameById,
  listAdminGames,
  registerCurrentAdminAsGameCreator,
  updateAdminGame,
  userCanManageGame
} from "../services/gameRepository.js";
import { deleteS3Prefix } from "../services/s3Publisher.js";
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
  if (status !== "PUBLIC" && status !== "HIDDEN") {
    throw new Error("寃뚯엫 寃뚯떆 ?곹깭媛 ?щ컮瑜댁? ?딆뒿?덈떎.");
  }

  return status;
}

function eventDateField(value: unknown) {
  const raw = stringField(value);
  const date = raw ? new Date(`${raw}T00:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error("?щ컮瑜??좎쭨瑜??좏깮?댁＜?몄슂.");
  }

  return date;
}

function creatorNamesField(value: unknown) {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return rawValues
    .map(String)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 20)
    .map((item) => item.slice(0, 60));
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
      summary: `${session.name} 愿由ъ옄媛 媛?낇뻽?듬땲??`
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
      summary: `${request.admin.name} 愿由ъ옄媛 ?먭린 鍮꾨?踰덊샇瑜?蹂寃쏀뻽?듬땲??`
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/audit-logs", requireSuperAdmin, async (request, response, next) => {
  try {
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    const adminUserId = stringField(request.query.adminUserId);
    const action = stringField(request.query.action);
    const q = stringField(request.query.q);
    const payload = await listAdminAuditLogs({
      adminUserId: adminUserId || undefined,
      action: action || undefined,
      q: q || undefined,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20
    });
    response.json(payload);
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

adminRouter.get("/managers/:id/games", requireSuperAdmin, async (request, response, next) => {
  try {
    const managerId = String(request.params.id);
    const manager = await prisma.adminUser.findUnique({
      where: {
        id: managerId
      },
      select: {
        id: true
      }
    });

    if (!manager) {
      response.status(404).json({ message: "愿由ъ옄瑜?李얠쓣 ???놁뒿?덈떎." });
      return;
    }

    const links = await prisma.gameCreator.findMany({
      where: {
        adminUserId: managerId
      },
      include: {
        game: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    response.json({
      games: links.map((link) => ({
        id: link.game.id,
        slug: link.game.slug,
        title: link.game.title,
        year: link.game.year ?? undefined,
        creatorNames: Array.isArray(link.game.creatorNames) ? link.game.creatorNames : undefined,
        registeredAt: link.createdAt.toISOString()
      }))
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/managers/:id/games/:gameId", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    const managerId = String(request.params.id);
    const gameId = String(request.params.gameId);
    const [manager, game] = await Promise.all([
      prisma.adminUser.findUnique({
        where: {
          id: managerId
        }
      }),
      prisma.game.findUnique({
        where: {
          id: gameId
        }
      })
    ]);

    if (!manager || !game) {
      response.status(404).json({ message: "愿由ъ옄 ?먮뒗 寃뚯엫??李얠쓣 ???놁뒿?덈떎." });
      return;
    }

    await prisma.gameCreator.delete({
      where: {
        gameId_adminUserId: {
          gameId,
          adminUserId: managerId
        }
      }
    });

    const managerName = manager.name ?? manager.loginId ?? "愿由ъ옄";
    await recordAdminAuditLog({
      admin: request.admin,
      action: "GAME_CREATOR_REGISTRATION_DELETE",
      targetType: "GameCreator",
      targetId: gameId,
      summary: `${managerName} 愿由ъ옄??${game.title} 寃뚯엫 ?쒖옉???깅줉????젣?덉뒿?덈떎.`,
      metadata: {
        managerId,
        gameId
      }
    });

    response.status(204).send();
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
      summary: "?몃? 愿由ъ옄 ?뚯썝媛??蹂댁븞肄붾뱶瑜?蹂寃쏀뻽?듬땲??"
    });
    response.json({
      configured: true,
      updatedAt: signupCode.updatedAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/history", requireSuperAdmin, async (_request, response, next) => {
  try {
    const history = await listAdminHistory();
    response.json({ history });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/history", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    const eventDate = eventDateField(request.body.eventDate ?? request.body.dateLabel);
    const title = stringField(request.body.title);
    const summary = stringField(request.body.summary);

    if (!title || !summary) {
      response.status(400).json({ message: "날짜, 제목, 한줄 설명을 입력해주세요." });
      return;
    }

    const history = await createHistory({
      eventDate,
      title,
      summary
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "HISTORY_CREATE",
      targetType: "ClubHistory",
      targetId: history.id,
      summary: `${history.title} ?고쁺??異붽??덉뒿?덈떎.`
    });
    response.status(201).json({ history });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/history/:id", requireSuperAdmin, async (request, response, next) => {
  try {
    const history = await getAdminHistoryById(String(request.params.id));
    if (!history) {
      response.status(404).json({ message: "History item not found." });
      return;
    }

    response.json({ history });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/history/:id", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    const eventDate = eventDateField(request.body.eventDate ?? request.body.dateLabel);
    const title = stringField(request.body.title);
    const summary = stringField(request.body.summary);

    if (!title || !summary) {
      response.status(400).json({ message: "날짜, 제목, 한줄 설명을 입력해주세요." });
      return;
    }

    const history = await updateHistory(String(request.params.id), {
      eventDate,
      title,
      summary
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "HISTORY_UPDATE",
      targetType: "ClubHistory",
      targetId: history.id,
      summary: `${history.title} ?고쁺???섏젙?덉뒿?덈떎.`
    });
    response.json({ history });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/history/:id", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    const history = await deleteHistory(String(request.params.id));
    await recordAdminAuditLog({
      admin: request.admin,
      action: "HISTORY_DELETE",
      targetType: "ClubHistory",
      targetId: history.id,
      summary: `${history.title} ?고쁺????젣?덉뒿?덈떎.`
    });
    response.status(204).send();
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
      summary: `${manager.name ?? manager.loginId} 怨꾩젙??${status} ?곹깭濡?蹂寃쏀뻽?듬땲??`
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
      summary: `${manager.name ?? manager.loginId} 怨꾩젙??鍮꾨?踰덊샇瑜?珥덇린?뷀뻽?듬땲??`
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
    const game = await updateAdminGame(gameId, request.admin, {
      title,
      year: optionalNumberField(request.body.year),
      developer: creatorNamesField(request.body.creatorNames).join(", ") || null,
      difficulty: difficultyField(request.body.difficulty),
      shortDescription,
      description: stringField(request.body.description) || null,
      copyrightNotice: stringField(request.body.copyrightNotice) || null,
      status,
      creatorNames: creatorNamesField(request.body.creatorNames)
    });
    await recordAdminAuditLog({
      admin: request.admin,
      action: "GAME_UPDATE",
      targetType: "Game",
      targetId: game.id,
      summary: `${game.title} 寃뚯엫 ?뺣낫瑜??섏젙?덉뒿?덈떎.`
    });

    response.json({ game });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/games/:id/register-creator", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (!request.admin) return;
    const gameId = String(request.params.id);
    const existingGame = await prisma.game.findUnique({
      where: {
        id: gameId
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!existingGame) {
      response.status(404).json({ message: "Game not found." });
      return;
    }

    const game = await registerCurrentAdminAsGameCreator(gameId, request.admin);
    await recordAdminAuditLog({
      admin: request.admin,
      action: "GAME_CREATOR_SELF_REGISTER",
      targetType: "Game",
      targetId: game.id,
      summary: `${request.admin.name} 愿由ъ옄媛 ${game.title} 寃뚯엫 ?쒖옉?먮줈 ?깅줉?덉뒿?덈떎.`
    });

    response.status(201).json({ game });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/games/:id", requireSuperAdmin, async (request: AdminRequest, response, next) => {
  try {
    if (!request.admin) return;

    const existingGame = await getAdminGameById(String(request.params.id), request.admin);
    if (!existingGame) {
      response.status(404).json({ message: "Game not found." });
      return;
    }

    const confirm = stringField(request.body?.confirm);
    if (confirm !== existingGame.slug && confirm !== existingGame.title) {
      response.status(400).json({ message: "??젣?섎젮硫?寃뚯엫 ?쒕ぉ ?먮뒗 slug瑜??뺥솗???낅젰?댁＜?몄슂." });
      return;
    }

    const game = await deleteAdminGame(String(request.params.id));
    if (!game) {
      response.status(404).json({ message: "Game not found." });
      return;
    }

    for (const prefix of game.s3Prefixes) {
      try {
        await deleteS3Prefix(prefix);
      } catch (error) {
        console.warn(`[s3] failed to delete ${prefix}`, error);
      }
    }
    await recordAdminAuditLog({
      admin: request.admin,
      action: "GAME_DELETE",
      targetType: "Game",
      targetId: game.id,
      summary: `${game.title} 寃뚯엫???꾩쟾??젣?덉뒿?덈떎.`
    });
    response.status(204).send();
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
      summary: "愿由ъ옄 沅뚰븳?쇰줈 ?볤?????젣?덉뒿?덈떎.",
      metadata: {
        gameId: comment.gameId
      }
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
