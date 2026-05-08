import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { requireAdmin, type AdminRequest } from "../middleware/requireAdmin.js";
import { getPublishedGameById, upsertPublishedGame } from "../services/gameRepository.js";
import { storagePaths } from "../services/localStorage.js";
import { prisma } from "../services/db.js";
import { publishWebglDirectory } from "../services/s3Publisher.js";
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

async function publishGameInBackground(input: {
  uploadId: string;
  game: ReturnType<typeof processWebglZip>;
  gameDirectory: string;
  versionLabel: string;
  creatorIds: string[];
}) {
  try {
    const published = await publishWebglDirectory({
      directory: input.gameDirectory,
      slug: input.game.slug,
      versionLabel: input.versionLabel
    });

    const thumbnailUrl = input.game.thumbnailUrl
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
      thumbnailUrl,
      versionLabel: input.versionLabel,
      entryUrl: published.entryUrl,
      assetBaseUrl: published.assetBaseUrl,
      s3Prefix: published.s3Prefix,
      manifest: {
        buildFiles: input.game.buildFiles
      },
      creatorIds: input.creatorIds
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
      upload: {
        id: uploadRecord.id,
        originalName: uploadRecord.originalName,
        status: uploadRecord.status,
        errorMessage: uploadRecord.errorMessage ?? undefined
      },
      game
    });
  } catch (error) {
    next(error);
  }
});

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

uploadsRouter.post("/webgl-zip", requireAdmin, upload.single("file"), async (request: AdminRequest, response, next) => {
  let uploadId: string | null = null;

  try {
    if (!request.file) {
      response.status(400).json({ message: "Missing zip file." });
      return;
    }

    const uploadRecord = await prisma.upload.create({
      data: {
        originalName: request.file.originalname,
        status: "RECEIVED"
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
      zipPath: request.file.path,
      originalName: request.file.originalname,
      title: stringField(request.body.title) || undefined,
      slug: stringField(request.body.slug) || undefined,
      year: optionalNumberField(request.body.year),
      developer: stringField(request.body.developer) || undefined,
      difficulty: difficultyField(request.body.difficulty),
      shortDescription: stringField(request.body.shortDescription) || undefined,
      description: stringField(request.body.description) || undefined
    });

    const versionLabel = new Date().toISOString().replace(/[:.]/g, "-");
    const gameDirectory = path.join(storagePaths.gamesDir, game.slug);
    const requestedCreatorIds = creatorIdsField(request.body.creatorIds);
    const creatorIds =
      request.admin?.role === "SUPER_ADMIN"
        ? requestedCreatorIds
        : [...new Set([request.admin?.id, ...requestedCreatorIds].filter((id): id is string => Boolean(id)))];

    await prisma.upload.update({
      where: {
        id: uploadId
      },
      data: {
        status: "PROCESSING"
      }
    });

    void publishGameInBackground({
      uploadId,
      game,
      gameDirectory,
      versionLabel,
      creatorIds
    });

    response.status(202).json({
      upload: {
        id: uploadId,
        originalName: request.file.originalname,
        status: "PROCESSING"
      }
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
});
