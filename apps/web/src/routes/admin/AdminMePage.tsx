import type { AdminSession } from "@return-game/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { apiPatchAdmin, getAdminSession } from "../../api/client";

export function AdminMePage() {
  const admin = getAdminSession<AdminSession>();
  const [status, setStatus] = useState("");

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("Saving...");

    try {
      await apiPatchAdmin("/admin/me/password", {
        currentPassword: String(formData.get("currentPassword") ?? ""),
        newPassword: String(formData.get("newPassword") ?? "")
      });
      event.currentTarget.reset();
      setStatus("비밀번호를 변경했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다.");
    }
  }

  return (
    <section className="admin-panel">
      <div className="section-heading compact">
        <p className="eyebrow">My account</p>
        <h1>내 정보</h1>
      </div>
      <dl className="admin-profile-list">
        <dt>이름</dt>
        <dd>{admin?.name}</dd>
        <dt>아이디</dt>
        <dd>{admin?.loginId}</dd>
        <dt>역할</dt>
        <dd>{admin?.role}</dd>
        <dt>상태</dt>
        <dd>{admin?.status}</dd>
      </dl>
      <form className="login-form" onSubmit={handlePassword}>
        <label>
          현재 비밀번호
          <input type="password" name="currentPassword" required />
        </label>
        <label>
          새 비밀번호
          <input type="password" name="newPassword" minLength={6} required />
        </label>
        <button className="primary-action" type="submit">
          비밀번호 변경
        </button>
      </form>
      {status && <p className="status-text">{status}</p>}
    </section>
  );
}
