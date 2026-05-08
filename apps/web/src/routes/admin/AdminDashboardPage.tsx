import type { AdminSession, AdminUserSummary, GameDetail, UploadRecord } from "@return-game/shared";
import { UploadCloud, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiGetAdmin, apiPostForm, getAdminSession, getAdminToken } from "../../api/client";

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
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const payload = await apiGetAdmin<UploadResponse>(`/uploads/${uploadId}`);

      if (payload.upload.status === "COMPLETED" && payload.game) {
        setUploadedGame(payload.game);
        setStatus("Upload completed.");
        return;
      }

      if (payload.upload.status === "FAILED") {
        throw new Error(payload.upload.errorMessage ?? "Upload failed.");
      }

      setStatus(`Uploading to S3... (${payload.upload.status})`);
    }

    throw new Error("Upload is still processing. Check again later.");
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
      setStatus("Sign in before uploading.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("creatorIds", JSON.stringify(selectedCreators.map((creator) => creator.id)));

    setStatus("Uploading and validating zip...");
    setUploadedGame(null);

    try {
      const payload = await apiPostForm<UploadResponse>("/uploads/webgl-zip", formData);
      if (payload.game) {
        setUploadedGame(payload.game);
        setStatus("Upload completed.");
      } else {
        setStatus("Zip validated. Uploading to S3...");
        await pollUpload(payload.upload.id);
      }
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
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
          제작자 표시명
          <input name="developer" placeholder="나선욱" />
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
          <input
            value={creatorQuery}
            onChange={(event) => void searchCreators(event.target.value)}
            placeholder="이름 검색"
          />
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
          <textarea name="description" placeholder="게임 조작법이나 설명을 줄바꿈으로 입력하세요." rows={6} />
        </label>
        <label>
          Unity WebGL zip
          <input name="file" type="file" accept=".zip,application/zip" required />
        </label>
        <button className="primary-action" type="submit">
          <UploadCloud aria-hidden="true" />
          Upload zip
        </button>
      </form>
      {status && <p className="status-text">{status}</p>}
      {uploadedGame && (
        <div className="upload-result">
          <strong>{uploadedGame.title}</strong>
          <Link to={`/games/${uploadedGame.slug}`}>Open game</Link>
          <Link to={`/admin/games/${uploadedGame.id}`}>Manage game</Link>
        </div>
      )}
    </section>
  );
}
