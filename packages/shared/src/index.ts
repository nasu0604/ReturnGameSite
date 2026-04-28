export type GameStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface GameSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  thumbnailUrl: string;
  currentVersion: string;
  entryUrl?: string;
}

export interface GameDetail extends GameSummary {
  description?: string;
  buildFiles?: {
    data: string[];
    wasm: string[];
    loader: string[];
  };
  status: GameStatus;
}

export interface UploadRecord {
  id: string;
  originalName: string;
  status: "RECEIVED" | "VALIDATING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorMessage?: string;
}

export interface AdminSession {
  email: string;
  displayName: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminSession;
}
