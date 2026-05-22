import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { requireAdmin, requireSuperAdmin, type AdminRequest } from "../middleware/requireAdmin.js";
import {
  addGameVersionToExistingGame,
  getAdminGameById,
  getPublishedGameById,
  updateAdminGameThumbnail,
  upsertPublishedGame,
  userCanManageGame
} from "../services/gameRepository.js";
import { storagePaths } from "../services/localStorage.js";
import { prisma } from "../services/db.js";
import { recordAdminAuditLog } from "../services/adminAuditLog.js";
import {
  publishGameThumbnail,
  publishHistoryImage,
  publishWebglDirectory,
  type WebglPublishProgress
} from "../services/s3Publisher.js";
import { processWebglZip } from "../services/webglArchive.js";

export const uploadsRouter = Router();

const upload = multer({
  dest: storagePaths.tempDir,
  limits: {
    fileSize: 1024 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname === "file" && !file.originalname.toLowerCase().endsWith(".zip")) {
      callback(new Error("Only .zip files are accepted."));
      return;
    }

    if ((file.fieldname === "thumbnail" || file.fieldname === "image") && !file.mimetype.startsWith("image/")) {
      callback(new Error("Only image files are accepted."));
      return;
    }

    callback(null, true);
  }
});

function resolvePublishedThumbnailUrl(localThumbnailUrl: string, slug: string, assetBaseUrl: string) {
  const localPrefix = `/local-games/${encodeURIComponent(slug)}/`;

  if (!localThumbnailUrl.startsWith(localPrefix)) return "";

  const relativeThumbnailPath = localThumbnailUrl.slice(localPrefix.length);
  const encodedRelativePath = relativeThumbnailPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${assetBaseUrl}/${encodedRelativePath}`;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumberField(value: unknown) {
  const raw = stringField(value);
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function difficultyField(value: unknown) {
  const parsed = optionalNumberField(value);
  if (parsed === undefined) return undefined;

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("Difficulty must be an integer between 1 and 5.");
  }

  return parsed;
}

function uploadProgressPayload(progress: unknown) {
  if (!progress || typeof progress !== "object") return undefined;
  const payload = progress as Partial<WebglPublishProgress>;

  return {
    totalFiles: Number(payload.totalFiles ?? 0),
    uploadedFiles: Number(payload.uploadedFiles ?? 0),
    totalBytes: Number(payload.totalBytes ?? 0),
    uploadedBytes: Number(payload.uploadedBytes ?? 0),
    percent: Number(payload.percent ?? 0),
    currentFile: typeof payload.currentFile === "string" ? payload.currentFile : undefined
  };
}

function progressJson(progress: WebglPublishProgress) {
  return {
    totalFiles: progress.totalFiles,
    uploadedFiles: progress.uploadedFiles,
    totalBytes: progress.totalBytes,
    uploadedBytes: progress.uploadedBytes,
    percent: progress.percent,
    ...(progress.currentFile ? { currentFile: progress.currentFile } : {})
  };
}

function uploadResponse(uploadRecord: {
  id: string;
  originalName: string;
  status: "RECEIVED" | "VALIDATING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorMessage: string | null;
  progress: unknown;
}) {
  return {
    id: uploadRecord.id,
    originalName: uploadRecord.originalName,
    status: uploadRecord.status,
    errorMessage: uploadRecord.errorMessage ?? undefined,
    progress: uploadProgressPayload(uploadRecord.progress)
  };
}

function createProgressWriter(uploadId: string) {
  let lastWriteAt = 0;
  let pending: WebglPublishProgress | null = null;
  let writeInFlight = false;

  async function write(progress: WebglPublishProgress, force = false) {
    pending = progress;
    const now = Date.now();
    if (!force && (writeInFlight || now - lastWriteAt < 1000)) return;

    writeInFlight = true;
    lastWriteAt = now;
    const payload = pending;
    pending = null;

    if (payload) {
      await prisma.upload.update({
        where: {
          id: uploadId
        },
        data: {
          progress: progressJson(payload)
        }
      });
    }

    writeInFlight = false;
  }

  return {
    update: (progress: WebglPublishProgress) => write(progress),
    flush: async () => {
      if (pending) {
        await write(pending, true);
      }
    }
  };
}

async function publishGameInBackground(input: {
  uploadId: string;
  game: ReturnType<typeof processWebglZip>;
  gameDirectory: string;
  versionLabel: string;
  creatorIds: string[];
  creatorNames?: string[];
  thumbnailFilePath?: string;
  thumbnailMimeType?: string;
  admin?: AdminRequest["admin"];
}) {
  try {
    const progressWriter = createProgressWriter(input.uploadId);
    const published = await publishWebglDirectory({
      directory: input.gameDirectory,
      slug: input.game.slug,
      versionLabel: input.versionLabel,
      onProgress: progressWriter.update
    });
    await progressWriter.flush();

    const thumbnailUrl = input.thumbnailFilePath
      ? await publishGameThumbnail({
          body: fs.readFileSync(input.thumbnailFilePath),
          slug: input.game.slug,
          contentType: input.thumbnailMimeType ?? "image/jpeg"
        })
      : input.game.thumbnailUrl
        ? resolvePublishedThumbnailUrl(input.game.thumbnailUrl, input.game.slug, published.assetBaseUrl)
        : "";

    const savedGame = await upsertPublishedGame({
      slug: input.game.slug,
      title: input.game.title,
      year: input.game.year,
      developer: input.game.developer,
      difficulty: input.game.difficulty,
      shortDescription: input.game.shortDescription,
      description: input.game.description,
      copyrightNotice: input.game.copyrightNotice,
      thumbnailUrl,
      versionLabel: input.versionLabel,
      entryUrl: published.entryUrl,
      assetBaseUrl: published.assetBaseUrl,
      s3Prefix: published.s3Prefix,
      manifest: {
        buildFiles: input.game.buildFiles
      },
      creatorIds: input.creatorIds,
      creatorNames: input.creatorNames
    });

    await prisma.upload.update({
      where: {
        id: input.uploadId
      },
      data: {
        gameId: savedGame.id,
        resultPrefix: published.s3Prefix,
        status: "COMPLETED"
      }
    });
    await recordAdminAuditLog({
      admin: input.admin,
      action: "GAME_UPLOAD",
      targetType: "Game",
      targetId: savedGame.id,
      summary: `${savedGame.title} 게임을 업로드했습니다.`,
      metadata: {
        uploadId: input.uploadId,
        s3Prefix: published.s3Prefix
      }
    });
  } catch (error) {
    await prisma.upload.update({
      where: {
        id: input.uploadId
      },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unexpected upload failure"
      }
    });
  } finally {
    if (input.thumbnailFilePath) {
      fs.rmSync(input.thumbnailFilePath, { force: true });
    }
  }
}

async function publishGameVersionUpdateInBackground(input: {
  uploadId: string;
  gameId: string;
  slug: string;
  title: string;
  gameDirectory: string;
  buildFiles: ReturnType<typeof processWebglZip>["buildFiles"];
  versionLabel: string;
  admin?: AdminRequest["admin"];
}) {
  try {
    const progressWriter = createProgressWriter(input.uploadId);
    const published = await publishWebglDirectory({
      directory: input.gameDirectory,
      slug: input.slug,
      versionLabel: input.versionLabel,
      onProgress: progressWriter.update
    });
    await progressWriter.flush();

    const game = await addGameVersionToExistingGame(input.gameId, {
      versionLabel: input.versionLabel,
      entryUrl: published.entryUrl,
      assetBaseUrl: published.assetBaseUrl,
      s3Prefix: published.s3Prefix,
      manifest: {
        buildFiles: input.buildFiles
      }
    });

    await prisma.upload.update({
      where: {
        id: input.uploadId
      },
      data: {
        gameId: input.gameId,
        resultPrefix: published.s3Prefix,
        status: "COMPLETED"
      }
    });
    await recordAdminAuditLog({
      admin: input.admin,
      action: "GAME_VERSION_UPDATE",
      targetType: "Game",
      targetId: input.gameId,
      summary: `${input.title} 게임 실행 파일을 새 버전으로 교체했습니다.`,
      metadata: {
        uploadId: input.uploadId,
        s3Prefix: published.s3Prefix,
        currentVersion: game.currentVersion
      }
    });
  } catch (error) {
    await prisma.upload.update({
      where: {
        id: input.uploadId
      },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unexpected upload failure"
      }
    });
  }
}

uploadsRouter.get("/:id", requireAdmin, async (request, response, next) => {
  try {
    const uploadId = String(request.params.id);
    const uploadRecord = await prisma.upload.findUnique({
      where: {
        id: uploadId
      }
    });

    if (!uploadRecord) {
      response.status(404).json({ message: "Upload not found." });
      return;
    }

    const game = uploadRecord.gameId ? await getPublishedGameById(uploadRecord.gameId) : null;

    response.json({
      upload: uploadResponse(uploadRecord),
      game
    });
  } catch (error) {
    next(error);
  }
});

uploadsRouter.post(
  "/history-image",
  requireSuperAdmin,
  upload.single("image"),
  async (request: AdminRequest, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ message: "업로드할 이미지를 선택해주세요." });
        return;
      }

      const imageUrl = await publishHistoryImage({
        body: fs.readFileSync(request.file.path),
        fileName: request.file.originalname,
        contentType: request.file.mimetype
      });

      response.status(201).json({ imageUrl });
    } catch (error) {
      next(error);
    } finally {
      if (request.file?.path) {
        fs.rmSync(request.file.path, { force: true });
      }
    }
  }
);

function creatorIdsField(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const raw = stringField(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Fall through to comma-separated parsing.
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function creatorNamesField(value: unknown) {
  const raw = stringField(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

uploadsRouter.patch(
  "/games/:id/thumbnail",
  requireAdmin,
  upload.single("thumbnail"),
  async (request: AdminRequest, response, next) => {
    try {
      if (!request.admin) return;
      if (!request.file) {
        response.status(400).json({ message: "Missing thumbnail image." });
        return;
      }

      const gameId = String(request.params.id);
      const canManage = await userCanManageGame(request.admin, gameId);
      if (!canManage) {
        response.status(403).json({ message: "You cannot manage this game." });
        return;
      }

      const game = await prisma.game.findUnique({
        where: {
          id: gameId
        },
        select: {
          slug: true
        }
      });

      if (!game) {
        response.status(404).json({ message: "Game not found." });
        return;
      }

      const thumbnailUrl = await publishGameThumbnail({
        body: fs.readFileSync(request.file.path),
        slug: game.slug,
        contentType: request.file.mimetype === "image/png" ? "image/png" : "image/jpeg"
      });
      const updatedGame = await updateAdminGameThumbnail(gameId, thumbnailUrl);
      await recordAdminAuditLog({
        admin: request.admin,
        action: "THUMBNAIL_UPDATE",
        targetType: "Game",
        targetId: updatedGame.id,
        summary: `${updatedGame.title} 게임 썸네일을 변경했습니다.`
      });

      response.json({ game: updatedGame });
    } catch (error) {
      next(error);
    } finally {
      if (request.file?.path) {
        fs.rmSync(request.file.path, { force: true });
      }
    }
  }
);

uploadsRouter.post(
  "/games/:id/webgl-zip",
  requireAdmin,
  upload.single("file"),
  async (request: AdminRequest, response, next) => {
    let uploadId: string | null = null;

    try {
      if (!request.admin) return;
      if (!request.file) {
        response.status(400).json({ message: "Missing zip file." });
        return;
      }

      const gameId = String(request.params.id);
      const canManage = await userCanManageGame(request.admin, gameId);
      if (!canManage) {
        response.status(403).json({ message: "You cannot manage this game." });
        return;
      }

      const existingGame = await getAdminGameById(gameId, request.admin);
      if (!existingGame) {
        response.status(404).json({ message: "Game not found." });
        return;
      }

      const uploadRecord = await prisma.upload.create({
        data: {
          gameId,
          originalName: request.file.originalname,
          status: "RECEIVED",
          progress: {
            totalFiles: 0,
            uploadedFiles: 0,
            totalBytes: 0,
            uploadedBytes: 0,
            percent: 0
          }
        }
      });
      uploadId = uploadRecord.id;

      await prisma.upload.update({
        where: {
          id: uploadId
        },
        data: {
          status: "VALIDATING"
        }
      });

      const processedGame = processWebglZip({
        zipPath: request.file.path,
        originalName: request.file.originalname,
        title: existingGame.title,
        slug: existingGame.slug,
        year: existingGame.year,
        developer: existingGame.developer,
        difficulty: existingGame.difficulty,
        shortDescription: existingGame.shortDescription,
        description: existingGame.description
      });
      const versionLabel = new Date().toISOString().replace(/[:.]/g, "-");
      const gameDirectory = path.join(storagePaths.gamesDir, existingGame.slug);

      await prisma.upload.update({
        where: {
          id: uploadId
        },
        data: {
          status: "PROCESSING"
        }
      });

      void publishGameVersionUpdateInBackground({
        uploadId,
        gameId,
        slug: existingGame.slug,
        title: existingGame.title,
        gameDirectory,
        buildFiles: processedGame.buildFiles,
        versionLabel,
        admin: request.admin
      });

      response.status(202).json({
        upload: uploadResponse({
          id: uploadId,
          originalName: request.file.originalname,
          status: "PROCESSING",
          errorMessage: null,
          progress: {
            totalFiles: 0,
            uploadedFiles: 0,
            totalBytes: 0,
            uploadedBytes: 0,
            percent: 0
          }
        })
      });
    } catch (error) {
      if (uploadId) {
        try {
          await prisma.upload.update({
            where: {
              id: uploadId
            },
            data: {
              status: "FAILED",
              errorMessage: error instanceof Error ? error.message : "Unexpected upload failure"
            }
          });
        } catch {
          // Preserve the original upload error for the API response.
        }
      }

      next(error);
    } finally {
      if (request.file?.path) {
        fs.rmSync(request.file.path, { force: true });
      }
    }
  }
);

uploadsRouter.post("/webgl-zip", requireAdmin, upload.fields([{ name: "file", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }]), async (request: AdminRequest, response, next) => {
  let uploadId: string | null = null;
  let thumbnailQueuedForBackgroundUpload = false;

  try {
    const files = request.files as { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;
    const zipFile = files?.file?.[0];
    const thumbnailFile = files?.thumbnail?.[0];

    if (!zipFile) {
      response.status(400).json({ message: "Missing zip file." });
      return;
    }

    const uploadRecord = await prisma.upload.create({
      data: {
        originalName: zipFile.originalname,
        status: "RECEIVED",
        progress: {
          totalFiles: 0,
          uploadedFiles: 0,
          totalBytes: 0,
          uploadedBytes: 0,
          percent: 0
        }
      }
    });
    uploadId = uploadRecord.id;

    await prisma.upload.update({
      where: {
        id: uploadId
      },
      data: {
        status: "VALIDATING"
      }
    });

    const game = processWebglZip({
      zipPath: zipFile.path,
      originalName: zipFile.originalname,
      title: stringField(request.body.title) || undefined,
      slug: stringField(request.body.slug) || undefined,
      year: optionalNumberField(request.body.year),
      developer: stringField(request.body.developer) || undefined,
      difficulty: difficultyField(request.body.difficulty),
      shortDescription: stringField(request.body.shortDescription) || undefined,
      description: stringField(request.body.description) || undefined,
      copyrightNotice: stringField(request.body.copyrightNotice) || undefined
    });

    const slugExists = await prisma.game.findUnique({
      where: {
        slug: game.slug
      },
      select: {
        id: true
      }
    });
    if (slugExists) {
      await prisma.upload.update({
        where: {
          id: uploadId
        },
        data: {
          status: "FAILED",
          errorMessage: "이미 사용 중인 slug입니다. 다른 slug를 입력해주세요."
        }
      });
      response.status(409).json({ message: "이미 사용 중인 slug입니다. 다른 slug를 입력해주세요." });
      return;
    }

    const versionLabel = new Date().toISOString().replace(/[:.]/g, "-");
    const gameDirectory = path.join(storagePaths.gamesDir, game.slug);
    const requestedCreatorIds = creatorIdsField(request.body.creatorIds);
    const requestedCreatorNames = creatorNamesField(request.body.creatorNames);
    const creatorIds =
      request.admin?.role === "SUPER_ADMIN"
        ? requestedCreatorIds
        : [...new Set([request.admin?.id, ...requestedCreatorIds].filter((id): id is string => Boolean(id)))];
    const creatorNames =
      requestedCreatorNames.length > 0
        ? requestedCreatorNames
        : request.admin?.role === "MANAGER"
          ? [request.admin.name]
          : [];

    await prisma.upload.update({
      where: {
        id: uploadId
      },
      data: {
        status: "PROCESSING"
      }
    });

    thumbnailQueuedForBackgroundUpload = Boolean(thumbnailFile?.path);
    void publishGameInBackground({
      uploadId,
      game,
      gameDirectory,
      versionLabel,
      creatorIds,
      creatorNames,
      thumbnailFilePath: thumbnailFile?.path,
      thumbnailMimeType: thumbnailFile?.mimetype,
      admin: request.admin
    });

    response.status(202).json({
      upload: uploadResponse({
        id: uploadId,
        originalName: zipFile.originalname,
        status: "PROCESSING",
        errorMessage: null,
        progress: {
          totalFiles: 0,
          uploadedFiles: 0,
          totalBytes: 0,
          uploadedBytes: 0,
          percent: 0
        }
      })
    });
  } catch (error) {
    if (uploadId) {
      try {
        await prisma.upload.update({
          where: {
            id: uploadId
          },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : "Unexpected upload failure"
          }
        });
      } catch {
        // Preserve the original upload error for the API response.
      }
    }

    next(error);
  } finally {
    const files = request.files as { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;
    const zipFile = files?.file?.[0];
    const thumbnailFile = files?.thumbnail?.[0];
    if (zipFile?.path) {
      fs.rmSync(zipFile.path, { force: true });
    }
    if (!thumbnailQueuedForBackgroundUpload && thumbnailFile?.path) {
      fs.rmSync(thumbnailFile.path, { force: true });
    }
  }
});
