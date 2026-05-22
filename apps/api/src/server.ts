import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { ErrorRequestHandler } from "express";
import helmet from "helmet";
import { ensureStorageFolders, storagePaths } from "./services/localStorage.js";
import { adminRouter } from "./routes/admin.js";
import { gamesRouter } from "./routes/games.js";
import { historyRouter } from "./routes/history.js";
import { uploadsRouter } from "./routes/uploads.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(apiRoot, ".env") });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

ensureStorageFolders();

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    frameguard: false
  })
);
app.use(
  cors({
    origin: corsOrigin
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/local-games", (_request, response, next) => {
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self' blob: data:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' data: blob:",
      "worker-src 'self' blob:",
      "media-src 'self' data: blob:",
      `frame-ancestors 'self' ${corsOrigin}`
    ].join("; ")
  );
  next();
});
app.use("/local-games", express.static(storagePaths.gamesDir));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "return-game-api" });
});

app.use("/api/admin", adminRouter);
app.use("/api/games", gamesRouter);
app.use("/api/history", historyRouter);
app.use("/api/uploads", uploadsRouter);

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  response.status(400).json({ message });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`return Game API listening on http://localhost:${port}`);
});
