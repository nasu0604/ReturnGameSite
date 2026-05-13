import type { AdminAuditLogRecord, AdminUserSummary } from "@return-game/shared";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { apiGetAdmin, apiPatchAdmin } from "../../api/client";

interface ManagersResponse {
  managers: AdminUserSummary[];
}

interface SignupCodeResponse {
  configured: boolean;
  updatedAt?: string;
}

interface AuditLogsResponse {
  logs: AdminAuditLogRecord[];
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

export function AdminManagersPage() {
  const [managers, setManagers] = useState<AdminUserSummary[]>([]);
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([]);
  const [signupCode, setSignupCode] = useState<SignupCodeResponse>({ configured: false });
  const [status, setStatus] = useState("관리자 정보를 불러오는 중...");

  async function load() {
    const [managerPayload, signupCodePayload, auditPayload] = await Promise.all([
      apiGetAdmin<ManagersResponse>("/admin/managers"),
      apiGetAdmin<SignupCodeResponse>("/admin/signup-code"),
      apiGetAdmin<AuditLogsResponse>("/admin/audit-logs")
    ]);
    setManagers(managerPayload.managers);
    setSignupCode(signupCodePayload);
    setLogs(auditPayload.logs);
  }

  useEffect(() => {
    load()
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "관리자 정보를 불러오지 못했습니다."));
  }, []);

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
      await load();
      setStatus("세부 관리자 회원가입 보안코드를 저장했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "보안코드 저장에 실패했습니다.");
    }
  }

  async function updateStatus(manager: AdminUserSummary) {
    const nextStatus = manager.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await apiPatchAdmin(`/admin/managers/${manager.id}/status`, { status: nextStatus });
    await load();
  }

  async function resetPassword(manager: AdminUserSummary) {
    const password = window.prompt(`${manager.name}의 임시 비밀번호를 입력하세요. 최소 6자입니다.`);
    if (!password) return;

    await apiPatchAdmin(`/admin/managers/${manager.id}/password`, { password });
    await load();
    setStatus("비밀번호를 초기화했습니다.");
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
          현재 상태: {signupCode.configured ? `설정됨 (${formatDate(signupCode.updatedAt)})` : "미설정"}
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
                <th>상태</th>
                <th>최근 로그인</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {managers.map((manager) => (
                <tr key={manager.id}>
                  <td>{manager.name}</td>
                  <td>{manager.loginId}</td>
                  <td>{manager.role}</td>
                  <td>{manager.status}</td>
                  <td>{formatDate(manager.lastLoginAt)}</td>
                  <td>
                    {manager.role !== "SUPER_ADMIN" && (
                      <div className="table-actions">
                        <button type="button" onClick={() => void updateStatus(manager)}>
                          {manager.status === "ACTIVE" ? "비활성화" : "활성화"}
                        </button>
                        <button type="button" onClick={() => void resetPassword(manager)}>
                          비밀번호 초기화
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-comments-panel">
        <h2>관리자 작업 로그</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
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
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{log.admin ? `${log.admin.name}(${log.admin.loginId})` : "-"}</td>
                  <td>{log.action}</td>
                  <td>{log.targetType}</td>
                  <td>{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
