import { Router } from "express";
import type { Request } from "express";
import type { GameDetail } from "@return-game/shared";
import { getPublishedGameBySlug, incrementPublishedGameView, listPublishedGames } from "../services/gameRepository.js";
import { createCommentForGameSlug, deleteComment, listCommentsByGameSlug } from "../services/commentRepository.js";

export const gamesRouter = Router();

function withAbsoluteEntryUrl(request: Request, game: GameDetail) {
  const origin = `${request.protocol}://${request.get("host")}`;
  return {
    ...game,
    entryUrl: game.entryUrl?.startsWith("http") ? game.entryUrl : `${origin}${game.entryUrl ?? ""}`,
    thumbnailUrl: game.thumbnailUrl?.startsWith("http")
      ? game.thumbnailUrl
      : game.thumbnailUrl
        ? `${origin}${game.thumbnailUrl}`
        : ""
  };
}

function getClientIp(request: Request) {
  const forwardedFor = request.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.ip || request.socket.remoteAddress || "";
}

gamesRouter.get("/", async (request, response, next) => {
  try {
    const games = await listPublishedGames();

    response.json({
      games: games.map((game) => withAbsoluteEntryUrl(request, game as GameDetail))
    });
  } catch (error) {
    next(error);
  }
});

gamesRouter.get("/:slug", async (request, response, next) => {
  try {
    const game = await getPublishedGameBySlug(request.params.slug);

    if (!game) {
      response.status(404).json({ message: "Game not found" });
      return;
    }

    response.json({ game: withAbsoluteEntryUrl(request, game) });
  } catch (error) {
    next(error);
  }
});

gamesRouter.post("/:slug/views", async (request, response, next) => {
  try {
    const game = await incrementPublishedGameView(request.params.slug);

    if (!game) {
      response.status(404).json({ message: "Game not found" });
      return;
    }

    response.json({ viewCount: game.viewCount });
  } catch (error) {
    next(error);
  }
});

gamesRouter.get("/:slug/comments", async (request, response, next) => {
  try {
    const comments = await listCommentsByGameSlug(request.params.slug);
    response.json({ comments });
  } catch (error) {
    next(error);
  }
});

gamesRouter.post("/:slug/comments", async (request, response, next) => {
  try {
    const author = typeof request.body.author === "string" ? request.body.author.trim() : "";
    const body = typeof request.body.body === "string" ? request.body.body.trim() : "";
    const password = typeof request.body.password === "string" ? request.body.password : "";

    if (!author) {
      response.status(400).json({ message: "Author is required." });
      return;
    }

    if (!body) {
      response.status(400).json({ message: "Comment body is required." });
      return;
    }

    if (password.length < 4) {
      response.status(400).json({ message: "Password must be at least 4 characters." });
      return;
    }

    const comment = await createCommentForGameSlug({
      slug: request.params.slug,
      author,
      body,
      password,
      authorIp: getClientIp(request)
    });

    response.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

gamesRouter.delete("/comments/:commentId", async (request, response, next) => {
  try {
    const password = typeof request.body.password === "string" ? request.body.password : "";

    if (!password) {
      response.status(400).json({ message: "Password is required." });
      return;
    }

    await deleteComment({
      commentId: request.params.commentId,
      password
    });

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
