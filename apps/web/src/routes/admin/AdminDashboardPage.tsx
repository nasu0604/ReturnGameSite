import type { AdminSession, AdminUserSummary, GameDetail, UploadProgress, UploadRecord } from "@return-game/shared";
import { UploadCloud, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiGetAdmin, apiPostForm, getAdminSession, getAdminToken } from "../../api/client";
import { resizeThumbnail } from "../../utils/thumbnail";

interface UploadResponse {
  upload: UploadRecord;
  game?: GameDetail | null;
}

interface UserSearchResponse {
  users: AdminUserSummary[];
}

export function AdminDashboardPage() {
  const admin = getAdminSession<AdminSession>();
  const [status, setStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadedGame, setUploadedGame] = useState<GameDetail | null>(null);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorResults, setCreatorResults] = useState<AdminUserSummary[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<AdminUserSummary[]>(
    admin?.role === "MANAGER" && admin.id
      ? [
          {
            id: admin.id,
            name: admin.name,
            loginId: admin.loginId,
            role: admin.role,
            status: admin.status
          }
        ]
      : []
  );

  async function pollUpload(uploadId: string) {
    const startedAt = Date.now();

    for (let attempt = 0; attempt < 1200; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const payload = await apiGetAdmin<UploadResponse>(`/uploads/${uploadId}`);
      const elapsedMinutes = Math.max(1, Math.ceil((Date.now() - startedAt) / 60000));
      setUploadProgress(payload.upload.progress ?? null);

      if (payload.upload.status === "COMPLETED" && payload.game) {
        setUploadedGame(payload.game);
        setStatus("업로드가 완료되었습니다.");
        return;
      }

      if (payload.upload.status === "FAILED") {
        throw new Error(payload.upload.errorMessage ?? "업로드에 실패했습니다.");
      }

      setStatus(`S3에 업로드하는 중입니다. (${payload.upload.status}, 약 ${elapsedMinutes}분 경과)`);
    }

    throw new Error("업로드가 오래 걸리고 있습니다. 게임 관리 화면에서 상태를 다시 확인하세요.");
  }

  async function searchCreators(query: string) {
    setCreatorQuery(query);
    if (!query.trim()) {
      setCreatorResults([]);
      return;
    }

    const payload = await apiGetAdmin<UserSearchResponse>(`/admin/users/search?q=${encodeURIComponent(query)}`);
    setCreatorResults(payload.users);
  }

  function addCreator(user: AdminUserSummary) {
    setSelectedCreators((current) =>
      current.some((creator) => creator.id === user.id) ? current : [...current, user]
    );
    setCreatorQuery("");
    setCreatorResults([]);
  }

  function removeCreator(userId: string) {
    if (admin?.role === "MANAGER" && userId === admin.id) return;
    setSelectedCreators((current) => current.filter((creator) => creator.id !== userId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!getAdminToken()) {
      setStatus("업로드하려면 먼저 로그인해야 합니다.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("creatorIds", JSON.stringify(selectedCreators.map((creator) => creator.id)));
    const thumbnail = formData.get("thumbnail");
    if (thumbnail instanceof File && thumbnail.size > 0) {
      formData.set("thumbnail", await resizeThumbnail(thumbnail));
    } else {
      formData.delete("thumbnail");
    }

    setStatus("zip 파일을 업로드하고 검증하는 중입니다.");
    setUploadedGame(null);
    setUploadProgress(null);

    try {
      const payload = await apiPostForm<UploadResponse>("/uploads/webgl-zip", formData);
      if (payload.game) {
        setUploadedGame(payload.game);
        setUploadProgress(payload.upload.progress ?? null);
        setStatus("업로드가 완료되었습니다.");
      } else {
        setUploadProgress(payload.upload.progress ?? null);
        setStatus("zip 검증이 끝났습니다. S3에 업로드하는 중입니다.");
        await pollUpload(payload.upload.id);
      }
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "업로드에 실패했습니다.");
    }
  }

  return (
    <section className="admin-panel">
      <div className="section-heading compact">
        <p className="eyebrow">Operations</p>
        <h1>WebGL 업로드</h1>
      </div>
      <form className="upload-form" onSubmit={handleSubmit}>
        <label>
          게임 이름
          <input name="title" placeholder="RasingTier" required />
        </label>
        <label>
          Slug
          <input name="slug" placeholder="rasing-tier" />
        </label>
        <label>
          제작연도
          <input name="year" placeholder="2026" type="number" min="2000" max="2100" />
        </label>
        <label>
          난이도
          <select name="difficulty" defaultValue="3">
            <option value="1">★☆☆☆☆</option>
            <option value="2">★★☆☆☆</option>
            <option value="3">★★★☆☆</option>
            <option value="4">★★★★☆</option>
            <option value="5">★★★★★</option>
          </select>
        </label>
        <label>
          한줄설명
          <input name="shortDescription" placeholder="티어를 합쳐 최고 티어에 도달하라" required />
        </label>
        <label>
          제작자 계정 연결
          <input value={creatorQuery} onChange={(event) => void searchCreators(event.target.value)} placeholder="이름 검색" />
        </label>
        {creatorResults.length > 0 && (
          <div className="creator-search-results">
            {creatorResults.map((user) => (
              <button type="button" key={user.id} onClick={() => addCreator(user)}>
                {user.name}({user.loginId})
              </button>
            ))}
          </div>
        )}
        {selectedCreators.length > 0 && (
          <div className="creator-chip-row">
            {selectedCreators.map((creator) => (
              <span className="creator-chip" key={creator.id}>
                {creator.name}({creator.loginId})
                <button type="button" onClick={() => removeCreator(creator.id)}>
                  <X aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <label>
          게임 설명
          <textarea name="description" placeholder="게임 설명과 조작법을 줄바꿈으로 입력하세요." rows={6} />
        </label>
        <label>
          썸네일 이미지
          <input name="thumbnail" type="file" accept="image/*" required />
        </label>
        <label>
          Unity WebGL zip
          <input name="file" type="file" accept=".zip,application/zip" required />
        </label>
        <button className="primary-action" type="submit">
          <UploadCloud aria-hidden="true" />
          업로드
        </button>
      </form>
      {status && <p className="status-text">{status}</p>}
      {uploadProgress && (
        <div className="upload-progress">
          <div className="upload-progress-bar" aria-label="업로드 진행률">
            <span style={{ width: `${Math.min(100, Math.max(0, uploadProgress.percent))}%` }} />
          </div>
          <p>
            {uploadProgress.percent}% · {uploadProgress.uploadedFiles}/{uploadProgress.totalFiles} files ·{" "}
            {Math.round(uploadProgress.uploadedBytes / 1024 / 1024)}MB /{" "}
            {Math.round(uploadProgress.totalBytes / 1024 / 1024)}MB
          </p>
          {uploadProgress.currentFile && <p className="muted-text">현재 파일: {uploadProgress.currentFile}</p>}
        </div>
      )}
      {uploadedGame && (
        <div className="upload-result">
          <strong>{uploadedGame.title}</strong>
          <Link to={`/games/${uploadedGame.slug}`}>게임 보기</Link>
          <Link to={`/admin/games/${uploadedGame.id}`}>관리하기</Link>
        </div>
      )}
    </section>
  );
}
