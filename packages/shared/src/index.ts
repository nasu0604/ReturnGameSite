export type GameStatus = "PUBLIC" | "HIDDEN";
export type AdminRole = "SUPER_ADMIN" | "MANAGER";
export type AdminStatus = "ACTIVE" | "DISABLED";
export type HistoryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface GameSummary {
  id: string;
  slug: string;
  title: string;
  year?: number;
  developer?: string;
  difficulty?: number;
  shortDescription: string;
  thumbnailUrl: string;
  creatorNames?: string[];
  currentVersion: string;
  entryUrl?: string;
  viewCount: number;
  commentCount: number;
}

export interface GameDetail extends GameSummary {
  description?: string;
  copyrightNotice?: string;
  buildFiles?: {
    data: string[];
    wasm: string[];
    loader: string[];
  };
  status: GameStatus;
}

export interface GameComment {
  id: string;
  gameId: string;
  author: string;
  body: string;
  authorIp?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface AdminGameRecord extends GameDetail {
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  creators: AdminUserSummary[];
  canManage: boolean;
  isCreator: boolean;
}

export interface AdminAuditLogRecord {
  id: string;
  action: string;
  targetType: string;
  targetId?: string;
  summary: string;
  admin?: AdminUserSummary;
  createdAt: string;
}

export interface AdminManagerGameRecord {
  id: string;
  slug: string;
  title: string;
  year?: number;
  creatorNames?: string[];
  registeredAt: string;
}

export interface ClubHistoryRecord {
  id: string;
  eventDate: string;
  dateLabel: string;
  title: string;
  summary: string;
  description: string;
  status: HistoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  loginId: string;
  role: AdminRole;
  status: AdminStatus;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface ManagerInviteRecord {
  id: string;
  name: string;
  claimedByAdminUserId?: string;
  claimedBy?: AdminUserSummary;
  createdAt: string;
  updatedAt: string;
}

export interface UploadRecord {
  id: string;
  originalName: string;
  status: "RECEIVED" | "VALIDATING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorMessage?: string;
  progress?: UploadProgress;
}

export interface UploadProgress {
  totalFiles: number;
  uploadedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  percent: number;
  currentFile?: string;
}

export interface AdminSession {
  id: string;
  name: string;
  loginId: string;
  role: AdminRole;
  status: AdminStatus;
  email?: string;
  displayName: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminSession;
}
