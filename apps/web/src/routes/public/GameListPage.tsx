import type { GameSummary } from "@return-game/shared";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api/client";

interface GamesResponse {
  games: GameSummary[];
}

export function GameListPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState("Loading games...");

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

  return (
    <section className="page-section">
      <div className="section-heading">
        <p className="eyebrow">WebGL library</p>
        <h1>Published games</h1>
      </div>
      {status && <p className="status-text">{status}</p>}
      <div className="game-grid">
        {games.map((game) => (
          <Link className="game-card" key={game.id} to={`/games/${game.slug}`}>
            <div className="game-thumb">
              {game.thumbnailUrl ? <img src={game.thumbnailUrl} alt="" /> : <Play aria-hidden="true" />}
            </div>
            <div>
              <h2>{game.title}</h2>
              <p>{game.shortDescription}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
