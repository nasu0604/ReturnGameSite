import type { AdminGameRecord, AdminSession, AdminUserSummary, GameComment } from "@return-game/shared";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiDeleteAdmin, apiGetAdmin, apiPatchAdmin, getAdminSession } from "../../api/client";

interface AdminGameResponse {
  game: AdminGameRecord;
}

interface AdminCommentsResponse {
  comments: GameComment[];
}

interface UserSearchResponse {
  users: AdminUserSummary[];
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function AdminGameEditPage() {
  const admin = getAdminSession<AdminSession>();
  const isSuperAdmin = admin?.role === "SUPER_ADMIN";
  const { id } = useParams();
  const [game, setGame] = useState<AdminGameRecord | null>(null);
  const [comments, setComments] = useState<GameComment[]>([]);
  const [status, setStatus] = useState("Loading game...");
  const [commentStatus, setCommentStatus] = useState("");
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorResults, setCreatorResults] = useState<AdminUserSummary[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<AdminUserSummary[]>([]);

  async function loadGame(gameId: string) {
    const [gamePayload, commentsPayload] = await Promise.all([
      apiGetAdmin<AdminGameResponse>(`/admin/games/${gameId}`),
      apiGetAdmin<AdminCommentsResponse>(`/admin/games/${gameId}/comments`)
    ]);
    setGame(gamePayload.game);
    setSelectedCreators(gamePayload.game.creators);
    setComments(commentsPayload.comments);
  }

  useEffect(() => {
    if (!id) return;

    loadGame(id)
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "게임 정보를 불러오지 못했습니다."));
  }, [id]);

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
    if (!isSuperAdmin && userId === admin?.id) return;
    setSelectedCreators((current) => current.filter((creator) => creator.id !== userId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;

    const formData = new FormData(event.currentTarget);
    setStatus("Saving...");

    try {
      const payload = await apiPatchAdmin<AdminGameResponse>(`/admin/games/${id}`, {
        title: String(formData.get("title") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        year: String(formData.get("year") ?? ""),
        developer: String(formData.get("developer") ?? ""),
        difficulty: String(formData.get("difficulty") ?? ""),
        shortDescription: String(formData.get("shortDescription") ?? ""),
        description: String(formData.get("description") ?? ""),
        status: String(formData.get("status") ?? game?.status ?? "DRAFT"),
        creatorIds: selectedCreators.map((creator) => creator.id)
      });
      setGame(payload.game);
      setSelectedCreators(payload.game.creators);
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  }

  async function handleArchive() {
    if (!id || !window.confirm("이 게임을 ARCHIVED 상태로 변경할까요?")) return;

    setStatus("Archiving...");
    try {
      const payload = await apiPatchAdmin<AdminGameResponse>(`/admin/games/${id}/archive`, {});
      setGame(payload.game);
      setStatus("Archived.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "보관 처리에 실패했습니다.");
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm("이 댓글을 관리자 권한으로 삭제할까요?")) return;

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
          <h1>{game?.title ?? "게임 수정"}</h1>
        </div>
        <Link className="secondary-action" to="/admin/games">
          목록으로
        </Link>
      </div>

      {status && <p className="status-text">{status}</p>}
      {game && (
        <form className="admin-edit-form" onSubmit={handleSubmit}>
          <label>
            게임 제목
            <input name="title" defaultValue={game.title} required />
          </label>
          <label>
            Slug
            <input name="slug" defaultValue={game.slug} required />
          </label>
          <label>
            제작연도
            <input name="year" defaultValue={game.year ?? ""} type="number" min="2000" max="2100" />
          </label>
          <label>
            제작자 표시명
            <input name="developer" defaultValue={game.developer ?? ""} />
          </label>
          <label>
            난이도
            <select name="difficulty" defaultValue={game.difficulty ?? ""}>
              <option value="">미입력</option>
              <option value="1">★☆☆☆☆</option>
              <option value="2">★★☆☆☆</option>
              <option value="3">★★★☆☆</option>
              <option value="4">★★★★☆</option>
              <option value="5">★★★★★</option>
            </select>
          </label>
          <label>
            게시 상태
            <select name="status" defaultValue={game.status} disabled={!isSuperAdmin}>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>
          <label className="admin-form-wide">
            한줄설명
            <input name="shortDescription" defaultValue={game.shortDescription} required />
          </label>
          <label className="admin-form-wide">
            제작자 계정 연결
            <input
              value={creatorQuery}
              onChange={(event) => void searchCreators(event.target.value)}
              placeholder="이름 검색"
            />
          </label>
          {creatorResults.length > 0 && (
            <div className="creator-search-results admin-form-wide">
              {creatorResults.map((user) => (
                <button type="button" key={user.id} onClick={() => addCreator(user)}>
                  {user.name}({user.loginId})
                </button>
              ))}
            </div>
          )}
          {selectedCreators.length > 0 && (
            <div className="creator-chip-row admin-form-wide">
              {selectedCreators.map((creator) => (
                <span className="creator-chip" key={creator.id}>
                  {creator.name}({creator.loginId})
                  <button type="button" onClick={() => removeCreator(creator.id)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <label className="admin-form-wide">
            게임 설명
            <textarea name="description" defaultValue={game.description ?? ""} rows={8} />
          </label>
          <div className="admin-form-actions">
            <button className="primary-action" type="submit">
              저장
            </button>
            {isSuperAdmin && (
              <button className="danger-action" type="button" onClick={() => void handleArchive()}>
                ARCHIVED 처리
              </button>
            )}
          </div>
        </form>
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
                  <td>{formatDate(comment.createdAt)}</td>
                  <td>{comment.deletedAt ? formatDate(comment.deletedAt) : "활성"}</td>
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
