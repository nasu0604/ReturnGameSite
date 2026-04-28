import { Gamepad2, Shield } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

export function RootLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <Gamepad2 aria-hidden="true" />
          <span>return Game;</span>
        </Link>
        <nav className="site-nav">
          <Link to="/">Games</Link>
          <Link to="/admin">
            <Shield aria-hidden="true" />
            Admin
          </Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
