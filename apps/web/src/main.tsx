import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AdminLayout } from "./routes/admin/AdminLayout";
import { AdminDashboardPage } from "./routes/admin/AdminDashboardPage";
import { AdminLoginPage } from "./routes/admin/AdminLoginPage";
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
      { index: true, element: <AdminDashboardPage /> },
      { path: "login", element: <AdminLoginPage /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
