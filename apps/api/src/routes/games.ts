import { Router } from "express";
import type { Request } from "express";
import type { GameDetail } from "@return-game/shared";
import { getGameBySlug, listGames } from "../services/catalog.js";

export const gamesRouter = Router();

function withAbsoluteEntryUrl(request: Request, game: GameDetail) {
  const origin = `${request.protocol}://${request.get("host")}`;
  return {
    ...game,
    entryUrl: game.entryUrl?.startsWith("http") ? game.entryUrl : `${origin}${game.entryUrl ?? ""}`
  };
}

gamesRouter.get("/", (request, response) => {
  response.json({
    games: listGames().map((game) => withAbsoluteEntryUrl(request, game))
  });
});

gamesRouter.get("/:slug", (request, response) => {
  const game = getGameBySlug(request.params.slug);

  if (!game) {
    response.status(404).json({ message: "Game not found" });
    return;
  }

  response.json({ game: withAbsoluteEntryUrl(request, game) });
});
