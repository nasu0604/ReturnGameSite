import type { LoginResponse } from "@return-game/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPostJson, setAdminSession, setAdminToken } from "../../api/client";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setStatus("로그인하는 중입니다.");

    try {
      const payload = await apiPostJson<LoginResponse>("/admin/login", {
        loginId: String(formData.get("loginId") ?? ""),
        password: String(formData.get("password") ?? "")
      });

      setAdminToken(payload.token);
      setAdminSession(payload.admin);
      navigate("/admin/upload");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    }
  }

  return (
    <section className="admin-panel narrow admin-login-panel">
      <div className="section-heading compact">
        <p className="eyebrow">Admin access</p>
        <h1>관리자 로그인</h1>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          아이디
          <input type="text" name="loginId" autoComplete="username" required />
        </label>
        <label>
          비밀번호
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="primary-action" type="submit">
          로그인
        </button>
      </form>
      <Link className="auth-switch-link" to="/admin/signup">
        세부 관리자 회원가입
      </Link>
      {status && <p className="status-text">{status}</p>}
    </section>
  );
}
