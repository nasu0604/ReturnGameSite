import type { NextFunction, Request, Response } from "express";
import type { AdminSession } from "@return-game/shared";
import { verifyAdminToken } from "../services/auth.js";

export interface AdminRequest extends Request {
  admin?: AdminSession;
}

export function requireAdmin(request: AdminRequest, response: Response, next: NextFunction) {
  const header = request.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    response.status(401).json({ message: "Missing admin token." });
    return;
  }

  try {
    request.admin = verifyAdminToken(token);
    next();
  } catch {
    response.status(401).json({ message: "Invalid or expired admin token." });
  }
}

export function requireSuperAdmin(request: AdminRequest, response: Response, next: NextFunction) {
  requireAdmin(request, response, () => {
    if (request.admin?.role !== "SUPER_ADMIN") {
      response.status(403).json({ message: "Super admin access is required." });
      return;
    }

    next();
  });
}
