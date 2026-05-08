import type { AdminUserSummary, ManagerInviteRecord } from "@return-game/shared";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { apiGetAdmin, apiPatchAdmin, apiPostAdmin } from "../../api/client";

interface ManagersResponse {
  managers: AdminUserSummary[];
}

interface InvitesResponse {
  invites: ManagerInviteRecord[];
}

interface InviteCreateResponse {
  invite: ManagerInviteRecord;
  alreadyExists?: boolean;
  message?: string;
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
  const [invites, setInvites] = useState<ManagerInviteRecord[]>([]);
  const [status, setStatus] = useState("Loading managers...");

  async function load() {
    const [managerPayload, invitePayload] = await Promise.all([
      apiGetAdmin<ManagersResponse>("/admin/managers"),
      apiGetAdmin<InvitesResponse>("/admin/manager-invites")
    ]);
    setManagers(managerPayload.managers);
    setInvites(invitePayload.invites);
  }

  useEffect(() => {
    load()
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "관리자 정보를 불러오지 못했습니다."));
  }, []);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("Adding invite...");

    try {
      const payload = await apiPostAdmin<InviteCreateResponse>("/admin/manager-invites", {
        name: String(formData.get("name") ?? "")
      });
      form.reset();
      await load();
      setStatus(payload.alreadyExists ? payload.message ?? "이미 등록된 이름입니다." : "허용 이름을 추가했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "허용 이름 추가에 실패했습니다.");
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

      <form className="inline-admin-form" onSubmit={handleInvite}>
        <label>
          세부 관리자 허용 이름
          <input name="name" placeholder="홍길동" required />
        </label>
        <button className="primary-action" type="submit">
          추가
        </button>
      </form>
      {status && <p className="status-text">{status}</p>}

      <section className="admin-comments-panel">
        <h2>가입 허용 명단</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>가입 여부</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.name}</td>
                  <td>{invite.claimedBy ? `${invite.claimedBy.name}(${invite.claimedBy.loginId})` : "미가입"}</td>
                  <td>{formatDate(invite.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
    </section>
  );
}
