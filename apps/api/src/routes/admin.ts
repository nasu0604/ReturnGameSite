import bcrypt from "bcryptjs";
import { Router } from "express";
import type { LoginResponse, ManagerInviteRecord } from "@return-game/shared";
import { requireAdmin, requireSuperAdmin, type AdminRequest } from "../middleware/requireAdmin.js";
import { createAdminToken, ensureConfiguredSuperAdmin, toAdminSession } from "../services/auth.js";
import { prisma } from "../services/db.js";
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

function inviteRecord(invite: {
  id: string;
  name: string;
  claimedByAdminUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  claimedBy?: Parameters<typeof adminUserSummary>[0] | null;
}): ManagerInviteRecord {
  return {
    id: invite.id,
    name: invite.name,
    claimedByAdminUserId: invite.claimedByAdminUserId ?? undefined,
    claimedBy: invite.claimedBy ? adminUserSummary(invite.claimedBy) : undefined,
    createdAt: invite.createdAt.toISOString(),
    updatedAt: invite.updatedAt.toISOString()
  };
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
    const password = typeof request.body.password === "string" ? request.body.password : "";
    const passwordConfirm = typeof request.body.passwordConfirm === "string" ? request.body.passwordConfirm : "";

    if (!name || !loginId || password.length < 6 || password !== passwordConfirm) {
      response.status(400).json({ message: "Name, login ID, and matching password are required." });
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

    const invite = await prisma.managerInvite.findUnique({
      where: {
        name
      }
    });
    if (!invite || invite.claimedByAdminUserId) {
      response.status(403).json({ message: "This name is not allowed or already claimed." });
      return;
    }

    const admin = await prisma.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: {
          name,
          displayName: name,
          loginId,
          passwordHash: await bcrypt.hash(password, 12),
          role: "MANAGER",
          status: "ACTIVE"
        }
      });
      await tx.managerInvite.update({
        where: {
          id: invite.id
        },
        data: {
          claimedByAdminUserId: created.id
        }
      });

      return created;
    });

    const session = toAdminSession(admin);
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

    response.json({ ok: true });
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

adminRouter.get("/manager-invites", requireSuperAdmin, async (_request, response, next) => {
  try {
    const invites = await prisma.managerInvite.findMany({
      include: {
        claimedBy: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    response.json({ invites: invites.map(inviteRecord) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/manager-invites", requireSuperAdmin, async (request, response, next) => {
  try {
    const name = nameField(request.body.name);
    if (!name) {
      response.status(400).json({ message: "Name is required." });
      return;
    }

    const existingInvite = await prisma.managerInvite.findUnique({
      where: {
        name
      },
      include: {
        claimedBy: true
      }
    });

    if (existingInvite) {
      response.status(200).json({
        invite: inviteRecord(existingInvite),
        alreadyExists: true,
        message: "이미 등록된 이름입니다."
      });
      return;
    }

    const invite = await prisma.managerInvite.create({
      data: {
        name
      },
      include: {
        claimedBy: true
      }
    });
    response.status(201).json({ invite: inviteRecord(invite) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/managers/:id/status", requireSuperAdmin, async (request, response, next) => {
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
    response.json({ manager: adminUserSummary(manager) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/managers/:id/password", requireSuperAdmin, async (request, response, next) => {
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
    const slug = stringField(request.body.slug);
    const shortDescription = stringField(request.body.shortDescription);

    if (!title || !slug || !shortDescription) {
      response.status(400).json({ message: "Title, slug, and short description are required." });
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
      slug,
      year: optionalNumberField(request.body.year),
      developer: stringField(request.body.developer) || null,
      difficulty: difficultyField(request.body.difficulty),
      shortDescription,
      description: stringField(request.body.description) || null,
      status,
      creatorIds
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
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
