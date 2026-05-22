import type { AdminGameRecord, AdminSession } from "@return-game/shared";
import { Edit3, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGetAdmin, apiPatchAdmin, apiPostAdmin, getAdminSession } from "../../api/client";
import { formatKoreanDateTime } from "../../utils/date";

interface AdminGamesResponse {
  games: AdminGameRecord[];
}

function renderDifficulty(value?: number) {
  const score = Math.max(0, Math.min(5, value ?? 0));
  return `${"★".repeat(score)}${"☆".repeat(5 - score)}`;
}

function statusLabel(status: AdminGameRecord["status"]) {
  return status === "PUBLIC" ? "공개" : "숨김";
}

export function AdminGameListPage() {
  const admin = getAdminSession<AdminSession>();
  const isSuperAdmin = admin?.role === "SUPER_ADMIN";
  const [games, setGames] = useState<AdminGameRecord[]>([]);
  const [status, setStatus] = useState("게임 목록을 불러오는 중입니다.");

  async function loadGames() {
    const payload = await apiGetAdmin<AdminGamesResponse>("/admin/games");
    setGames(payload.games);
    setStatus(payload.games.length ? "" : "업로드된 게임이 없습니다.");
  }

  useEffect(() => {
    loadGames().catch((error) => {
      setStatus(error instanceof Error ? error.message : "게임 목록을 불러오지 못했습니다.");
    });
  }, []);

  async function handleToggleStatus(game: AdminGameRecord) {
    if (!isSuperAdmin) return;

    const nextStatus = game.status === "PUBLIC" ? "HIDDEN" : "PUBLIC";
    setStatus(nextStatus === "PUBLIC" ? "" : "");

    try {
      const payload = await apiPatchAdmin<{ game: AdminGameRecord }>(`/admin/games/${game.id}`, {
        title: game.title,
        year: game.year ?? "",
        difficulty: game.difficulty ?? "",
        shortDescription: game.shortDescription,
        description: game.description ?? "",
        status: nextStatus,
        creatorNames: game.creatorNames ?? []
      });
      setGames((current) => current.map((item) => (item.id === game.id ? payload.game : item)));
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "공개 상태 변경에 실패했습니다.");
    }
  }

  async function handleRegisterCreator(game: AdminGameRecord) {
    if (isSuperAdmin || game.isCreator) return;

    const confirmed = window.confirm(
      `등록을 누르시면 이 게임 "${game.title}" 제작에 기여한 제작자로 남게 됩니다.\n` +
        "해당 정보는 사이트에 공개되며, 이 게임의 수정 권한을 가지게 됩니다.\n" +
        "제작자 등록과 이후 수정 사항은 모두 관리자 작업 로그에 남으므로 신중하게 진행해주세요."
    );
    if (!confirmed) return;

    setStatus("제작자로 등록하는 중입니다.");
    try {
      const payload = await apiPostAdmin<{ game: AdminGameRecord }>(`/admin/games/${game.id}/register-creator`, {});
      setGames((current) => current.map((item) => (item.id === game.id ? payload.game : item)));
      setStatus("제작자로 등록되었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "제작자 등록에 실패했습니다.");
    }
  }

  return (
    <section className="admin-panel wide">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>게임 관리</h1>
        </div>
        <Link className="primary-action" to="/admin/upload">
          게임 업로드
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
              <tr key={game.id} className={game.isCreator ? "owned-game-row" : undefined}>
                <td>{game.title}</td>
                <td>{game.slug}</td>
                <td>{game.year ?? "-"}</td>
                <td>{game.creatorNames?.length ? game.creatorNames.join(", ") : game.developer ?? "-"}</td>
                <td>{renderDifficulty(game.difficulty)}</td>
                <td>
                  <button
                    className={`status-pill status-toggle ${game.status.toLowerCase()}`}
                    type="button"
                    disabled={!isSuperAdmin}
                    onClick={() => void handleToggleStatus(game)}
                    title={isSuperAdmin ? "" : "총 관리자만 변경할 수 있습니다."}
                  >
                    {statusLabel(game.status)}
                  </button>
                </td>
                <td>{game.viewCount}</td>
                <td>{game.commentCount}</td>
                <td>{formatKoreanDateTime(game.updatedAt)}</td>
                <td>
                  <div className="table-action-row">
                    {game.canManage ? (
                      <Link className="icon-link" to={`/admin/games/${game.id}`}>
                        <Edit3 aria-hidden="true" />
                        수정
                      </Link>
                    ) : (
                      <span className="table-muted-action">수정 불가</span>
                    )}
                    {!isSuperAdmin &&
                      (game.isCreator ? (
                        <span className="status-pill owned">내 제작 게임</span>
                      ) : (
                        <button className="creator-register-button" type="button" onClick={() => void handleRegisterCreator(game)}>
                          <UserPlus aria-hidden="true" />
                          등록
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
