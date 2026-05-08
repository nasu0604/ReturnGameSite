import type { AdminSession } from "@return-game/shared";
import { Database, LogOut, UploadCloud, User, Users } from "lucide-react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { clearAdminToken, getAdminSession, getAdminToken } from "../../api/client";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminSignupPage } from "./AdminSignupPage";

export function AdminLayout() {
  const location = useLocation();
  const token = getAdminToken();
  const admin = getAdminSession<AdminSession>();
  const isSignupRoute = location.pathname === "/admin/signup";
  const isLoginRoute = location.pathname === "/admin/login" || location.pathname === "/admin";

  if (!token) {
    return isSignupRoute ? <AdminSignupPage /> : <AdminLoginPage />;
  }

  if (isLoginRoute || isSignupRoute) {
    return <Navigate to="/admin/upload" replace />;
  }

  const isSuperAdmin = admin?.role === "SUPER_ADMIN";

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" to="/admin/upload">
          <Database aria-hidden="true" />
          <span>return Admin</span>
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
            {isSuperAdmin ? "게임 관리" : "내 게임 관리"}
          </NavLink>
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
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
