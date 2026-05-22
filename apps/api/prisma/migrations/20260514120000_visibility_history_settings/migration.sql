CREATE TYPE "GameVisibility" AS ENUM ('PUBLIC', 'HIDDEN');

ALTER TABLE "Game"
  ADD COLUMN "visibility" "GameVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "tags" JSONB;

UPDATE "Game"
SET "visibility" = CASE
  WHEN "status" = 'PUBLISHED' THEN 'PUBLIC'::"GameVisibility"
  ELSE 'HIDDEN'::"GameVisibility"
END;

ALTER TABLE "ClubHistory"
  ADD COLUMN "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ClubHistory"
SET "eventDate" = "createdAt"
WHERE "eventDate" IS NULL;

DROP INDEX IF EXISTS "ClubHistory_status_displayOrder_idx";
CREATE INDEX "ClubHistory_status_eventDate_idx" ON "ClubHistory"("status", "eventDate");

ALTER TABLE "ClubHistory"
  DROP COLUMN IF EXISTS "tags",
  DROP COLUMN IF EXISTS "displayOrder";

CREATE TABLE "SiteSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);
