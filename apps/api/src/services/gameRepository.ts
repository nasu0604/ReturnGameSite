import type {
  AdminGameRecord,
  AdminSession,
  AdminUserSummary,
  GameDetail,
  GameSummary,
  GameStatus as SharedGameStatus
} from "@return-game/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

type GameWithVersions = NonNullable<Awaited<ReturnType<typeof prisma.game.findFirst>>> & {
  versions?: Array<{
    id: string;
    versionLabel: string;
    entryUrl: string;
    assetBaseUrl: string;
    s3Prefix: string;
    manifest: unknown;
    createdAt: Date;
  }>;
};

function currentVersion(game: GameWithVersions) {
  return game.versions?.find((version) => version.id === game.currentVersionId) ?? game.versions?.[0] ?? null;
}

function buildFilesFromManifest(manifest: unknown): GameDetail["buildFiles"] {
  if (!manifest || typeof manifest !== "object") return undefined;
  return (manifest as { buildFiles?: GameDetail["buildFiles"] }).buildFiles;
}

function toSummary(game: GameWithVersions): GameSummary {
  const version = currentVersion(game);

  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    year: game.year ?? undefined,
    developer: game.developer ?? undefined,
    difficulty: game.difficulty ?? undefined,
    shortDescription: game.shortDescription,
    thumbnailUrl: game.thumbnailUrl ?? "",
    currentVersion: version?.versionLabel ?? "",
    entryUrl: version?.entryUrl
  };
}

function toDetail(game: GameWithVersions): GameDetail {
  const version = currentVersion(game);

  return {
    ...toSummary(game),
    description: game.description ?? undefined,
    status: game.status as SharedGameStatus,
    buildFiles: buildFilesFromManifest(version?.manifest)
  };
}

export function adminUserSummary(user: {
  id: string;
  name: string | null;
  loginId: string | null;
  role: "SUPER_ADMIN" | "MANAGER";
  status: "ACTIVE" | "DISABLED";
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date | null;
}): AdminUserSummary {
  return {
    id: user.id,
    name: user.name ?? user.loginId ?? "",
    loginId: user.loginId ?? "",
    role: user.role,
    status: user.status,
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString()
  };
}

function toAdminRecord(
  game: GameWithVersions & {
    creators?: Array<{
      adminUser: Parameters<typeof adminUserSummary>[0];
    }>;
    _count?: {
      comments: number;
    };
  }
): AdminGameRecord {
  return {
    ...toDetail(game),
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    commentCount: game._count?.comments ?? 0,
    creators: game.creators?.map((creator) => adminUserSummary(creator.adminUser)) ?? []
  };
}

function adminGameWhere(admin: AdminSession): Prisma.GameWhereInput {
  if (admin.role === "SUPER_ADMIN") return {};

  return {
    creators: {
      some: {
        adminUserId: admin.id
      }
    }
  };
}

function adminGameInclude() {
  return {
    versions: {
      orderBy: {
        createdAt: "desc" as const
      }
    },
    creators: {
      include: {
        adminUser: true
      },
      orderBy: {
        createdAt: "asc" as const
      }
    },
    _count: {
      select: {
        comments: true
      }
    }
  };
}

