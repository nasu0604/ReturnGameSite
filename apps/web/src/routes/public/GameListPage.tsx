import type { GameSummary } from "@return-game/shared";
import { ArrowRight, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api/client";

interface GamesResponse {
  games: GameSummary[];
}

export function GameListPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState("Loading games...");
  const [sortOption, setSortOption] = useState("default");

  useEffect(() => {
    apiGet<GamesResponse>("/games")
      .then((payload) => {
        setGames(payload.games);
        setStatus(payload.games.length === 0 ? "No games uploaded yet." : "");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Failed to load games.");
      });
  }, []);

  const visibleGames = [...games].sort((a, b) => {
    if (sortOption === "name") return a.title.localeCompare(b.title);
    return 0;
  });

  return (
    <section className="page-container home-page project-page">
      <div className="home-hero">
        <p className="home-tagline">2025학년도 제44회 경황제</p>
        <h1 className="home-title">
          <span className="home-title-typing">@return Game;</span>
        </h1>
        <p className="home-subtitle">경희고등학교 게임 개발 동아리</p>
      </div>

      <div className="home-links">
        <a className="home-link-box" href="#games">
          <ArrowRight className="cta-arrow-icon" aria-hidden="true" />
          게임 체험하러 가기
        </a>
      </div>

      <div className="project-toolbar" id="games">
        <select
          className="sort-dropdown"
          value={sortOption}
          onChange={(event) => setSortOption(event.target.value)}
          aria-label="sort games"
        >
          <option value="default">기본순</option>
          <option value="name">이름순</option>
        </select>
      </div>

      {status && <p className="status-text">{status}</p>}
      <ul className="project-grid">
        {visibleGames.map((game) => (
          <li key={game.id}>
            <Link className="project-item" to={`/games/${game.slug}`}>
              <div className="project-image-container">
                {game.thumbnailUrl ? <img src={game.thumbnailUrl} alt="" /> : <Play aria-hidden="true" />}
              </div>
              <div className="project-text-container">
                <div className="project-text-row">
                  <div className="project-title">{game.title}</div>
                  <div className="project-rating">
                    <span className="project-eye">visibility</span>
                    0
                  </div>
                </div>
                <div className="project-text-row">
                  <div className="project-subtitle">{game.shortDescription}</div>
                  <div className="project-comments-info">0</div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
