import type { GameDetail } from "@return-game/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../../api/client";

interface GameResponse {
  game: GameDetail;
}

export function GameDetailPage() {
  const { slug } = useParams();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [status, setStatus] = useState("Loading game...");

  useEffect(() => {
    if (!slug) return;

    apiGet<GameResponse>(`/games/${slug}`)
      .then((payload) => {
        setGame(payload.game);
        setStatus("");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Failed to load game.");
      });
  }, [slug]);

  return (
    <section className="page-section">
      {status && <p className="status-text">{status}</p>}
      {game?.entryUrl ? (
        <iframe className="game-frame" src={game.entryUrl} title={game.title} allowFullScreen />
      ) : (
        <div className="game-player-placeholder">
          <span>{slug}</span>
        </div>
      )}
      <div className="section-heading compact">
        <p className="eyebrow">Game detail</p>
        <h1>{game?.title ?? "WebGL player"}</h1>
        {game?.shortDescription && <p className="detail-description">{game.shortDescription}</p>}
      </div>
    </section>
  );
}
