import { Router } from "express";
import type { LoginResponse } from "@return-game/shared";
import { requireAdmin, type AdminRequest } from "../middleware/requireAdmin.js";
import { createAdminToken, getConfiguredAdmin } from "../services/auth.js";

export const adminRouter = Router();

adminRouter.post("/login", (request, response) => {
  const { email, password } = request.body as { email?: string; password?: string };
  const admin = getConfiguredAdmin();

  if (email !== admin.email || password !== admin.password) {
    response.status(401).json({ message: "Invalid admin credentials." });
    return;
  }

  const session = {
    email: admin.email,
    displayName: admin.displayName
  };
  const payload: LoginResponse = {
    token: createAdminToken(session),
    admin: session
  };

  response.json(payload);
});

adminRouter.get("/me", requireAdmin, (request: AdminRequest, response) => {
  response.json({ admin: request.admin });
});
