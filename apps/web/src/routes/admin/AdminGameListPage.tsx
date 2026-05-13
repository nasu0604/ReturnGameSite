import type { AdminGameRecord } from "@return-game/shared";
import { Edit3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGetAdmin } from "../../api/client";

interface AdminGamesResponse {
  games: AdminGameRecord[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderDifficulty(value?: number) {
  const score = Math.max(0, Math.min(5, value ?? 0));
  return `${"★".repeat(score)}${"☆".repeat(5 - score)}`;
}

export function AdminGameListPage() {
  const [games, setGames] = useState<AdminGameRecord[]>([]);
  const [status, setStatus] = useState("게임 목록을 불러오는 중...");

  useEffect(() => {
    apiGetAdmin<AdminGamesResponse>("/admin/games")
      .then((payload) => {
        setGames(payload.games);
        setStatus(payload.games.length ? "" : "업로드된 게임이 없습니다.");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "게임 목록을 불러오지 못했습니다.");
      });
  }, []);

  return (
    <section className="admin-panel wide">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>게임 관리</h1>
        </div>
        <Link className="primary-action" to="/admin/upload">
          새 게임 업로드
        </Link>
      </div>

      {status && <p className="status-text">{status}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>제목</th>
              <th>Slug</th>
              <th>연도</th>
              <th>제작자</th>
              <th>난이도</th>
              <th>상태</th>
              <th>조회</th>
              <th>댓글</th>
              <th>최근 수정</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>{game.title}</td>
                <td>{game.slug}</td>
                <td>{game.year ?? "-"}</td>
                <td>{game.developer ?? "-"}</td>
                <td>{renderDifficulty(game.difficulty)}</td>
                <td>
                  <span className={`status-pill ${game.status.toLowerCase()}`}>{game.status}</span>
                </td>
                <td>{game.viewCount}</td>
                <td>{game.commentCount}</td>
                <td>{formatDate(game.updatedAt)}</td>
                <td>
                  <Link className="icon-link" to={`/admin/games/${game.id}`}>
                    <Edit3 aria-hidden="true" />
                    수정
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
