import jwt from "jsonwebtoken";
import type { AdminSession } from "@return-game/shared";

interface AdminTokenPayload {
  email: string;
  displayName: string;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === "replace-with-a-long-random-secret") {
    throw new Error("JWT_SECRET must be configured before using admin auth.");
  }

  return secret;
}

export function getConfiguredAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password === "change-me") {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured.");
  }

  return {
    email,
    password,
    displayName: "Administrator"
  };
}

export function createAdminToken(admin: AdminSession) {
  return jwt.sign(admin, getJwtSecret(), {
    expiresIn: "8h"
  });
}

export function verifyAdminToken(token: string): AdminSession {
  const payload = jwt.verify(token, getJwtSecret()) as AdminTokenPayload;

  if (!payload.email || !payload.displayName) {
    throw new Error("Invalid admin token.");
  }

  return {
    email: payload.email,
    displayName: payload.displayName
  };
}
