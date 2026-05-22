import type {
  AdminGameRecord,
  AdminSession,
  GameComment,
  UploadProgress,
  UploadRecord
} from "@return-game/shared";
import { Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  apiDeleteAdmin,
  apiGetAdmin,
  apiPatchAdmin,
  apiPatchForm,
  apiPostForm,
  getAdminSession
} from "../../api/client";
import { formatKoreanDateTime } from "../../utils/date";
import { resizeThumbnail } from "../../utils/thumbnail";
import {
  createUploadEtaBaseline,
  UPLOAD_POLL_INTERVAL_MS,
  type UploadEtaSample
} from "../../utils/uploadEta";
import { UploadProgressPanel } from "./UploadProgressPanel";
import { ThumbnailImageInfo, WebglQuestionInfo, WebglZipInfo } from "./WebglZipInfo";

interface AdminGameResponse {
  game: AdminGameRecord;
}

interface AdminCommentsResponse {
  comments: GameComment[];
}

interface UploadResponse {
  upload: UploadRecord;
  game?: AdminGameRecord | null;
}

function renderDifficulty(score?: number) {
  const normalized = Math.max(0, Math.min(5, score ?? 0));
  return `${"★".repeat(normalized)}${"☆".repeat(5 - normalized)}`;
}

function normalizeCreatorNames(names: string[]) {
  return names.map((name) => name.trim().replace(/\s+/g, " ")).filter(Boolean);
}

function uploadStatusMessage(upload: UploadRecord, elapsedMinutes?: number) {
  const progress = upload.progress;
  const percent = progress ? ` ${Math.min(100, Math.max(0, progress.percent))}%` : "";
  const elapsed = elapsedMinutes ? `, 약 ${elapsedMinutes}분 경과` : "";

  switch (upload.status) {
    case "RECEIVED":
      return "업데이트 요청을 접수했습니다.";
    case "VALIDATING":
      return "zip 파일을 검증하고 있습니다.";
    case "PROCESSING":
      return `S3에 게임 파일을 업로드하는 중입니다.${percent}${elapsed}`;
    case "COMPLETED":
      return "게임 실행 파일 업데이트가 완료되었습니다.";
    case "FAILED":
      return upload.errorMessage ?? "게임 파일 업데이트에 실패했습니다.";
    default:
      return "업데이트 상태를 확인하는 중입니다.";
  }
}