export async function listPublishedGames() {
  const games = await prisma.game.findMany({
    where: {
      status: "PUBLISHED"
    },
    include: {
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return games.map(toSummary);
}

export async function getPublishedGameBySlug(slug: string) {
  const game = await prisma.game.findFirst({
    where: {
      slug,
      status: "PUBLISHED"
    },
    include: {
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  return game ? toDetail(game) : null;
}

export async function getPublishedGameById(id: string) {
  const game = await prisma.game.findFirst({
    where: {
      id,
      status: "PUBLISHED"
    },
    include: {
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  return game ? toDetail(game) : null;
}

export async function upsertPublishedGame(input: {
  slug: string;
  title: string;
  year?: number;
  developer?: string;
  difficulty?: number;
  shortDescription: string;
  description?: string;
  thumbnailUrl: string;
  versionLabel: string;
  entryUrl: string;
  assetBaseUrl: string;
  s3Prefix: string;
  manifest: Prisma.InputJsonValue;
  creatorIds?: string[];
}) {
  const game = await prisma.game.upsert({
    where: {
      slug: input.slug
    },
    create: {
      slug: input.slug,
      title: input.title,
      year: input.year,
      developer: input.developer,
      difficulty: input.difficulty,
      shortDescription: input.shortDescription,
      description: input.description,
      thumbnailUrl: input.thumbnailUrl,
      status: "PUBLISHED"
    },
    update: {
      title: input.title,
      year: input.year,
      developer: input.developer,
      difficulty: input.difficulty,
      shortDescription: input.shortDescription,
      description: input.description,
      thumbnailUrl: input.thumbnailUrl,
      status: "PUBLISHED"
    }
  });

  const version = await prisma.gameVersion.create({
    data: {
      gameId: game.id,
      versionLabel: input.versionLabel,
      entryUrl: input.entryUrl,
      assetBaseUrl: input.assetBaseUrl,
      s3Prefix: input.s3Prefix,
      manifest: input.manifest
    }
  });

  if (input.creatorIds?.length) {
    await prisma.gameCreator.createMany({
      data: [...new Set(input.creatorIds)].map((adminUserId) => ({
        gameId: game.id,
        adminUserId
      })),
      skipDuplicates: true
    });
  }

  const updatedGame = await prisma.game.update({
    where: {
      id: game.id
    },
    data: {
      currentVersionId: version.id
    },
    include: {
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  return toDetail(updatedGame);
}

export async function listAdminGames(admin: AdminSession) {
  const games = await prisma.game.findMany({
    where: adminGameWhere(admin),
    include: adminGameInclude(),
    orderBy: {
      updatedAt: "desc"
    }
  });

  return games.map(toAdminRecord);
}

export async function getAdminGameById(id: string, admin: AdminSession) {
  const game = await prisma.game.findFirst({
    where: {
      id,
      ...adminGameWhere(admin)
    },
    include: adminGameInclude()
  });

  return game ? toAdminRecord(game) : null;
}

export async function updateAdminGame(
  id: string,
  input: {
    slug: string;
    title: string;
    year?: number | null;
    developer?: string | null;
    difficulty?: number | null;
    shortDescription: string;
    description?: string | null;
    status: SharedGameStatus;
    creatorIds?: string[];
  }
) {
  const game = await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: {
        id
      },
      data: {
        slug: input.slug,
        title: input.title,
        year: input.year,
        developer: input.developer,
        difficulty: input.difficulty,
        shortDescription: input.shortDescription,
        description: input.description,
        status: input.status
      }
    });

    if (input.creatorIds) {
      await tx.gameCreator.deleteMany({
        where: {
          gameId: id
        }
      });
      await tx.gameCreator.createMany({
        data: [...new Set(input.creatorIds)].map((adminUserId) => ({
          gameId: id,
          adminUserId
        })),
        skipDuplicates: true
      });
    }

    return tx.game.findUniqueOrThrow({
      where: {
        id
      },
      include: adminGameInclude()
    });
  });

  return toAdminRecord(game);
}

export async function archiveAdminGame(id: string) {
  const game = await prisma.game.update({
    where: {
      id
    },
    data: {
      status: "ARCHIVED"
    },
    include: adminGameInclude()
  });

  return toAdminRecord(game);
}

export async function userCanManageGame(admin: AdminSession, gameId: string) {
  if (admin.role === "SUPER_ADMIN") return true;

  const creator = await prisma.gameCreator.findUnique({
    where: {
      gameId_adminUserId: {
        gameId,
        adminUserId: admin.id
      }
    }
  });

  return Boolean(creator);
}
