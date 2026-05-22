import { S3Client } from "@aws-sdk/client-s3";

export function createS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "ap-northeast-2"
  });
}

export function getStorageConfig() {
  return {
    bucket: process.env.S3_BUCKET ?? "",
    uploadPrefix: process.env.S3_UPLOAD_PREFIX ?? "uploads",
    cdnBaseUrl: process.env.CDN_BASE_URL ?? ""
  };
}
