import bcrypt from "bcryptjs";
import type { GameComment } from "@return-game/shared";
import { prisma } from "./db.js";
import { getKoreanDatabaseDate, serializeKoreanDatabaseDate } from "../utils/koreanTime.js";

function toComment(comment: {
  id: string;
  gameId: string;
  author: string;
  body: string;
  authorIp: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}): GameComment {
  return {
    id: comment.id,
    gameId: comment.gameId,
    author: comment.author,
    body: comment.body,
    authorIp: comment.authorIp ?? undefined,
    createdAt: serializeKoreanDatabaseDate(comment.createdAt) ?? comment.createdAt.toISOString(),
    updatedAt: serializeKoreanDatabaseDate(comment.updatedAt) ?? comment.updatedAt.toISOString(),
    deletedAt: serializeKoreanDatabaseDate(comment.deletedAt)
  };
}

function toPublicComment(comment: Parameters<typeof toComment>[0]): GameComment {
  const { authorIp: _authorIp, ...publicComment } = toComment(comment);
  return publicComment;
}

export async function listCommentsByGameSlug(slug: string) {
  const comments = await prisma.comment.findMany({
    where: {
      deletedAt: null,
      game: {
        slug,
        visibility: "PUBLIC"
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return comments.map(toPublicComment);
}

export async function createCommentForGameSlug(input: {
  slug: string;
  author: string;
  body: string;
  password: string;
  authorIp?: string;
}) {
  const game = await prisma.game.findFirst({
    where: {
      slug: input.slug,
      visibility: "PUBLIC"
    }
  });

  if (!game) {
    throw new Error("Game not found.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const now = getKoreanDatabaseDate();
  const comment = await prisma.comment.create({
    data: {
      gameId: game.id,
      author: input.author,
      body: input.body,
      authorIp: input.authorIp,
      passwordHash,
      createdAt: now,
      updatedAt: now
    }
  });

  return toPublicComment(comment);
}

export async function listAdminCommentsByGameId(gameId: string) {
  const comments = await prisma.comment.findMany({
    where: {
      gameId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return comments.map(toComment);
}

export async function deleteCommentAsAdmin(commentId: string) {
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId
    }
  });

  if (!comment) {
    throw new Error("Comment not found.");
  }

  const now = getKoreanDatabaseDate();
  await prisma.comment.update({
    where: {
      id: comment.id
    },
    data: {
      deletedAt: now,
      updatedAt: now
    }
  });
}

export async function deleteComment(input: { commentId: string; password: string }) {
  const comment = await prisma.comment.findFirst({
    where: {
      id: input.commentId,
      deletedAt: null
    }
  });

  if (!comment) {
    throw new Error("Comment not found.");
  }

  const isPasswordValid = await bcrypt.compare(input.password, comment.passwordHash);
  if (!isPasswordValid) {
    throw new Error("Password does not match.");
  }

  const now = getKoreanDatabaseDate();
  await prisma.comment.update({
    where: {
      id: comment.id
    },
    data: {
      deletedAt: now,
      updatedAt: now
    }
  });
}
