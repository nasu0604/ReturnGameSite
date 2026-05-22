-- Store comment timestamps as Korea local wall-clock time so Supabase table
-- management shows the same time users see on the site.
UPDATE "Comment"
SET
  "createdAt" = "createdAt" + INTERVAL '9 hours',
  "updatedAt" = "updatedAt" + INTERVAL '9 hours',
  "deletedAt" = CASE
    WHEN "deletedAt" IS NULL THEN NULL
    ELSE "deletedAt" + INTERVAL '9 hours'
  END;

ALTER TABLE "Comment"
  ALTER COLUMN "createdAt" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul'),
  ALTER COLUMN "updatedAt" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul');
