import type { UploadProgress } from "@return-game/shared";

export interface UploadEtaSample {
  uploadedBytes: number;
  observedAt: number;
}

export const UPLOAD_POLL_INTERVAL_MS = 1000;

export function createUploadEtaBaseline(now = Date.now()): UploadEtaSample {
  return {
    uploadedBytes: 0,
    observedAt: now
  };
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0MB";

  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

export function formatRemainingTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "계산 중";

  const roundedSeconds = Math.ceil(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (minutes <= 0) return `약 ${remainingSeconds}초`;
  if (remainingSeconds === 0) return `약 ${minutes}분`;

  return `약 ${minutes}분 ${remainingSeconds}초`;
}

export function getUploadEtaLabel(progress: UploadProgress, baseline: UploadEtaSample | null, now = Date.now()) {
  if (progress.totalBytes <= 0) return "계산 중";
  if (progress.percent >= 100 || progress.uploadedBytes >= progress.totalBytes) return "완료";
  if (!baseline || progress.uploadedBytes <= baseline.uploadedBytes) return "계산 중";

  const elapsedSeconds = (now - baseline.observedAt) / 1000;
  const uploadedSinceBaseline = progress.uploadedBytes - baseline.uploadedBytes;
  const bytesPerSecond = uploadedSinceBaseline / elapsedSeconds;

  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "계산 중";

  const remainingBytes = Math.max(0, progress.totalBytes - progress.uploadedBytes);
  return formatRemainingTime(remainingBytes / bytesPerSecond);
}
