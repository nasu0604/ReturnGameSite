import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type { GameDetail } from "@return-game/shared";
import { slugify, storagePaths } from "./localStorage.js";

interface BuildFiles {
  data: string[];
  wasm: string[];
  loader: string[];
}

interface ProcessWebglZipInput {
  zipPath: string;
  originalName: string;
  title?: string;
  slug?: string;
  shortDescription?: string;
}

function normalizeEntryName(name: string) {
  return name.replace(/\\/g, "/").replace(/^\/+/, "");
}

function getWebglRoot(entries: string[]) {
  const fileEntries = entries.filter((entry) => !entry.endsWith("/"));
  const indexEntries = fileEntries.filter((entry) => path.posix.basename(entry).toLowerCase() === "index.html");

  for (const indexEntry of indexEntries) {
    const root = path.posix.dirname(indexEntry) === "." ? "" : path.posix.dirname(indexEntry);
    const buildPrefix = root ? `${root}/Build/` : "Build/";
    const hasBuildFolder = fileEntries.some((entry) => entry.startsWith(buildPrefix));

    if (hasBuildFolder) {
      return root;
    }
  }

  return null;
}

function relativeToRoot(entry: string, root: string) {
  if (!root) return entry;
  if (entry === root) return "";
  return entry.startsWith(`${root}/`) ? entry.slice(root.length + 1) : null;
}

function collectBuildFiles(entries: string[]) {
  const buildFiles: BuildFiles = {
    data: [],
    wasm: [],
    loader: []
  };

  for (const entry of entries) {
    if (!entry.startsWith("Build/")) continue;
    if (entry.endsWith(".data")) buildFiles.data.push(entry);
    if (entry.endsWith(".wasm")) buildFiles.wasm.push(entry);
    if (entry.endsWith(".loader.js")) buildFiles.loader.push(entry);
  }

  return buildFiles;
}

function validateBuild(entries: string[]) {
  const required = ["index.html"];
  const missing = required.filter((entry) => !entries.includes(entry));
  const buildFiles = collectBuildFiles(entries);

  if (buildFiles.data.length === 0) missing.push("Build/*.data");
  if (buildFiles.wasm.length === 0) missing.push("Build/*.wasm");
  if (buildFiles.loader.length === 0) missing.push("Build/*.loader.js");

  if (missing.length > 0) {
    throw new Error(`Invalid Unity WebGL zip. Missing: ${missing.join(", ")}`);
  }

  return buildFiles;
}

function getReferencedBuildFiles(indexHtml: string) {
  const directMatches = [...indexHtml.matchAll(/Build\/([^"']+\.(?:data|wasm|framework\.js|loader\.js))/g)].map(
    (match) => `Build/${match[1]}`
  );
  const buildUrlMatches = [...indexHtml.matchAll(/buildUrl\s*\+\s*["']\/([^"']+\.(?:data|wasm|framework\.js|loader\.js))/g)].map(
    (match) => `Build/${match[1]}`
  );

  return [...new Set([...directMatches, ...buildUrlMatches])];
}

function getExtensionKey(fileName: string) {
  if (fileName.endsWith(".loader.js")) return ".loader.js";
  if (fileName.endsWith(".framework.js")) return ".framework.js";
  return path.extname(fileName);
}

function listFilesRecursive(rootDir: string, currentDir = rootDir): string[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(rootDir, fullPath));
    } else {
      files.push(path.relative(rootDir, fullPath).replace(/\\/g, "/"));
    }
  }

  return files;
}

function alignBuildFileNamesWithIndex(targetDir: string) {
  const indexPath = path.join(targetDir, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const referencedBuildFiles = getReferencedBuildFiles(indexHtml);

  for (const referencedFile of referencedBuildFiles) {
    const expectedPath = path.join(targetDir, referencedFile);
    if (fs.existsSync(expectedPath)) continue;

    const expectedKey = getExtensionKey(referencedFile);
    const buildDir = path.join(targetDir, "Build");
    const candidates = fs
      .readdirSync(buildDir)
      .filter((fileName) => getExtensionKey(fileName) === expectedKey)
      .filter((fileName) => !referencedBuildFiles.includes(`Build/${fileName}`));

    if (candidates.length === 1) {
      fs.renameSync(path.join(buildDir, candidates[0]), expectedPath);
    }
  }

  const files = listFilesRecursive(targetDir);
  return validateBuild(files);
}

function assertSafeRelativePath(relativePath: string) {
  const normalized = path.posix.normalize(relativePath);

  if (normalized.startsWith("../") || normalized === ".." || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe zip entry path: ${relativePath}`);
  }

  return normalized;
}

export function processWebglZip(input: ProcessWebglZipInput): GameDetail {
  const zip = new AdmZip(input.zipPath);
  const zipEntries = zip.getEntries();
  const normalizedNames = zipEntries.map((entry) => normalizeEntryName(entry.entryName));
  const root = getWebglRoot(normalizedNames);

  if (root === null) {
    throw new Error("Invalid Unity WebGL zip. Could not find index.html with a Build folder.");
  }

  const relativeEntries = normalizedNames
    .map((entry) => relativeToRoot(entry, root))
    .filter((entry): entry is string => Boolean(entry));
  validateBuild(relativeEntries);
  const title = input.title?.trim() || path.basename(input.originalName, path.extname(input.originalName));
  const slug = slugify(input.slug || title);
  const targetDir = path.join(storagePaths.gamesDir, slug);

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    const normalizedName = normalizeEntryName(entry.entryName);
    const relative = relativeToRoot(normalizedName, root);
    if (!relative) continue;

    const safeRelative = assertSafeRelativePath(relative);
    const targetPath = path.join(targetDir, safeRelative);
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(targetDir);

    if (!resolvedTarget.startsWith(resolvedRoot)) {
      throw new Error(`Unsafe zip entry path: ${relative}`);
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, entry.getData());
  }

  const buildFiles = alignBuildFileNamesWithIndex(targetDir);

  return {
    id: slug,
    slug,
    title,
    shortDescription: input.shortDescription?.trim() || "Local WebGL upload",
    thumbnailUrl: "",
    currentVersion: "local",
    entryUrl: `/local-games/${encodeURIComponent(slug)}/index.html`,
    status: "PUBLISHED",
    buildFiles
  };
}
