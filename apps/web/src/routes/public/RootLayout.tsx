import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import logoGithub from "../../assets/logo_github.svg";
import logoInsta from "../../assets/logo_insta.svg";
import logoLong from "../../assets/logo_long.png";

export function RootLayout() {
  useEffect(() => {
    document.documentElement.classList.add("public-route");

    return () => {
      document.documentElement.classList.remove("public-route");
    };
  }, []);

  return (
    <div className="app-shell public-shell">
      <main>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="public-footer-container">
          <div className="public-footer-left">
            <div className="public-footer-brand">
              <img src={logoLong} alt="return Game" />
              <div className="public-social-buttons">
                <a href="https://www.instagram.com/_return_game_" target="_blank" rel="noopener noreferrer">
                  <img src={logoInsta} alt="Instagram" />
                </a>
                <a href="https://github.com/KH-ReturnGame" target="_blank" rel="noopener noreferrer">
                  <img src={logoGithub} alt="GitHub" />
                </a>
              </div>
            </div>
          </div>
          <div className="public-footer-right">
            <p className="public-footer-text">
              사이트 내 일부 외부 자료의 저작권은 해당 원저작자에게 있으며,
              <br />
              본 동아리는 이를 교육 및 비영리적 학습 목적으로만 사용하였습니다.
              <br />
              <Link className="copyright-admin-link" to="/admin">
                Copyright © 2025 return Game, All rights reserved.
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
