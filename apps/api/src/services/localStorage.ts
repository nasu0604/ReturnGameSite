import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const storageRoot = path.join(apiRoot, "storage");

export const storagePaths = {
  root: storageRoot,
  tempDir: path.join(storageRoot, "tmp"),
  gamesDir: path.join(storageRoot, "games"),
  catalogFile: path.join(storageRoot, "catalog.json")
};

export function ensureStorageFolders() {
  fs.mkdirSync(storagePaths.tempDir, { recursive: true });
  fs.mkdirSync(storagePaths.gamesDir, { recursive: true });

  if (!fs.existsSync(storagePaths.catalogFile)) {
    fs.writeFileSync(storagePaths.catalogFile, JSON.stringify({ games: [] }, null, 2));
  }
}

export function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `game-${Date.now()}`;
}
