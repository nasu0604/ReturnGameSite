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
  _count?: {
    comments: number;
  };
};

function currentVersion(game: GameWithVersions) {
  return game.versions?.find((version) => version.id === game.currentVersionId) ?? game.versions?.[0] ?? null;
}

function buildFilesFromManifest(manifest: unknown): GameDetail["buildFiles"] {
  if (!manifest || typeof manifest !== "object") return undefined;
  return (manifest as { buildFiles?: GameDetail["buildFiles"] }).buildFiles;
}

function parseStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function toSummary(game: GameWithVersions): GameSummary {
  const version = currentVersion(game);
  const displayCreatorNames = parseStringArray(
    (game as GameWithVersions & { creatorNames?: Prisma.JsonValue | null }).creatorNames
  );
  const publicCreators = (
    game as GameWithVersions & {
      creators?: Array<{
        adminUser: {
          name: string | null;
          loginId: string | null;
        };
      }>;
    }
  ).creators;
  const linkedCreatorNames =
    publicCreators
      ?.map((creator) => creator.adminUser.name ?? creator.adminUser.loginId ?? "")
      .filter(Boolean) ?? [];
  const creatorNames = displayCreatorNames.length > 0 ? displayCreatorNames : linkedCreatorNames;

  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    year: game.year ?? undefined,
    developer: creatorNames.length > 0 ? creatorNames.join(", ") : game.developer ?? undefined,
    difficulty: game.difficulty ?? undefined,
    shortDescription: game.shortDescription,
    thumbnailUrl: game.thumbnailUrl ?? "",
    creatorNames,
    currentVersion: version?.versionLabel ?? "",
    entryUrl: version?.entryUrl,
    viewCount: game.viewCount ?? 0,
    commentCount: game._count?.comments ?? 0
  };
}

function toDetail(game: GameWithVersions): GameDetail {
  const version = currentVersion(game);

  return {
    ...toSummary(game),
    description: game.description ?? undefined,
    copyrightNotice: (game as GameWithVersions & { copyrightNotice?: string | null }).copyrightNotice ?? undefined,
    status: ((game as GameWithVersions & { visibility?: "PUBLIC" | "HIDDEN" }).visibility ?? "HIDDEN") as SharedGameStatus,
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
  },
  admin?: AdminSession
): AdminGameRecord {
  const isCreator = Boolean(admin && game.creators?.some((creator) => creator.adminUser.id === admin.id));

  return {
    ...toDetail(game),
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    creators: game.creators?.map((creator) => adminUserSummary(creator.adminUser)) ?? [],
    isCreator,
    canManage: admin?.role === "SUPER_ADMIN" || isCreator
  };
}

function publicGameInclude() {
  return {
    versions: {
      orderBy: {
        createdAt: "desc" as const
      }
    },
    _count: {
      select: {
        comments: {
          where: {
            deletedAt: null
          }
        }
      }
    },
    creators: {
      include: {
        adminUser: {
          select: {
            name: true,
            loginId: true
          }
        }
      },
      orderBy: {
        createdAt: "asc" as const
      }
    }
  };
}

function adminGameWhere(admin: AdminSession): Prisma.GameWhereInput {
  return admin.role === "SUPER_ADMIN" ? {} : {};
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
      visibility: "PUBLIC"
    },
    include: publicGameInclude(),
    orderBy: {
      viewCount: "desc"
    }
  });

  return games.map(toSummary);
}

export async function getPublishedGameBySlug(slug: string) {
  const game = await prisma.game.findFirst({
    where: {
      slug,
      visibility: "PUBLIC"
    },
    include: publicGameInclude()
  });

  return game ? toDetail(game) : null;
}

export async function getPublishedGameById(id: string) {
  const game = await prisma.game.findFirst({
    where: {
      id,
      visibility: "PUBLIC"
    },
    include: publicGameInclude()
  });

  return game ? toDetail(game) : null;
}

export async function incrementPublishedGameView(slug: string) {
  const game = await prisma.game.findFirst({
    where: {
      slug,
      visibility: "PUBLIC"
    },
    select: {
      id: true
    }
  });

  if (!game) return null;

  const updated = await prisma.game.update({
    where: {
      id: game.id
    },
    data: {
      viewCount: {
        increment: 1
      }
    },
    include: publicGameInclude()
  });

  return toDetail(updated);
}

