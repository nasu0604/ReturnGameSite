CREATE TYPE "HistoryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "ClubHistory" (
    "id" TEXT NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "tags" JSONB,
    "status" "HistoryStatus" NOT NULL DEFAULT 'DRAFT',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubHistory_status_displayOrder_idx" ON "ClubHistory"("status", "displayOrder");

INSERT INTO "ClubHistory" (
    "id",
    "dateLabel",
    "title",
    "summary",
    "description",
    "imageUrl",
    "tags",
    "status",
    "displayOrder",
    "createdAt",
    "updatedAt"
) VALUES
(
    'dummy-history-2024-start',
    '2024',
    '동아리 전시 시작',
    '처음으로 WebGL 게임 전시를 시작했습니다.',
    'return Game은 게임을 직접 만들고 전시하는 경험을 중심으로 활동을 시작했습니다. 작은 프로토타입부터 플레이 가능한 WebGL 결과물까지, 동아리원들이 직접 기획하고 구현하는 흐름을 만들었습니다.',
    NULL,
    '["시작", "전시", "WebGL"]',
    'PUBLISHED',
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'dummy-history-2025-festival',
    '2025',
    '경황제 전시',
    '축제에서 동아리 게임을 직접 플레이할 수 있게 전시했습니다.',
    '경황제 현장에서 방문자가 직접 게임을 실행하고 피드백을 남길 수 있도록 전시 환경을 구성했습니다. 개발자와 플레이어가 같은 공간에서 반응을 확인하며 게임을 개선하는 계기가 되었습니다.',
    NULL,
    '["축제", "피드백", "전시"]',
    'PUBLISHED',
    20,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'dummy-history-2026-renewal',
    '2026',
    'return Game 리뉴얼',
    '게임 업로드와 댓글, 관리자 기능을 갖춘 전시 플랫폼으로 확장했습니다.',
    'Unity WebGL 게임을 더 쉽게 업로드하고 전시할 수 있도록 사이트 구조를 새로 정리했습니다. S3와 CDN 기반 배포, 게임별 댓글, 관리자 권한 관리 등 운영형 전시 사이트로 발전시키고 있습니다.',
    NULL,
    '["리뉴얼", "운영", "플랫폼"]',
    'PUBLISHED',
    30,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
