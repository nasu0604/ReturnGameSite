ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "creatorNames" JSONB;

UPDATE "Game"
SET "creatorNames" = jsonb_build_array("developer")
WHERE "creatorNames" IS NULL
  AND "developer" IS NOT NULL
  AND btrim("developer") <> '';