export async function upsertPublishedGame(input: {
  slug: string;
  title: string;
  year?: number;
  developer?: string;
  difficulty?: number;
  shortDescription: string;
  description?: string;
  copyrightNotice?: string;
  thumbnailUrl: string;
  versionLabel: string;
  entryUrl: string;
  assetBaseUrl: string;
  s3Prefix: string;
  manifest: Prisma.InputJsonValue;
  creatorIds?: string[];
  creatorNames?: string[];
}) {
  const existing = await prisma.game.findUnique({
    where: {
      slug: input.slug
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throw new Error("이미 사용 중인 slug입니다. 다른 slug를 입력해주세요.");
  }

  const game = await prisma.game.create({
    data: {
      slug: input.slug,
      title: input.title,
      year: input.year,
      developer: input.developer,
      creatorNames: input.creatorNames ?? (input.developer ? [input.developer] : []),
      difficulty: input.difficulty,
      shortDescription: input.shortDescription,
      description: input.description,
      copyrightNotice: input.copyrightNotice,
      thumbnailUrl: input.thumbnailUrl,
      status: "PUBLISHED",
      visibility: "PUBLIC"
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

export async function addGameVersionToExistingGame(
  id: string,
  input: {
    versionLabel: string;
    entryUrl: string;
    assetBaseUrl: string;
    s3Prefix: string;
    manifest: Prisma.InputJsonValue;
  }
) {
  const game = await prisma.$transaction(async (tx) => {
    const version = await tx.gameVersion.create({
      data: {
        gameId: id,
        versionLabel: input.versionLabel,
        entryUrl: input.entryUrl,
        assetBaseUrl: input.assetBaseUrl,
        s3Prefix: input.s3Prefix,
        manifest: input.manifest
      }
    });

    return tx.game.update({
      where: {
        id
      },
      data: {
        currentVersionId: version.id
      },
      include: adminGameInclude()
    });
  });

  return toAdminRecord(game);
}

export async function listAdminGames(admin: AdminSession) {
  const games = await prisma.game.findMany({
    where: adminGameWhere(admin),
    include: adminGameInclude(),
    orderBy: {
      updatedAt: "desc"
    }
  });

  return games.map((game) => toAdminRecord(game, admin));
}

export async function getAdminGameById(id: string, admin: AdminSession) {
  const game = await prisma.game.findFirst({
    where: {
      id,
      ...adminGameWhere(admin)
    },
    include: adminGameInclude()
  });

  if (!game) return null;

  const record = toAdminRecord(game, admin);
  return record.canManage ? record : null;
}

export async function updateAdminGame(
  id: string,
  admin: AdminSession,
  input: {
    title: string;
    year?: number | null;
    developer?: string | null;
    difficulty?: number | null;
    shortDescription: string;
    description?: string | null;
    copyrightNotice?: string | null;
    status: SharedGameStatus;
    creatorNames?: string[];
  }
) {
  const game = await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: {
        id
      },
      data: {
        title: input.title,
        year: input.year,
        developer: input.developer,
        creatorNames: input.creatorNames ?? [],
        difficulty: input.difficulty,
        shortDescription: input.shortDescription,
        description: input.description,
        copyrightNotice: input.copyrightNotice,
        visibility: input.status
      }
    });

    return tx.game.findUniqueOrThrow({
      where: {
        id
      },
      include: adminGameInclude()
    });
  });

  return toAdminRecord(game, admin);
}

export async function updateAdminGameThumbnail(id: string, thumbnailUrl: string) {
  const game = await prisma.game.update({
    where: {
      id
    },
    data: {
      thumbnailUrl
    },
    include: adminGameInclude()
  });

  return toAdminRecord(game);
}

export async function registerCurrentAdminAsGameCreator(id: string, admin: AdminSession) {
  const existing = await prisma.game.findUnique({
    where: {
      id
    },
    select: {
      creatorNames: true
    }
  });
  const displayName = admin.name?.trim() || admin.loginId;
  const creatorNames = parseStringArray(existing?.creatorNames);

  await prisma.gameCreator.createMany({
    data: [
      {
        gameId: id,
        adminUserId: admin.id
      }
    ],
    skipDuplicates: true
  });

  if (displayName && !creatorNames.includes(displayName)) {
    await prisma.game.update({
      where: {
        id
      },
      data: {
        creatorNames: [...creatorNames, displayName]
      }
    });
  }

  const game = await prisma.game.findUniqueOrThrow({
    where: {
      id
    },
    include: adminGameInclude()
  });

  return toAdminRecord(game, admin);
}

export async function deleteAdminGame(id: string) {
  const game = await prisma.game.findUnique({
    where: {
      id
    },
    include: {
      versions: true
    }
  });

  if (!game) return null;

  await prisma.game.delete({
    where: {
      id
    }
  });

  const versionPrefixes = game.versions.map((version) => version.s3Prefix).filter(Boolean);
  const parentPrefixes = versionPrefixes
    .map((prefix) => prefix.replace(/\/+$/g, "").split("/").slice(0, -1).join("/"))
    .filter(Boolean);

  return {
    id: game.id,
    title: game.title,
    slug: game.slug,
    thumbnailUrl: game.thumbnailUrl ?? undefined,
    s3Prefixes: [...new Set([...parentPrefixes, ...versionPrefixes])]
  };
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
