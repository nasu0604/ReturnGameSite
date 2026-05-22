import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AdminSession } from "@return-game/shared";
import { prisma } from "./db.js";

interface AdminTokenPayload {
  id: string;
  name: string;
  loginId: string;
  role: "SUPER_ADMIN" | "MANAGER";
  status: "ACTIVE" | "DISABLED";
  email?: string;
  displayName: string;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === "replace-with-a-long-random-secret") {
    throw new Error("JWT_SECRET must be configured before using admin auth.");
  }

  return secret;
}

function configuredSuperAdmin() {
  const loginId = process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "총 관리자";

  if (!loginId || !password || password === "change-me") {
    throw new Error("ADMIN_EMAIL or ADMIN_USERNAME and ADMIN_PASSWORD must be configured.");
  }

  return {
    loginId,
    email: process.env.ADMIN_EMAIL,
    password,
    name
  };
}

export function toAdminSession(admin: {
  id: string;
  email: string | null;
  loginId: string | null;
  name: string | null;
  displayName: string | null;
  role: "SUPER_ADMIN" | "MANAGER";
  status: "ACTIVE" | "DISABLED";
}): AdminSession {
  const loginId = admin.loginId ?? admin.email ?? "";
  const name = admin.name ?? admin.displayName ?? loginId;

  return {
    id: admin.id,
    email: admin.email ?? undefined,
    loginId,
    name,
    role: admin.role,
    status: admin.status,
    displayName: admin.displayName ?? name
  };
}

export async function ensureConfiguredSuperAdmin() {
  const configured = configuredSuperAdmin();
  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [{ loginId: configured.loginId }, { email: configured.email ?? configured.loginId }]
    }
  });

  if (existing) {
    return prisma.adminUser.update({
      where: {
        id: existing.id
      },
      data: {
        loginId: existing.loginId ?? configured.loginId,
        email: existing.email ?? configured.email,
        name: existing.name ?? configured.name,
        displayName: existing.displayName ?? configured.name,
        role: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    });
  }

  return prisma.adminUser.create({
    data: {
      loginId: configured.loginId,
      email: configured.email,
      name: configured.name,
      displayName: configured.name,
      passwordHash: await bcrypt.hash(configured.password, 12),
      role: "SUPER_ADMIN",
      status: "ACTIVE"
    }
  });
}

export function createAdminToken(admin: AdminSession) {
  return jwt.sign(admin, getJwtSecret(), {
    expiresIn: "8h"
  });
}

export function verifyAdminToken(token: string): AdminSession {
  const payload = jwt.verify(token, getJwtSecret()) as AdminTokenPayload;

  if (!payload.id || !payload.loginId || !payload.role || payload.status !== "ACTIVE") {
    throw new Error("Invalid admin token.");
  }

  return {
    id: payload.id,
    email: payload.email,
    loginId: payload.loginId,
    name: payload.name,
    role: payload.role,
    status: payload.status,
    displayName: payload.displayName
  };
}