export function AdminGameEditPage() {
  const admin = getAdminSession<AdminSession>();
  const isSuperAdmin = admin?.role === "SUPER_ADMIN";
  const navigate = useNavigate();
  const { id } = useParams();
  const [game, setGame] = useState<AdminGameRecord | null>(null);
  const [comments, setComments] = useState<GameComment[]>([]);
  const [status, setStatus] = useState("게임 정보를 불러오는 중입니다.");
  const [commentStatus, setCommentStatus] = useState("");
  const [versionStatus, setVersionStatus] = useState("");
  const [versionProgress, setVersionProgress] = useState<UploadProgress | null>(null);
  const [creatorNames, setCreatorNames] = useState<string[]>([""]);
  const versionEtaBaselineRef = useRef<UploadEtaSample | null>(null);

  function updateVersionProgress(progress: UploadProgress | null) {
    if (!progress || progress.uploadedBytes <= 0 || progress.totalBytes <= 0) {
      setVersionProgress(progress);
      return;
    }

    const baseline = versionEtaBaselineRef.current;
    if (!baseline || progress.uploadedBytes < baseline.uploadedBytes) {
      versionEtaBaselineRef.current = {
        uploadedBytes: progress.uploadedBytes,
        observedAt: Date.now()
      };
    }

    setVersionProgress(progress);
  }

  async function loadGame(gameId: string) {
    const [gamePayload, commentsPayload] = await Promise.all([
      apiGetAdmin<AdminGameResponse>(`/admin/games/${gameId}`),
      apiGetAdmin<AdminCommentsResponse>(`/admin/games/${gameId}/comments`)
    ]);
    setGame(gamePayload.game);
    setCreatorNames(
      gamePayload.game.creatorNames?.length
        ? gamePayload.game.creatorNames
        : gamePayload.game.developer
          ? gamePayload.game.developer.split(",").map((name) => name.trim()).filter(Boolean)
          : [""]
    );
    setComments(commentsPayload.comments);
  }

  async function pollUpload(uploadId: string) {
    const startedAt = Date.now();

    for (let attempt = 0; attempt < 3600; attempt += 1) {
      const payload = await apiGetAdmin<UploadResponse>(`/uploads/${uploadId}`);
      const elapsedMinutes = Math.max(1, Math.ceil((Date.now() - startedAt) / 60000));
      updateVersionProgress(payload.upload.progress ?? null);
      setVersionStatus(uploadStatusMessage(payload.upload, elapsedMinutes));

      if (payload.upload.status === "COMPLETED") {
        if (id) await loadGame(id);
        setVersionStatus("게임 실행 파일 업데이트가 완료되었습니다.");
        return;
      }

      if (payload.upload.status === "FAILED") {
        throw new Error(payload.upload.errorMessage ?? "게임 파일 업데이트에 실패했습니다.");
      }

      await new Promise((resolve) => window.setTimeout(resolve, UPLOAD_POLL_INTERVAL_MS));
    }

    throw new Error("업데이트가 오래 걸리고 있습니다. 서버에서는 계속 처리 중일 수 있으니 잠시 후 다시 확인하세요.");
  }

  useEffect(() => {
    if (!id) return;

    loadGame(id)
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "게임 정보를 불러오지 못했습니다."));
  }, [id]);

  function updateCreatorName(index: number, value: string) {
    setCreatorNames((current) => current.map((name, currentIndex) => (currentIndex === index ? value : name)));
  }

  function addCreatorName() {
    setCreatorNames((current) => [...current, ""]);
  }

  function removeCreatorName(index: number) {
    setCreatorNames((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0 ? next : [""];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;

    const formData = new FormData(event.currentTarget);
    setStatus("저장하는 중입니다.");

    try {
      const payload = await apiPatchAdmin<AdminGameResponse>(`/admin/games/${id}`, {
        title: String(formData.get("title") ?? ""),
        year: String(formData.get("year") ?? ""),
        difficulty: String(formData.get("difficulty") ?? ""),
        shortDescription: String(formData.get("shortDescription") ?? ""),
        description: String(formData.get("description") ?? ""),
        copyrightNotice: String(formData.get("copyrightNotice") ?? ""),
        status: game?.status ?? "HIDDEN",
        creatorNames: normalizeCreatorNames(creatorNames)
      });
      setGame(payload.game);
      setCreatorNames(payload.game.creatorNames?.length ? payload.game.creatorNames : [""]);
      setStatus("저장되었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  }

  async function handleThumbnailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const thumbnail = formData.get("thumbnail");
    if (!(thumbnail instanceof File) || thumbnail.size === 0) {
      setStatus("교체할 썸네일 이미지를 선택하세요.");
      return;
    }

    setStatus("썸네일을 업로드하는 중입니다.");

    try {
      formData.set("thumbnail", await resizeThumbnail(thumbnail));
      const payload = await apiPatchForm<AdminGameResponse>(`/uploads/games/${id}/thumbnail`, formData);
      setGame(payload.game);
      form.reset();
      setStatus("썸네일이 저장되었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "썸네일 저장에 실패했습니다.");
    }
  }

  async function handleVersionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const zip = formData.get("file");
    if (!(zip instanceof File) || zip.size === 0) {
      setVersionStatus("업데이트할 Unity WebGL zip 파일을 선택하세요.");
      return;
    }

    setVersionStatus("zip 파일을 업로드하고 검증하는 중입니다.");
    versionEtaBaselineRef.current = null;
    updateVersionProgress(null);

    try {
      const payload = await apiPostForm<UploadResponse>(`/uploads/games/${id}/webgl-zip`, formData);
      versionEtaBaselineRef.current = createUploadEtaBaseline();
      updateVersionProgress(payload.upload.progress ?? null);
      setVersionStatus(uploadStatusMessage(payload.upload));
      await pollUpload(payload.upload.id);
      form.reset();
    } catch (error) {
      setVersionStatus(error instanceof Error ? error.message : "게임 파일 업데이트에 실패했습니다.");
    }
  }

  async function handleToggleStatus() {
    if (!id || !game || !isSuperAdmin) return;

    const nextStatus = game.status === "PUBLIC" ? "HIDDEN" : "PUBLIC";
    setStatus(nextStatus === "PUBLIC" ? "공개 상태로 변경하는 중입니다." : "숨김 상태로 변경하는 중입니다.");

    try {
      const payload = await apiPatchAdmin<AdminGameResponse>(`/admin/games/${id}`, {
        title: game.title,
        year: game.year ?? "",
        difficulty: game.difficulty ?? "",
        shortDescription: game.shortDescription,
        description: game.description ?? "",
        copyrightNotice: game.copyrightNotice ?? "",
        status: nextStatus,
        creatorNames: normalizeCreatorNames(creatorNames)
      });
      setGame(payload.game);
      setCreatorNames(payload.game.creatorNames?.length ? payload.game.creatorNames : [""]);
      setStatus(nextStatus === "PUBLIC" ? "게임을 공개했습니다." : "게임을 숨김 처리했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "공개 상태 변경에 실패했습니다.");
    }
  }

  async function handleDeleteGame() {
    if (!id || !game) return;
    if (
      !window.confirm(
        "정말 삭제하시겠습니까?\n필요하다면 공개 상태를 숨김으로 바꾸는 것도 가능합니다.\n공개 상태만을 바꾸려면 취소를 눌러주세요."
      )
    ) {
      return;
    }

    setStatus("게임을 완전삭제하는 중입니다.");
    try {
      await apiDeleteAdmin(`/admin/games/${id}`, { confirm: game.slug });
      navigate("/admin/games", { replace: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "게임 삭제에 실패했습니다.");
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm("댓글을 관리자 권한으로 삭제할까요?")) return;

    setCommentStatus("");
    try {
      await apiDeleteAdmin(`/admin/comments/${commentId}`);
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? { ...comment, deletedAt: new Date().toISOString() } : comment
        )
      );
    } catch (error) {
      setCommentStatus(error instanceof Error ? error.message : "댓글 삭제에 실패했습니다.");
    }
  }

  return (
    <section className="admin-panel wide">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Game editor</p>
          <div className="admin-edit-title-row">
            <h1>{game?.title ?? "게임 수정"}</h1>
            {game && (
              <button
                className={`status-pill status-toggle ${game.status.toLowerCase()}`}
                type="button"
                disabled={!isSuperAdmin}
                onClick={() => void handleToggleStatus()}
                title={isSuperAdmin ? "클릭하면 공개 상태가 변경됩니다." : "총 관리자만 변경할 수 있습니다."}
              >
                {game.status === "PUBLIC" ? "공개" : "숨김"}
              </button>
            )}
          </div>
        </div>
        <Link className="secondary-action" to="/admin/games">
          목록으로
        </Link>
      </div>

      {status && <p className="status-text">{status}</p>}
      {game && (
        <>
          <form className="admin-edit-form" onSubmit={handleSubmit}>
            <label>
              게임 제목
              <input name="title" defaultValue={game.title} required />
            </label>
            <label>
              Slug
              <input value={game.slug} disabled />
            </label>
            <label>
              제작연도
              <input name="year" defaultValue={game.year ?? ""} type="number" min="2000" max="2100" />
            </label>
            <label>
              난이도
              <select name="difficulty" defaultValue={game.difficulty ?? ""}>
                <option value="">미입력</option>
                <option value="1">{renderDifficulty(1)}</option>
                <option value="2">{renderDifficulty(2)}</option>
                <option value="3">{renderDifficulty(3)}</option>
                <option value="4">{renderDifficulty(4)}</option>
                <option value="5">{renderDifficulty(5)}</option>
              </select>
            </label>
            <label className="admin-form-wide">
              한줄설명
              <input name="shortDescription" defaultValue={game.shortDescription} required />
            </label>
            <div className="admin-form-wide creator-name-editor">
              <div className="admin-inline-label">
                <strong>제작자 이름</strong>
              </div>
              {creatorNames.map((creatorName, index) => (
                <div
                  className={`creator-name-row ${index === creatorNames.length - 1 ? "has-add-button" : ""}`}
                  key={`${index}-${creatorNames.length}`}
                >
                  <input
                    value={creatorName}
                    onChange={(event) => updateCreatorName(index, event.target.value)}
                    placeholder="제작자 이름"
                  />
                  {index === creatorNames.length - 1 && (
                    <button
                      className="secondary-action icon-only-action"
                      type="button"
                      onClick={addCreatorName}
                      aria-label="제작자 입력칸 추가"
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="secondary-action icon-only-action"
                    type="button"
                    onClick={() => removeCreatorName(index)}
                    aria-label="제작자 입력칸 삭제"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <label className="admin-form-wide">
              게임 설명
              <textarea name="description" defaultValue={game.description ?? ""} rows={6} />
            </label>
            <label className="admin-form-wide">
              저작권 안내
              <textarea
                name="copyrightNotice"
                defaultValue={game.copyrightNotice ?? ""}
                placeholder="외부 에셋, 이미지, 사운드, 라이선스 등 저작권 관련 안내를 입력하세요. 선택 사항입니다."
                rows={3}
              />
            </label>
            <div className="admin-form-actions">
              <button className="primary-action" type="submit">
                저장
              </button>
            </div>
            <div className="admin-section-divider" aria-hidden="true" />
          </form>

          <form className="admin-edit-form" onSubmit={handleThumbnailSubmit}>
            <div className="admin-form-wide">
              <p className="eyebrow">Thumbnail</p>
              <div className="app-file-update-title-row thumbnail-title-row">
                <h2>썸네일 이미지 교체</h2>
                <ThumbnailImageInfo className="thumbnail-info" placement="edit" />
              </div>
              {game.thumbnailUrl && <img className="admin-thumbnail-preview" src={game.thumbnailUrl} alt="" />}
            </div>
            <label className="admin-form-wide">
              <input name="thumbnail" type="file" accept="image/*" required />
            </label>
            <div className="admin-form-actions">
              <button className="primary-action" type="submit">
                썸네일 저장
              </button>
            </div>
            <div className="admin-section-divider" aria-hidden="true" />
          </form>

          <form className="admin-edit-form" onSubmit={handleVersionSubmit}>
            <div className="admin-form-wide app-file-update-heading">
              <div>
                <p className="eyebrow">WebGL build</p>
                <div className="app-file-update-title-row">
                  <h2 className="app-file-update-title">게임 파일 업데이트</h2>
                  <WebglZipInfo className="title-webgl-info" label="" placement="edit" />
                  <WebglQuestionInfo className="title-webgl-info" label="" placement="edit" />
                </div>
              </div>
            </div>
            <label className="admin-form-wide">
              <input name="file" type="file" accept=".zip,application/zip" required />
            </label>
            <div className="admin-form-actions">
              <button className="primary-action" type="submit">
                게임 파일 업데이트
              </button>
              {isSuperAdmin && (
                <button className="danger-action" type="button" onClick={() => void handleDeleteGame()}>
                  게임 삭제
                </button>
              )}
            </div>
            {versionProgress && (
              <div className="admin-form-wide">
                <UploadProgressPanel progress={versionProgress} etaBaseline={versionEtaBaselineRef.current} />
              </div>
            )}
            {versionStatus && <p className="status-text admin-form-wide">{versionStatus}</p>}
          </form>

        </>
      )}

      <section className="admin-comments-panel">
        <div className="admin-page-header compact-row">
          <div>
            <p className="eyebrow">Comments</p>
            <h2>댓글 관리</h2>
          </div>
          <span>{comments.length}개</span>
        </div>
        {commentStatus && <p className="status-text">{commentStatus}</p>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>닉네임</th>
                <th>내용</th>
                <th>IP</th>
                <th>작성일</th>
                <th>삭제 여부</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => (
                <tr key={comment.id} className={comment.deletedAt ? "muted-row" : undefined}>
                  <td>{comment.author}</td>
                  <td className="admin-comment-body">{comment.body}</td>
                  <td>{comment.authorIp ?? "-"}</td>
                  <td>{formatKoreanDateTime(comment.createdAt)}</td>
                  <td>{comment.deletedAt ? formatKoreanDateTime(comment.deletedAt) : "활성"}</td>
                  <td>
                    <button
                      className="table-danger-button"
                      type="button"
                      disabled={Boolean(comment.deletedAt)}
                      onClick={() => void handleDeleteComment(comment.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
