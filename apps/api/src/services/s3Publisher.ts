import fs from "node:fs";
import path from "node:path";
import { Upload } from "@aws-sdk/lib-storage";
import { createS3Client, getStorageConfig } from "./storage.js";

interface PublishedWebglBuild {
  assetBaseUrl: string;
  entryUrl: string;
  s3Prefix: string;
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

function getContentType(filePath: string) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  if (lower.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (lower.endsWith(".wasm")) return "application/wasm";
  if (lower.endsWith(".data")) return "application/octet-stream";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";

  return "application/octet-stream";
}

function joinUrl(baseUrl: string, key: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${cleanBase}/${encodedKey}`;
}

function getPublicBaseUrl(bucket: string, region: string, cdnBaseUrl: string) {
  if (cdnBaseUrl) return cdnBaseUrl;
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

export async function publishWebglDirectory(input: {
  directory: string;
  slug: string;
  versionLabel: string;
}): Promise<PublishedWebglBuild> {
  const { bucket, cdnBaseUrl, uploadPrefix } = getStorageConfig();
  const region = process.env.AWS_REGION ?? "ap-northeast-2";

  if (!bucket) {
    throw new Error("S3_BUCKET must be configured before uploading WebGL builds.");
  }

  const client = createS3Client();
  const cleanPrefix = uploadPrefix.replace(/^\/+|\/+$/g, "");
  const s3Prefix = [cleanPrefix, input.slug, input.versionLabel].filter(Boolean).join("/");
  const files = listFilesRecursive(input.directory);

  for (const file of files) {
    const key = `${s3Prefix}/${file}`;
    const fullPath = path.join(input.directory, file);
    const size = fs.statSync(fullPath).size;

    console.log(`[s3] uploading ${key} (${size} bytes)`);

    const upload = new Upload({
      client,
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: false,
      params: {
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(fullPath),
        ContentType: getContentType(file),
        CacheControl: file === "index.html" ? "no-cache" : "public, max-age=31536000, immutable"
      }
    });

    await upload.done();
    console.log(`[s3] uploaded ${key}`);
  }

  const publicBaseUrl = getPublicBaseUrl(bucket, region, cdnBaseUrl);

  return {
    assetBaseUrl: joinUrl(publicBaseUrl, s3Prefix),
    entryUrl: joinUrl(publicBaseUrl, `${s3Prefix}/index.html`),
    s3Prefix
  };
}
