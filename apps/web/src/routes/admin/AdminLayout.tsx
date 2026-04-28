import { UploadCloud } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { clearAdminToken } from "../../api/client";

export function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" to="/">
          <UploadCloud aria-hidden="true" />
          <span>return Admin</span>
        </Link>
        <nav className="admin-nav">
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/login">Login</Link>
          <button
            type="button"
            onClick={() => {
              clearAdminToken();
              window.location.href = "/admin/login";
            }}
          >
            Logout
          </button>
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
