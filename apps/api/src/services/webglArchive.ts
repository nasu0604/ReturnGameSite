import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  year?: number;
  developer?: string;
  difficulty?: number;
  description?: string;
}

const unityTemplateStyle = `body { padding: 0; margin: 0; }
#unity-container { position: absolute; }
#unity-container.unity-desktop { left: 50%; top: 50%; transform: translate(-50%, -50%) }
#unity-container.unity-mobile { position: fixed; width: 100%; height: 100% }
#unity-canvas { background: #231F20; border-radius: 10px; }
.unity-mobile #unity-canvas { width: 100%; height: 100% }
#unity-loading-bar { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none }
#unity-logo { width: 154px; height: 130px; background: url('unity-logo-dark.png') no-repeat center }
#unity-progress-bar-empty { width: 141px; height: 18px; margin-top: 10px; margin-left: 6.5px; background: url('progress-bar-empty-dark.png') no-repeat center }
#unity-progress-bar-full { width: 0%; height: 18px; margin-top: 10px; background: url('progress-bar-full-dark.png') no-repeat center }
#unity-footer { position: relative; margin-top:5px; }
.unity-mobile #unity-footer { display: none }
#unity-logo-title-footer { float:left; width: 102px; height: 38px; background: url('unity-logo-title-footer.png') no-repeat center }
#unity-build-title { float: right; margin-right: 10px; line-height: 38px; font-size: 18px; color:white; }
#unity-fullscreen-button { cursor:pointer; float: right; width: 38px; height: 38px; background: url('fullscreen-button.png') no-repeat center }
#unity-warning { position: absolute; left: 50%; top: 5%; transform: translate(-50%); background: white; padding: 10px; display: none }
`;

function normalizeEntryName(name: string) {
  return name.replace(/\\/g, "/").replace(/^\/+/, "");
}

function getApiRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function getTemplateAssetPath(fileName: string) {
  const candidates = [
    path.join(getApiRoot(), "assets", "template-data", fileName),
    path.join(process.cwd(), "assets", "template-data", fileName),
    path.join(process.cwd(), "apps", "api", "assets", "template-data", fileName)
  ];

  const assetPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!assetPath) {
    throw new Error(`Missing Unity template asset: ${fileName}`);
  }

  return assetPath;
}

function getWebglRoot(entries: string[]) {
  const fileEntries = entries.filter((entry) => !entry.endsWith("/"));
  const indexEntries = fileEntries.filter((entry) => path.posix.basename(entry).toLowerCase() === "index.html");

  for (const indexEntry of indexEntries) {
    const root = path.posix.dirname(indexEntry) === "." ? "" : path.posix.dirname(indexEntry);
    const buildPrefix = root ? `${root}/build/` : "build/";
    const hasBuildFolder = fileEntries.some((entry) => entry.toLowerCase().startsWith(buildPrefix.toLowerCase()));

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

function normalizeUnityRelativePath(relativePath: string) {
  const segments = relativePath.split("/");
  if (segments[0]?.toLowerCase() === "build") {
    segments[0] = "Build";
  }

  return segments.join("/");
}

function isUnityBuildAsset(fileName: string) {
  return /\.(data|wasm|loader\.js|framework\.js|symbols\.json)(?:\.(?:br|gz))?$/i.test(fileName);
}

function shouldExtractUnityFile(relativePath: string) {
  const normalizedPath = normalizeUnityRelativePath(relativePath);

  if (normalizedPath === "index.html") return true;
  if (normalizedPath.startsWith("TemplateData/")) return true;
  if (normalizedPath.startsWith("StreamingAssets/")) return true;

  if (normalizedPath.startsWith("Build/")) {
    const buildRelativePath = normalizedPath.slice("Build/".length);
    return !buildRelativePath.includes("/") && isUnityBuildAsset(buildRelativePath);
  }

  return false;
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
  const directMatches = [...indexHtml.matchAll(/Build\/([^"']+\.(?:data|wasm|framework\.js|loader\.js))/gi)].map(
    (match) => `Build/${match[1]}`
  );
  const buildUrlMatches = [...indexHtml.matchAll(/buildUrl\s*\+\s*["']\/([^"']+\.(?:data|wasm|framework\.js|loader\.js))/g)].map(
    (match) => `Build/${match[1]}`
  );

  return [...new Set([...directMatches, ...buildUrlMatches])];
}

function normalizeIndexBuildReferences(targetDir: string) {
  const indexPath = path.join(targetDir, "index.html");
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const normalizedHtml = indexHtml
    .replace(/(buildUrl\s*=\s*["'])build(["'])/gi, "$1Build$2")
    .replace(/(["'])build\//gi, "$1Build/")
    .replace(/(<div\b[^>]*\bid=["']unity-build-title["'][^>]*>)[\s\S]*?(<\/div>)/i, "$1$2");

  if (normalizedHtml !== indexHtml) {
    fs.writeFileSync(indexPath, normalizedHtml, "utf8");
  }
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

function findThumbnail(files: string[]) {
  const imageFiles = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
  const rootImage = imageFiles.find((file) => !file.includes("/"));
  const nonTemplateImage = imageFiles.find((file) => !file.startsWith("TemplateData/"));

  return rootImage ?? nonTemplateImage ?? "";
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

export function normalizeUnityTemplateData(targetDir: string) {
  const templateDir = path.join(targetDir, "TemplateData");

  fs.mkdirSync(templateDir, { recursive: true });
  fs.writeFileSync(path.join(templateDir, "style.css"), unityTemplateStyle, "utf8");
  fs.copyFileSync(getTemplateAssetPath("fullscreen-button.png"), path.join(templateDir, "fullscreen-button.png"));
  fs.rmSync(path.join(templateDir, "unity-logo-title-footer.png"), { force: true });
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
  validateBuild(relativeEntries.map(normalizeUnityRelativePath));
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
    if (!shouldExtractUnityFile(relative)) continue;

    const safeRelative = assertSafeRelativePath(normalizeUnityRelativePath(relative));
    const targetPath = path.join(targetDir, safeRelative);
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(targetDir);

    if (!resolvedTarget.startsWith(resolvedRoot)) {
      throw new Error(`Unsafe zip entry path: ${relative}`);
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, entry.getData());
  }

  normalizeUnityTemplateData(targetDir);
  normalizeIndexBuildReferences(targetDir);
  const buildFiles = alignBuildFileNamesWithIndex(targetDir);
  const extractedFiles = listFilesRecursive(targetDir);
  const thumbnailPath = findThumbnail(extractedFiles);

  return {
    id: slug,
    slug,
    title,
    year: input.year,
    developer: input.developer?.trim() || undefined,
    difficulty: input.difficulty,
    shortDescription: input.shortDescription?.trim() || "Local WebGL upload",
    description: input.description?.trim() || undefined,
    thumbnailUrl: thumbnailPath ? `/local-games/${encodeURIComponent(slug)}/${thumbnailPath}` : "",
    currentVersion: "local",
    entryUrl: `/local-games/${encodeURIComponent(slug)}/index.html`,
    viewCount: 0,
    commentCount: 0,
    status: "PUBLISHED",
    buildFiles
  };
}
