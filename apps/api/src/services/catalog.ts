import fs from "node:fs";
import type { GameDetail } from "@return-game/shared";
import { storagePaths } from "./localStorage.js";

interface CatalogData {
  games: GameDetail[];
}

function readCatalog(): CatalogData {
  const raw = fs.readFileSync(storagePaths.catalogFile, "utf8");
  return JSON.parse(raw) as CatalogData;
}

function writeCatalog(data: CatalogData) {
  fs.writeFileSync(storagePaths.catalogFile, JSON.stringify(data, null, 2));
}

export function listGames() {
  return readCatalog().games;
}

export function getGameBySlug(slug: string) {
  return readCatalog().games.find((game) => game.slug === slug);
}

export function upsertGame(game: GameDetail) {
  const catalog = readCatalog();
  const nextGames = catalog.games.filter((item) => item.slug !== game.slug);
  nextGames.unshift(game);
  writeCatalog({ games: nextGames });
  return game;
}
