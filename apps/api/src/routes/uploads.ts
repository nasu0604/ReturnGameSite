import { Router } from "express";
import fs from "node:fs";
import multer from "multer";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { upsertGame } from "../services/catalog.js";
import { storagePaths } from "../services/localStorage.js";
import { processWebglZip } from "../services/webglArchive.js";

export const uploadsRouter = Router();

const upload = multer({
  dest: storagePaths.tempDir,
  limits: {
    fileSize: 1024 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".zip")) {
      callback(new Error("Only .zip files are accepted."));
      return;
    }

    callback(null, true);
  }
});

uploadsRouter.post("/webgl-zip", requireAdmin, upload.single("file"), (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ message: "Missing zip file." });
      return;
    }

    const game = processWebglZip({
      zipPath: request.file.path,
      originalName: request.file.originalname,
      title: typeof request.body.title === "string" ? request.body.title : undefined,
      slug: typeof request.body.slug === "string" ? request.body.slug : undefined,
      shortDescription:
        typeof request.body.shortDescription === "string" ? request.body.shortDescription : undefined
    });

    upsertGame(game);
    response.status(201).json({ game });
  } catch (error) {
    next(error);
  } finally {
    if (request.file?.path) {
      fs.rmSync(request.file.path, { force: true });
    }
  }
});
