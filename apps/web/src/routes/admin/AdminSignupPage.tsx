import type { LoginResponse } from "@return-game/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPostJson, setAdminSession, setAdminToken } from "../../api/client";

export function AdminSignupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setStatus("회원가입 처리 중...");

    try {
      const payload = await apiPostJson<LoginResponse>("/admin/signup", {
        name: String(formData.get("name") ?? ""),
        loginId: String(formData.get("loginId") ?? ""),
        securityCode: String(formData.get("securityCode") ?? ""),
        password: String(formData.get("password") ?? ""),
        passwordConfirm: String(formData.get("passwordConfirm") ?? "")
      });

      setAdminToken(payload.token);
      setAdminSession(payload.admin);
      navigate("/admin/upload");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "회원가입에 실패했습니다.");
    }
  }

  return (
    <section className="admin-panel narrow">
      <div className="section-heading compact">
        <p className="eyebrow">Manager signup</p>
        <h1>세부 관리자 회원가입</h1>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          이름
          <input name="name" required />
        </label>
        <label>
          아이디
          <input name="loginId" required />
        </label>
        <label>
          보안코드
          <input type="password" name="securityCode" required />
        </label>
        <label>
          비밀번호
          <input type="password" name="password" minLength={6} required />
        </label>
        <label>
          비밀번호 확인
          <input type="password" name="passwordConfirm" minLength={6} required />
        </label>
        <button className="primary-action" type="submit">
          가입
        </button>
      </form>
      <Link className="auth-switch-link" to="/admin">
        로그인으로 돌아가기
      </Link>
      {status && <p className="status-text">{status}</p>}
    </section>
  );
}
