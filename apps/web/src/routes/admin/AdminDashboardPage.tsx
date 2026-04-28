import type { GameDetail } from "@return-game/shared";
import { UploadCloud } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPostForm, getAdminToken } from "../../api/client";

interface UploadResponse {
  game: GameDetail;
}

export function AdminDashboardPage() {
  const [status, setStatus] = useState("");
  const [uploadedGame, setUploadedGame] = useState<GameDetail | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!getAdminToken()) {
      setStatus("Sign in before uploading.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("Uploading and validating zip...");
    setUploadedGame(null);

    try {
      const payload = await apiPostForm<UploadResponse>("/uploads/webgl-zip", formData);
      setUploadedGame(payload.game);
      setStatus("Upload completed.");
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <section className="admin-panel">
      <div className="section-heading compact">
        <p className="eyebrow">Operations</p>
        <h1>WebGL upload</h1>
      </div>
      <form className="upload-form" onSubmit={handleSubmit}>
        <label>
          Game title
          <input name="title" placeholder="Dash Hero" />
        </label>
        <label>
          Slug
          <input name="slug" placeholder="dash-hero" />
        </label>
        <label>
          Short description
          <input name="shortDescription" placeholder="A short line for the game card" />
        </label>
        <label>
          Unity WebGL zip
          <input name="file" type="file" accept=".zip,application/zip" required />
        </label>
        <button className="primary-action" type="submit">
          <UploadCloud aria-hidden="true" />
          Upload zip
        </button>
      </form>
      {status && <p className="status-text">{status}</p>}
      {uploadedGame && (
        <div className="upload-result">
          <strong>{uploadedGame.title}</strong>
          <Link to={`/games/${uploadedGame.slug}`}>Open game</Link>
        </div>
      )}
    </section>
  );
}
