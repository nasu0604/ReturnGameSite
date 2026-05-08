import { Shield } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

export function RootLayout() {
  const location = useLocation();
  const isGameDetail = location.pathname.startsWith("/games/");
  const isHome = location.pathname === "/";
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className={`app-shell ${isGameDetail ? "game-detail-shell" : ""}`}>
      <header className="site-header">
        <Link className="brand navbar-title" to="/">
          <span>return Game;</span>
        </Link>
        <nav className="site-nav navbar-links">
          <Link className={`nav-link ${isHome ? "active" : ""}`} to="/">
            홈
          </Link>
          <Link className={`nav-link ${isHome ? "active" : ""}`} to="/">
            프로젝트
          </Link>
          <Link className={`nav-link ${isAdmin ? "active" : ""}`} to="/admin">
            <Shield aria-hidden="true" />
            관리자
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
