import type { AdminSession } from "@return-game/shared";
import { Clock3, Database, LogOut, UploadCloud, User, Users } from "lucide-react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { clearAdminToken, getAdminSession, getAdminToken } from "../../api/client";
import logoDiscord from "../../assets/logo_discord.svg";
import logoLong from "../../assets/logo_long.png";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminSignupPage } from "./AdminSignupPage";

export function AdminLayout() {
  const location = useLocation();
  const token = getAdminToken();
  const admin = getAdminSession<AdminSession>();
  const isSignupRoute = location.pathname === "/admin/signup";
  const isLoginRoute = location.pathname === "/admin/login" || location.pathname === "/admin";

  if (!token) {
    return <main className="admin-auth-shell">{isSignupRoute ? <AdminSignupPage /> : <AdminLoginPage />}</main>;
  }

  if (isLoginRoute || isSignupRoute) {
    return <Navigate to="/admin/upload" replace />;
  }

  const isSuperAdmin = admin?.role === "SUPER_ADMIN";
  const superAdminOnlyRoute = location.pathname.startsWith("/admin/history") || location.pathname.startsWith("/admin/managers");

  if (!isSuperAdmin && superAdminOnlyRoute) {
    return <Navigate to="/admin/games" replace />;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand-logo" to="/" onClick={() => window.scrollTo({ top: 0, left: 0 })}>
          <img src={logoLong} alt="return Game" />
        </Link>
        <div className="admin-profile-mini">
          <strong>{admin?.name ?? "관리자"}</strong>
          <span>{admin?.role ?? "MANAGER"}</span>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin/upload">
            <UploadCloud aria-hidden="true" />
            업로드
          </NavLink>
          <NavLink to="/admin/games">
            <Database aria-hidden="true" />
            게임 관리
          </NavLink>
          {isSuperAdmin && (
            <NavLink to="/admin/history">
              <Clock3 aria-hidden="true" />
              연혁 관리
            </NavLink>
          )}
          {isSuperAdmin && (
            <NavLink to="/admin/managers">
              <Users aria-hidden="true" />
              관리자 관리
            </NavLink>
          )}
          <NavLink to="/admin/me">
            <User aria-hidden="true" />내 정보
          </NavLink>
          <button
            type="button"
            onClick={() => {
              clearAdminToken();
              window.location.href = "/admin";
            }}
          >
            <LogOut aria-hidden="true" />
            로그아웃
          </button>
        </nav>
        <div className="admin-sidebar-contact" aria-label="사이트 이용 문의">
          <span>사이트 이용 문의:</span>
          <img src={logoDiscord} alt="" aria-hidden="true" />
          <strong>nasu0604</strong>
        </div>
      </aside>
      <main className="admin-main">
        <div className="route-transition admin-route-transition" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
