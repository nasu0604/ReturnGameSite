import type { LoginResponse } from "@return-game/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPostJson, setAdminToken } from "../../api/client";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setStatus("Signing in...");

    try {
      const payload = await apiPostJson<LoginResponse>("/admin/login", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      });

      setAdminToken(payload.token);
      navigate("/admin");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  return (
    <section className="admin-panel narrow">
      <div className="section-heading compact">
        <p className="eyebrow">Admin access</p>
        <h1>Sign in</h1>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="primary-action" type="submit">
          Sign in
        </button>
      </form>
      {status && <p className="status-text">{status}</p>}
    </section>
  );
}
