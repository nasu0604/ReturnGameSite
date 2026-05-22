import type { AdminSession, GameDetail, UploadProgress, UploadRecord } from "@return-game/shared";
import { Plus, UploadCloud, X } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { apiGetAdmin, apiPostForm, getAdminSession, getAdminToken } from "../../api/client";
import { resizeThumbnail } from "../../utils/thumbnail";
import {
  createUploadEtaBaseline,
  UPLOAD_POLL_INTERVAL_MS,
  type UploadEtaSample
} from "../../utils/uploadEta";
import { UploadProgressPanel } from "./UploadProgressPanel";
import { ThumbnailImageInfo, WebglZipInfo } from "./WebglZipInfo";

interface UploadResponse {
  upload: UploadRecord;
  game?: GameDetail | null;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function uploadStatusMessage(upload: UploadRecord) {
  const progress = upload.progress;
  const percent = progress ? ` ${Math.min(100, Math.max(0, progress.percent))}%` : "";

  switch (upload.status) {
    case "RECEIVED":
      return "업로드 요청을 접수했습니다.";
    case "VALIDATING":
      return "zip 파일을 검증하고 있습니다.";
    case "PROCESSING":
      return `S3에 게임 파일을 업로드하는 중입니다.${percent}`;
    case "COMPLETED":
      return "업로드가 완료되었습니다.";
    case "FAILED":
      return upload.errorMessage ?? "업로드에 실패했습니다.";
    default:
      return "업로드 상태를 확인하는 중입니다.";
  }
}

export function AdminDashboardPage() {
  const admin = getAdminSession<AdminSession>();
  const [status, setStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadedGame, setUploadedGame] = useState<GameDetail | null>(null);
  const uploadEtaBaselineRef = useRef<UploadEtaSample | null>(null);
  const [creatorNames, setCreatorNames] = useState<string[]>(
    admin?.role === "MANAGER" && admin.name ? [admin.name] : [""],
  );

  function updateUploadProgress(progress: UploadProgress | null) {
    if (!progress || progress.uploadedBytes <= 0 || progress.totalBytes <= 0) {
      setUploadProgress(progress);
      return;
    }

    const baseline = uploadEtaBaselineRef.current;
    if (!baseline || progress.uploadedBytes < baseline.uploadedBytes) {
      uploadEtaBaselineRef.current = {
        uploadedBytes: progress.uploadedBytes,
        observedAt: Date.now()
      };
    }

    setUploadProgress(progress);
  }

  async function pollUpload(uploadId: string) {
    for (let attempt = 0; attempt < 3600; attempt += 1) {
      const response = await apiGetAdmin<UploadResponse>(`/uploads/${uploadId}`);
      const record = response.upload;
      updateUploadProgress(record.progress ?? null);
      setStatus(uploadStatusMessage(record));

      if (record.status === "COMPLETED") {
        setStatus("업로드가 완료되었습니다.");
        setUploadedGame(response.game ?? null);
        return;
      }

      if (record.status === "FAILED") {
        throw new Error(record.errorMessage ?? "업로드에 실패했습니다.");
      }

      await wait(UPLOAD_POLL_INTERVAL_MS);
    }

    throw new Error("업로드가 아직 처리 중입니다. 잠시 후 다시 확인하세요.");
  }

  function normalizeCreatorNames(names: string[]) {
    return names.map((name) => name.trim()).filter(Boolean);
  }

  function updateCreatorName(index: number, value: string) {
    setCreatorNames((current) => current.map((name, itemIndex) => (itemIndex === index ? value : name)));
  }

  function addCreatorName() {
    setCreatorNames((current) => [...current, ""]);
  }

  function removeCreatorName(index: number) {
    setCreatorNames((current) => {
      if (current.length === 1) {
        return [""];
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAdminToken();
    if (!token) {
      setStatus("관리자 로그인이 필요합니다.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("creatorNames", JSON.stringify(normalizeCreatorNames(creatorNames)));

    const thumbnailFile = formData.get("thumbnail");
    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      try {
        setStatus("썸네일 이미지를 변환하는 중입니다...");
        const resizedThumbnail = await resizeThumbnail(thumbnailFile);
        formData.set("thumbnail", resizedThumbnail);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "썸네일 이미지를 변환하지 못했습니다.");
        return;
      }
    }

    setStatus("zip 파일을 검증하고 업로드하는 중입니다...");
    uploadEtaBaselineRef.current = null;
    updateUploadProgress(null);
    setUploadedGame(null);

    try {
      const response = await apiPostForm<UploadResponse>("/uploads/webgl-zip", formData);
      uploadEtaBaselineRef.current = createUploadEtaBaseline();
      updateUploadProgress(response.upload.progress ?? null);
      setStatus(uploadStatusMessage(response.upload));

      if (response.upload.status === "COMPLETED") {
        setStatus("업로드가 완료되었습니다.");
        setUploadedGame(response.game ?? null);
      } else {
        await pollUpload(response.upload.id);
      }

      form.reset();
      setCreatorNames(admin?.role === "MANAGER" && admin.name ? [admin.name] : [""]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.");
    }
  }

  return (
    <section className="admin-panel">
      <div className="section-heading compact">
        <p className="eyebrow">upload</p>
        <h1>게임 업로드</h1>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label>
          게임 이름
          <input name="title" placeholder="사이트에 보일 이름" required />
        </label>

        <label>
          Slug
          <input name="slug" placeholder="링크에 보일 이름" required />
        </label>

        <label>
          제작 연도
          <input name="year" type="number" placeholder="제작 연도" required />
        </label>

        <label>
          난이도
          <select name="difficulty" defaultValue="3" required>
            <option value="1">★☆☆☆☆</option>
            <option value="2">★★☆☆☆</option>
            <option value="3">★★★☆☆</option>
            <option value="4">★★★★☆</option>
            <option value="5">★★★★★</option>
          </select>
        </label>

        <label>
          한줄 설명
          <input name="shortDescription" placeholder="한줄 설명" required />
        </label>

        <div className="admin-form-wide creator-name-field">
          <span className="admin-field-label">제작자 이름</span>
          <div className="creator-name-list">
            {creatorNames.map((name, index) => (
              <div className="creator-name-row" key={index}>
                <input
                  aria-label={`제작자 이름 ${index + 1}`}
                  name="creatorName"
                  onChange={(event) => updateCreatorName(index, event.target.value)}
                  placeholder="제작자 이름"
                  value={name}
                />
                <div className="creator-name-actions">
                  {index === creatorNames.length - 1 && (
                    <button aria-label="제작자 추가" onClick={addCreatorName} type="button">
                      <Plus size={16} />
                    </button>
                  )}
                  <button aria-label="제작자 삭제" onClick={() => removeCreatorName(index)} type="button">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="admin-form-wide">
          게임 설명
          <textarea
            name="description"
            placeholder="게임 설명 또는 조작법"
            required
            rows={6}
          />
        </label>

        <label className="admin-form-wide">
          저작권 안내 (선택)
          <textarea
            name="copyrightNotice"
            placeholder="외부 에셋, 이미지, 사운드, 라이선스 등"
            rows={3}
          />
        </label>

        <label className="admin-form-wide app-file-field">
          <span className="app-file-label-row">
            썸네일 이미지
            <ThumbnailImageInfo placement="upload" />
          </span>
          <input accept="image/*" name="thumbnail" type="file" />
        </label>

        <label className="admin-form-wide app-file-field">
          <span className="app-file-label-row">
            Unity WebGL Zip
            <WebglZipInfo placement="upload" />
          </span>
          <input accept=".zip,application/zip" name="file" required type="file" />
        </label>

        {uploadProgress && (
          <UploadProgressPanel progress={uploadProgress} etaBaseline={uploadEtaBaselineRef.current} />
        )}

        <button className="admin-primary-btn" type="submit">
          <UploadCloud size={18} />
          업로드
        </button>
      </form>

      {status && <p className="admin-status">{status}</p>}
    </section>
  );
}
