import type { GameComment, GameDetail } from "@return-game/shared";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiDeleteJson, apiGet, apiPostJson } from "../../api/client";

interface GameResponse {
  game: GameDetail;
}

interface CommentsResponse {
  comments: GameComment[];
}

interface CommentResponse {
  comment: GameComment;
}

function renderDifficulty(score?: number) {
  const normalized = Math.max(0, Math.min(5, score ?? 0));
  return `${"★".repeat(normalized)}${"☆".repeat(5 - normalized)}`;
}

function renderDescriptionLines(description?: string) {
  const lines = description
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines?.length) return lines;

  return ["게임 설명이 아직 입력되지 않았습니다."];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function GameDetailPage() {
  const { slug } = useParams();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [comments, setComments] = useState<GameComment[]>([]);
  const [status, setStatus] = useState("Loading game...");
  const [commentStatus, setCommentStatus] = useState("");

  async function loadComments(currentSlug: string) {
    const payload = await apiGet<CommentsResponse>(`/games/${currentSlug}/comments`);
    setComments(payload.comments);
  }

  useEffect(() => {
    if (!slug) return;

    setStatus("Loading game...");
    apiGet<GameResponse>(`/games/${slug}`)
      .then(async (payload) => {
        setGame(payload.game);
        setStatus("");
        await loadComments(slug);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Failed to load game.");
      });
  }, [slug]);

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const author = String(formData.get("author") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const body = String(formData.get("body") ?? "").trim();

    setCommentStatus("");

    try {
      const payload = await apiPostJson<CommentResponse>(`/games/${slug}/comments`, {
        author,
        password,
        body
      });
      setComments((current) => [...current, payload.comment]);
      form.reset();
    } catch (error) {
      setCommentStatus(error instanceof Error ? error.message : "댓글 등록에 실패했습니다.");
    }
  }

  async function handleDeleteComment(commentId: string) {
    const password = window.prompt("댓글 비밀번호를 입력하세요.");
    if (!password) return;

    setCommentStatus("");

    try {
      await apiDeleteJson(`/games/comments/${commentId}`, { password });
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (error) {
      setCommentStatus(error instanceof Error ? error.message : "댓글 삭제에 실패했습니다.");
    }
  }

  return (
    <section className="game-detail-page">
      {status && <p className="status-text">{status}</p>}
      <div className="project-layout">
        <div className="game-left">
          <div className="game-container">
            <div className="game-frame-wrapper">
              {game?.entryUrl ? (
                <iframe
                  className="game-iframe"
                  src={game.entryUrl}
                  title={game.title}
                  frameBorder="0"
                  scrolling="no"
                  allowFullScreen
                />
              ) : (
                <div className="game-player-placeholder">
                  <span>{slug}</span>
                </div>
              )}
            </div>
          </div>

          <div className="game-instructions">
            <div className="instruction-box">
              <div className="instruction-header-row">
                <div className="instruction-header-left">
                  <span className="instruction-game-title">{game?.title ?? "WebGL Game"}</span>
                  <span className="instruction-game-desc">
                    {game?.year ? `(${game.year}) | ` : ""}
                    {game?.shortDescription ?? "게임 정보를 불러오는 중입니다."}
                  </span>
                </div>
                <div className="instruction-header-right">
                  <span className="instruction-developer">{game?.developer ?? "제작자 미입력"}</span>
                  <span className="instruction-difficulty">{renderDifficulty(game?.difficulty)}</span>
                </div>
              </div>
              <div className="instruction-how">
                {renderDescriptionLines(game?.description).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="ratings-comments-wrapper">
          <div className="ratings-comments">
            <div className="comments-section">
              <form className="comment-form" onSubmit={handleCommentSubmit}>
                <div className="horizontal-inputs">
                  <input className="author-input" name="author" placeholder="닉네임" type="text" required />
                  <input
                    className="password-input"
                    name="password"
                    placeholder="비밀번호"
                    type="password"
                    minLength={4}
                    required
                  />
                </div>
                <textarea
                  className="comment-input"
                  name="body"
                  placeholder="댓글을 입력해주세요 (Enter로 등록)"
                  required
                />
                <button className="comment-submit-btn" type="submit">
                  등록
                </button>
              </form>
              {commentStatus && <p className="comment-status">{commentStatus}</p>}

              <div className="comments-list">
                {comments.map((comment) => (
                  <div className="comment-item" key={comment.id}>
                    <div className="comment-header">
                      <strong>{comment.author}</strong>
                      <span className="comment-date">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="comment-text">{comment.body}</p>
                    <button
                      className="delete-comment-btn"
                      type="button"
                      onClick={() => void handleDeleteComment(comment.id)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
