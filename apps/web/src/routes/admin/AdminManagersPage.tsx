import type { AdminAuditLogRecord, AdminManagerGameRecord, AdminUserSummary } from "@return-game/shared";
import { ClipboardList, Settings2, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiDeleteAdmin, apiGetAdmin, apiPatchAdmin } from "../../api/client";
import { formatKoreanDateTime } from "../../utils/date";

interface ManagersResponse {
  managers: AdminUserSummary[];
}

interface SignupCodeResponse {
  configured: boolean;
  updatedAt?: string;
}

interface AuditLogsResponse {
  logs: AdminAuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  actions: string[];
}

interface ManagerGamesResponse {
  games: AdminManagerGameRecord[];
}

const PAGE_SIZE = 10;

export function AdminManagersPage() {
  const [managers, setManagers] = useState<AdminUserSummary[]>([]);
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logActions, setLogActions] = useState<string[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logAdminId, setLogAdminId] = useState("");
  const [logAction, setLogAction] = useState("");
  const [logQuery, setLogQuery] = useState("");
  const [signupCode, setSignupCode] = useState<SignupCodeResponse>({ configured: false });
  const [selectedManager, setSelectedManager] = useState<AdminUserSummary | null>(null);
  const [selectedManagerGames, setSelectedManagerGames] = useState<AdminManagerGameRecord[]>([]);
  const [status, setStatus] = useState("관리자 정보를 불러오는 중...");

  const pageCount = Math.max(1, Math.ceil(logTotal / PAGE_SIZE));

  const managerOptions = useMemo(
    () => managers.map((manager) => ({ id: manager.id, label: `${manager.name}(${manager.loginId})` })),
    [managers]
  );

  async function loadManagersAndCode() {
    const [managerPayload, signupCodePayload] = await Promise.all([
      apiGetAdmin<ManagersResponse>("/admin/managers"),
      apiGetAdmin<SignupCodeResponse>("/admin/signup-code")
    ]);
    setManagers(managerPayload.managers);
    setSignupCode(signupCodePayload);
  }

  async function loadLogs(page = logPage) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE)
    });
    if (logAdminId) params.set("adminUserId", logAdminId);
    if (logAction) params.set("action", logAction);
    if (logQuery.trim()) params.set("q", logQuery.trim());

    const payload = await apiGetAdmin<AuditLogsResponse>(`/admin/audit-logs?${params.toString()}`);
    setLogs(payload.logs);
    setLogTotal(payload.total);
    setLogActions(payload.actions);
    setLogPage(payload.page);
  }

  async function loadSelectedManagerGames(managerId: string) {
    const payload = await apiGetAdmin<ManagerGamesResponse>(`/admin/managers/${managerId}/games`);
    setSelectedManagerGames(payload.games);
  }

  async function load() {
    await Promise.all([loadManagersAndCode(), loadLogs(1)]);
  }

  useEffect(() => {
    load()
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "관리자 정보를 불러오지 못했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLogs(1).catch((error) => setStatus(error instanceof Error ? error.message : "작업 로그를 불러오지 못했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAdminId, logAction]);

  async function handleSecurityCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const securityCode = String(formData.get("securityCode") ?? "");
    const securityCodeConfirm = String(formData.get("securityCodeConfirm") ?? "");

    if (securityCode !== securityCodeConfirm) {
      setStatus("보안코드 확인이 일치하지 않습니다.");
      return;
    }

    setStatus("보안코드를 저장하는 중...");

    try {
      const payload = await apiPatchAdmin<SignupCodeResponse>("/admin/signup-code", { securityCode });
      setSignupCode(payload);
      form.reset();
      await loadLogs(1);
      setStatus("세부 관리자 회원가입 보안코드를 저장했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "보안코드 저장에 실패했습니다.");
    }
  }

  async function updateStatus(manager: AdminUserSummary) {
    const nextStatus = manager.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await apiPatchAdmin(`/admin/managers/${manager.id}/status`, { status: nextStatus });
    await loadManagersAndCode();
    await loadLogs(1);
  }

  async function resetPassword(manager: AdminUserSummary) {
    const password = window.prompt(`${manager.name}의 임시 비밀번호를 입력하세요. 최소 6자입니다.`);
    if (!password) return;

    await apiPatchAdmin(`/admin/managers/${manager.id}/password`, { password });
    await loadLogs(1);
    setStatus("비밀번호를 초기화했습니다.");
  }

  async function openManagerDetail(manager: AdminUserSummary) {
    setSelectedManager(manager);
    setLogAdminId(manager.id);
    setLogPage(1);
    await loadSelectedManagerGames(manager.id);
  }

  async function deleteManagerGame(game: AdminManagerGameRecord) {
    if (!selectedManager) return;
    const confirmed = window.confirm(`${selectedManager.name} 관리자의 "${game.title}" 제작자 등록을 삭제할까요?`);
    if (!confirmed) return;

    await apiDeleteAdmin(`/admin/managers/${selectedManager.id}/games/${game.id}`);
    await Promise.all([loadSelectedManagerGames(selectedManager.id), loadLogs(1)]);
    setStatus("제작자 등록을 삭제했습니다.");
  }

  function handleLogFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLogs(1);
  }

  function clearLogFilters() {
    setLogAdminId("");
    setLogAction("");
    setLogQuery("");
    setSelectedManager(null);
    setSelectedManagerGames([]);
    setLogPage(1);
  }

  return (
    <section className="admin-panel wide">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1>관리자 관리</h1>
        </div>
      </div>

      <section className="admin-comments-panel">
        <h2>세부 관리자 회원가입 보안코드</h2>
        <p className="status-text">
          현재 상태: {signupCode.configured ? `설정됨 (${formatKoreanDateTime(signupCode.updatedAt)})` : "미설정"}
        </p>
        <form className="inline-admin-form" onSubmit={handleSecurityCode}>
          <label>
            새 보안코드
            <input name="securityCode" type="password" minLength={6} required />
          </label>
          <label>
            보안코드 확인
            <input name="securityCodeConfirm" type="password" minLength={6} required />
          </label>
          <button className="primary-action" type="submit">
            저장
          </button>
        </form>
      </section>

      {status && <p className="status-text">{status}</p>}

      <section className="admin-comments-panel">
        <h2>관리자 계정</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>아이디</th>
                <th>역할</th>
                {/* <th>상태</th> */}
                <th>최근 로그인</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {managers.map((manager) => (
                <tr key={manager.id} className={selectedManager?.id === manager.id ? "selected-admin-row" : undefined}>
                  <td>{manager.name}</td>
                  <td>{manager.loginId}</td>
                  <td>{manager.role}</td>
                  {/* <td>{manager.status}</td> */}
                  <td>{formatKoreanDateTime(manager.lastLoginAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="icon-button-text" type="button" onClick={() => void openManagerDetail(manager)}>
                        <Settings2 aria-hidden="true" />
                        관리
                      </button>
                      {manager.role !== "SUPER_ADMIN" && (
                        <>
                          {/* <button type="button" onClick={() => void updateStatus(manager)}>
                            {manager.status === "ACTIVE" ? "비활성화" : "활성화"}
                          </button> */}
                          <button className="icon-button-text-white"type="button" onClick={() => void resetPassword(manager)}>
                            비밀번호 초기화
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedManager && (
        <section className="admin-comments-panel manager-detail-panel">
          <div>
            <p className="eyebrow">Manager detail</p>
            <h2>{selectedManager.name} 제작 게임 등록</h2>
            <p className="muted-text">이 관리자가 직접 제작자로 등록한 게임 목록입니다. 등록 삭제 시 수정 권한도 함께 사라집니다.</p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>게임</th>
                  <th>Slug</th>
                  <th>연도</th>
                  <th>표시 제작자</th>
                  <th>등록일</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {selectedManagerGames.map((game) => (
                  <tr key={game.id}>
                    <td>{game.title}</td>
                    <td>{game.slug}</td>
                    <td>{game.year ?? "-"}</td>
                    <td>{game.creatorNames?.length ? game.creatorNames.join(", ") : "-"}</td>
                    <td>{formatKoreanDateTime(game.registeredAt)}</td>
                    <td>
                      <button className="table-danger-button with-icon" type="button" onClick={() => void deleteManagerGame(game)}>
                        <Trash2 aria-hidden="true" />
                        등록 삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {selectedManagerGames.length === 0 && (
                  <tr>
                    <td colSpan={6}>등록된 제작 게임이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="admin-comments-panel">
        <div className="admin-page-header compact-row">
          <div>
            <p className="eyebrow">Audit logs</p>
            <h2>관리자 작업 로그</h2>
          </div>
          <span>{logTotal}개</span>
        </div>
        <form className="audit-filter-form" onSubmit={handleLogFilterSubmit}>
          <label>
            관리자
            <select value={logAdminId} onChange={(event) => setLogAdminId(event.target.value)}>
              <option value="">전체</option>
              {managerOptions.map((manager) => (
                <option value={manager.id} key={manager.id}>
                  {manager.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            작업
            <select value={logAction} onChange={(event) => setLogAction(event.target.value)}>
              <option value="">전체</option>
              {logActions.map((action) => (
                <option value={action} key={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label>
            검색
            <input value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder="내용, 대상, 작업 검색" />
          </label>
          <button className="secondary-action" type="submit">
            <ClipboardList aria-hidden="true" />
            필터 적용
          </button>
          <button className="secondary-action" type="button" onClick={clearLogFilters}>
            초기화
          </button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table-">
            <thead>
              <tr>
                <th>시간</th>
                <th>관리자</th>
                <th>작업</th>
                <th>대상</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatKoreanDateTime(log.createdAt)}</td>
                  <td>{log.admin ? `${log.admin.name}(${log.admin.loginId})` : "-"}</td>
                  <td>{log.action}</td>
                  <td>{log.targetType}</td>
                  <td>{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <button type="button" disabled={logPage <= 1} onClick={() => void loadLogs(logPage - 1)}>
            이전
          </button>
          <span>
            {logPage} / {pageCount}
          </span>
          <button type="button" disabled={logPage >= pageCount} onClick={() => void loadLogs(logPage + 1)}>
            다음
          </button>
        </div>
      </section>
    </section>
  );
}
