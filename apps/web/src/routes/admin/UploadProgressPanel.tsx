import type { UploadProgress } from "@return-game/shared";
import { formatBytes, getUploadEtaLabel, type UploadEtaSample } from "../../utils/uploadEta";

interface UploadProgressPanelProps {
  progress: UploadProgress;
  etaBaseline: UploadEtaSample | null;
}

export function UploadProgressPanel({ progress, etaBaseline }: UploadProgressPanelProps) {
  const percent = Math.min(100, Math.max(0, progress.percent));
  const etaLabel = getUploadEtaLabel(progress, etaBaseline);

  return (
    <div className="upload-progress" role="status">
      <div className="upload-progress-header">
        <span>업로드 진행률 </span>
        <strong>{percent}%</strong>
      </div>
      <p>
        {progress.uploadedFiles}/{progress.totalFiles}개 파일
        {progress.totalBytes > 0 ? ` · ${formatBytes(progress.uploadedBytes)} / ${formatBytes(progress.totalBytes)}` : ""}
        {progress.currentFile ? ` · ${progress.currentFile}` : ""}
      </p>
      <div className="upload-progress-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
