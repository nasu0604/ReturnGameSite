import bcrypt from "bcryptjs";
import type { GameComment } from "@return-game/shared";
import { prisma } from "./db.js";

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
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    deletedAt: comment.deletedAt?.toISOString()
  };
}

export async function listCommentsByGameSlug(slug: string) {
  const comments = await prisma.comment.findMany({
    where: {
      deletedAt: null,
      game: {
        slug,
        status: "PUBLISHED"
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return comments.map(toComment);
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
      status: "PUBLISHED"
    }
  });

  if (!game) {
    throw new Error("Game not found.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const comment = await prisma.comment.create({
    data: {
      gameId: game.id,
      author: input.author,
      body: input.body,
      authorIp: input.authorIp,
      passwordHash
    }
  });

  return toComment(comment);
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

  await prisma.comment.update({
    where: {
      id: comment.id
    },
    data: {
      deletedAt: new Date()
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

  await prisma.comment.update({
    where: {
      id: comment.id
    },
    data: {
      deletedAt: new Date()
    }
  });
}
