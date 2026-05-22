import type { AdminSession, GameDetail, UploadProgress, UploadRecord } from "@return-game/shared";
import { Plus, UploadCloud, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiGetAdmin, apiPostForm, getAdminSession, getAdminToken } from "../../api/client";
import { resizeThumbnail } from "../../utils/thumbnail";
import { ThumbnailImageInfo, WebglZipInfo } from "./WebglZipInfo";

interface UploadResponse {
  upload: UploadRecord;
  game?: GameDetail | null;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function AdminDashboardPage() {
  const admin = getAdminSession<AdminSession>();
  const [status, setStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadedGame, setUploadedGame] = useState<GameDetail | null>(null);
  const [creatorNames, setCreatorNames] = useState<string[]>(
    admin?.role === "MANAGER" && admin.name ? [admin.name] : [""],
  );

  async function pollUpload(uploadId: string) {
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      const response = await apiGetAdmin<UploadResponse>(`/uploads/${uploadId}`);
      const record = response.upload;
      setUploadProgress(record.progress ?? null);

      if (record.status === "COMPLETED") {
        setStatus("업로드가 완료되었습니다.");
        setUploadedGame(response.game ?? null);
        return;
      }

      if (record.status === "FAILED") {
        throw new Error(record.errorMessage ?? "업로드에 실패했습니다.");
      }

      const percent = record.progress?.percent ?? 0;
      const currentFile = record.progress?.currentFile ? ` · ${record.progress.currentFile}` : "";
      setStatus(`업로드 처리 중... ${percent}%${currentFile}`);
      await wait(3000);
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
    setUploadProgress(null);
    setUploadedGame(null);

    try {
      const response = await apiPostForm<UploadResponse>("/uploads/webgl-zip", formData);
      setUploadProgress(response.upload.progress ?? null);

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
          <input name="shortDescription" defaultValue="티어를 합쳐 최고 티어에 도달하라" placeholder="한줄 설명" required />
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
            Unity WebGL zip
            <WebglZipInfo placement="upload" />
          </span>
          <input accept=".zip,application/zip" name="zip" required type="file" />
        </label>

        {uploadProgress && (
          <div className="upload-progress" role="status">
            <div className="upload-progress-header">
              <span>업로드 진행률</span>
              <strong>{uploadProgress.percent}%</strong>
            </div>
            <div className="upload-progress-track">
              <div className="upload-progress-bar" aria-label="업로드 진행률" style={{ width: `${uploadProgress.percent}%` }} />
            </div>
            <p>
              {uploadProgress.uploadedFiles}/{uploadProgress.totalFiles} files
              {uploadProgress.currentFile ? ` · ${uploadProgress.currentFile}` : ""}
            </p>
          </div>
        )}

        <button className="admin-primary-btn" type="submit">
          <UploadCloud size={18} />
          업로드
        </button>
      </form>

      {status && <p className="admin-status">{status}</p>}

      {uploadedGame && (
        <div className="upload-result-card">
          <p>업로드된 게임</p>
          <h2>{uploadedGame.title}</h2>
          <div className="upload-result-actions">
            <Link to={`/games/${uploadedGame.slug}`}>게임 보기</Link>
            <Link to={`/admin/games/${uploadedGame.id}`}>관리하기</Link>
          </div>
        </div>
      )}
    </section>
  );
}
