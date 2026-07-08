import type { GameComment, GameDetail } from "@return-game/shared";
import { ChevronsLeft } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiDeleteJson, apiGet, apiPostJson } from "../../api/client";
import { formatKoreanNumericDateTime } from "../../utils/date";

interface GameResponse {
  game: GameDetail;
}

interface CommentsResponse {
  comments: GameComment[];
}

interface CommentResponse {
  comment: GameComment;
}

const DETAIL_INTRO_DELAY_MS = 700;

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

function GameDetailError({ message }: { message: string }) {
  return (
    <section className="game-detail-loading game-detail-error">
      <div className="game-loading-panel">
        <div className="game-loading-logo">return Game;</div>
        <h1>게임을 불러오지 못했습니다.</h1>
        <p>{message}</p>
        <Link className="game-loading-home-link" to="/">
          메인으로 돌아가기
        </Link>
      </div>
    </section>
  );
}

export function GameDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [comments, setComments] = useState<GameComment[]>([]);
  const [initialError, setInitialError] = useState("");
  const [isIntroDelayDone, setIsIntroDelayDone] = useState(false);
  const [commentStatus, setCommentStatus] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [slug]);

  async function fetchComments(currentSlug: string) {
    const payload = await apiGet<CommentsResponse>(`/games/${currentSlug}/comments`);
    return payload.comments;
  }

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    setInitialError("");
    setGame(null);
    setComments([]);
    setIsIntroDelayDone(false);
    setCommentStatus("");

    const introTimer = window.setTimeout(() => {
      if (!cancelled) setIsIntroDelayDone(true);
    }, DETAIL_INTRO_DELAY_MS);

    apiGet<GameResponse>(`/games/${slug}`)
      .then((gamePayload) => {
        if (cancelled) return;
        setGame(gamePayload.game);
      })
      .catch((error) => {
        if (cancelled) return;
        setInitialError(error instanceof Error ? error.message : "게임 정보를 불러오는 중 문제가 발생했습니다.");
      });

    fetchComments(slug)
      .then((commentPayload) => {
        if (cancelled) return;
        setComments(commentPayload);
      })
      .catch((error) => {
        if (cancelled) return;
        setInitialError(error instanceof Error ? error.message : "댓글 정보를 불러오는 중 문제가 발생했습니다.");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(introTimer);
    };
  }, [slug]);

  function handleBack() {
    navigate("/", { state: { scrollToTop: true } });
  }

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

  if (initialError) {
    return <GameDetailError message={initialError || "게임 정보를 찾을 수 없습니다."} />;
  }

  if (!game) {
    return <section className="game-detail-blank" aria-hidden="true" />;
  }

  return (
    <section className={`game-detail-page${isIntroDelayDone ? " is-detail-entered" : " is-detail-preintro"}`}>
      <div className="project-layout">
        <div className="game-left">
          <div className="game-container">
            <div className="game-frame-wrapper">
              {game.entryUrl ? (
                <iframe
                  className="game-iframe"
                  src={game.entryUrl}
                  title={game.title}
                  frameBorder="0"
                  scrolling="no"
                  allowFullScreen
                />
              ) : (
                <div className="game-player-placeholder" aria-hidden="true">
                  <span />
                </div>
              )}
            </div>
          </div>

          <div className="game-instructions">
            <div className="instruction-box">
              <div className="instruction-header-row">
                <div className="instruction-header-left">
                  <span className="instruction-game-title">{game.title}</span>
                  <span className="instruction-game-desc">
                    {game.year ? `(${game.year}) | ` : ""}
                    {game.shortDescription}
                  </span>
                </div>
                <button className="instruction-back-link" type="button" onClick={handleBack}>
                  뒤로가기
                </button>
                <div className="instruction-header-right">
                  <span className="instruction-developer">{game.developer ?? "제작자 미입력"}</span>
                  <span className="instruction-difficulty">{renderDifficulty(game.difficulty)}</span>
                </div>
              </div>
              <div className="instruction-how">
                {renderDescriptionLines(game.description).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              {game.copyrightNotice && (
                <div className="instruction-copyright" aria-label="저작권 안내">
                  {renderDescriptionLines(game.copyrightNotice).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="game-back-button-row">
            <button className="game-back-button" type="button" onClick={handleBack} aria-label="이전 화면으로 이동">
              <ChevronsLeft aria-hidden="true" />
            </button>
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
                <textarea className="comment-input" name="body" placeholder="댓글을 입력해주세요" required />
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
                      <p className="comment-text">{comment.body}</p>
                      <span className="comment-date">{formatKoreanNumericDateTime(comment.createdAt)}</span>
                    </div>
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
