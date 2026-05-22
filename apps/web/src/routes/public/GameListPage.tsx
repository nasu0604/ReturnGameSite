import type { GameSummary } from "@return-game/shared";
import { ArrowRight, Eye, MessageSquare, Play } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiGet, apiPostJson } from "../../api/client";

interface GamesResponse {
  games: GameSummary[];
}

interface ViewResponse {
  viewCount: number;
}

const TITLE_TEXT = "return Game;";

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function animateScrollTo(targetTop: number, onComplete?: () => void) {
  const startTop = window.scrollY;
  const distance = targetTop - startTop;
  const duration = Math.min(1100, Math.max(650, Math.abs(distance) * 0.7));
  const startTime = window.performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    window.scrollTo({
      top: startTop + distance * easeOutCubic(progress),
      left: 0
    });

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  }

  window.requestAnimationFrame(step);
}

export function GameListPage() {
  const location = useLocation();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const logoMotionRef = useRef({
    currentSkewX: 0,
    currentSkewY: 0,
    currentStretchX: 1,
    currentStretchY: 1,
    currentTilt: 0,
    currentX: 0,
    currentY: 0,
    targetSkewX: 0,
    targetSkewY: 0,
    targetStretchX: 1,
    targetStretchY: 1,
    targetTilt: 0,
    targetX: 0,
    targetY: 0
  });
  const [games, setGames] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState("게임 목록을 불러오는 중입니다.");

  useEffect(() => {
    if ((location.state as { scrollToTop?: boolean } | null)?.scrollToTop) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [location.key, location.state]);

  useEffect(() => {
    apiGet<GamesResponse>("/games")
      .then((payload) => {
        setGames(payload.games);
        setStatus(payload.games.length === 0 ? "아직 업로드된 게임이 없습니다." : "");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "게임 목록을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let frameId = 0;
    const motion = logoMotionRef.current;

    function animateLogo() {
      const target = heroRef.current;

      motion.currentX += (motion.targetX - motion.currentX) * 0.09;
      motion.currentY += (motion.targetY - motion.currentY) * 0.09;
      motion.currentStretchX += (motion.targetStretchX - motion.currentStretchX) * 0.08;
      motion.currentStretchY += (motion.targetStretchY - motion.currentStretchY) * 0.08;
      motion.currentTilt += (motion.targetTilt - motion.currentTilt) * 0.08;
      motion.currentSkewX += (motion.targetSkewX - motion.currentSkewX) * 0.075;
      motion.currentSkewY += (motion.targetSkewY - motion.currentSkewY) * 0.075;

      if (target) {
        target.style.setProperty("--logo-x", motion.currentX.toFixed(3));
        target.style.setProperty("--logo-y", motion.currentY.toFixed(3));
        target.style.setProperty("--logo-stretch-x", motion.currentStretchX.toFixed(4));
        target.style.setProperty("--logo-stretch-y", motion.currentStretchY.toFixed(4));
        target.style.setProperty("--logo-tilt", motion.currentTilt.toFixed(4));
        target.style.setProperty("--logo-skew-x", motion.currentSkewX.toFixed(4));
        target.style.setProperty("--logo-skew-y", motion.currentSkewY.toFixed(4));
      }

      frameId = window.requestAnimationFrame(animateLogo);
    }

    frameId = window.requestAnimationFrame(animateLogo);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const motion = logoMotionRef.current;

    function updateFromPointer(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;

      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const xRatio = event.clientX / width - 0.5;
      const yRatio = event.clientY / height - 0.5;

      motion.targetX = Math.max(-7, Math.min(7, xRatio * 12));
      motion.targetY = Math.max(-4.5, Math.min(4.5, yRatio * 8));
      motion.targetStretchX = 1 + Math.abs(xRatio) * 0.06 - Math.abs(yRatio) * 0.014;
      motion.targetStretchY = 1 + Math.abs(yRatio) * 0.045 - Math.abs(xRatio) * 0.01;
      motion.targetTilt = Math.max(-0.65, Math.min(0.65, xRatio * 1.25));
      motion.targetSkewX = Math.max(-1.65, Math.min(1.65, xRatio * 3.1));
      motion.targetSkewY = Math.max(-0.75, Math.min(0.75, yRatio * 1.45));
    }

    function resetPointerMotion() {
      motion.targetX = 0;
      motion.targetY = 0;
      motion.targetStretchX = 1;
      motion.targetStretchY = 1;
      motion.targetTilt = 0;
      motion.targetSkewX = 0;
      motion.targetSkewY = 0;
    }

    window.addEventListener("pointermove", updateFromPointer);
    window.addEventListener("pointerleave", resetPointerMotion);
    window.addEventListener("blur", resetPointerMotion);

    return () => {
      window.removeEventListener("pointermove", updateFromPointer);
      window.removeEventListener("pointerleave", resetPointerMotion);
      window.removeEventListener("blur", resetPointerMotion);
    };
  }, []);

  async function handleGameOpen(slug: string) {
    try {
      const payload = await apiPostJson<ViewResponse>(`/games/${slug}/views`, {});
      setGames((currentGames) =>
        currentGames.map((game) => (game.slug === slug ? { ...game, viewCount: payload.viewCount } : game))
      );
    } catch {
      // 조회수 기록 실패가 게임 진입을 막으면 안 된다.
    }
  }

  function handleScrollCueClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const gamesSection = document.getElementById("games");
    if (!gamesSection) return;

    if (prefersReducedMotion()) {
      gamesSection.scrollIntoView();
      return;
    }

    const targetTop = gamesSection.getBoundingClientRect().top + window.scrollY;
    animateScrollTo(targetTop, () => {
      window.history.pushState(null, "", "#games");
    });
  }

  return (
    <section className="page-container home-page project-page">
      <div className="home-hero" ref={heroRef}>
        <Link className="home-about-link" to="/about">
          <span>About</span>
          <ArrowRight className="home-about-arrow" aria-hidden="true" />
        </Link>
        <h1 className="home-title">
          <span className="home-title-typing" aria-label={TITLE_TEXT}>
            {TITLE_TEXT}
          </span>
        </h1>
        <p className="home-subtitle">경희고등학교 게임 개발 동아리</p>
        <a className="scroll-cue" href="#games" aria-label="게임 목록으로 이동" onClick={handleScrollCueClick}>
          <span className="scroll-cue-label">아래로 스크롤</span>
          <span className="scroll-arrows" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </a>
      </div>

      <div className="project-toolbar" id="games" aria-hidden="true" />

      {status && <p className="status-text">{status}</p>}
      <ul className="project-grid">
        {games.map((game) => (
          <li key={game.id}>
            <Link className="project-item" to={`/games/${game.slug}`} onClick={() => void handleGameOpen(game.slug)}>
              <div className="project-image-container">
                {game.thumbnailUrl ? <img src={game.thumbnailUrl} alt="" /> : <Play aria-hidden="true" />}
              </div>
              <div className="project-text-container">
                <div className="project-text-main">
                  <div>
                    <div className="project-title">{game.title}</div>
                    <div className="project-subtitle">{game.shortDescription}</div>
                  </div>
                  <div className="project-stats">
                    <span>
                      <Eye aria-hidden="true" />
                      {game.viewCount}
                    </span>
                    <span>
                      <MessageSquare aria-hidden="true" />
                      {game.commentCount}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
