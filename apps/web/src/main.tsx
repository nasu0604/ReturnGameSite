import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AdminLayout } from "./routes/admin/AdminLayout";
import { AdminDashboardPage } from "./routes/admin/AdminDashboardPage";
import { AdminGameEditPage } from "./routes/admin/AdminGameEditPage";
import { AdminGameListPage } from "./routes/admin/AdminGameListPage";
import { AdminLoginPage } from "./routes/admin/AdminLoginPage";
import { AdminManagersPage } from "./routes/admin/AdminManagersPage";
import { AdminMePage } from "./routes/admin/AdminMePage";
import { AdminSignupPage } from "./routes/admin/AdminSignupPage";
import { GameDetailPage } from "./routes/public/GameDetailPage";
import { GameListPage } from "./routes/public/GameListPage";
import { RootLayout } from "./routes/public/RootLayout";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <GameListPage /> },
      { path: "games/:slug", element: <GameDetailPage /> }
    ]
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/upload" replace /> },
      { path: "login", element: <AdminLoginPage /> },
      { path: "signup", element: <AdminSignupPage /> },
      { path: "upload", element: <AdminDashboardPage /> },
      { path: "games", element: <AdminGameListPage /> },
      { path: "games/:id", element: <AdminGameEditPage /> },
      { path: "managers", element: <AdminManagersPage /> },
      { path: "me", element: <AdminMePage /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
