ALTER TABLE public."Comment"
  ADD COLUMN IF NOT EXISTS "gameSlug" text;

UPDATE public."Comment" c
SET "gameSlug" = g.slug
FROM public."Game" g
WHERE g.id = c."gameId";

ALTER TABLE public."Comment"
  ALTER COLUMN "gameSlug" SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_comment_game_slug()
RETURNS trigger AS $$
BEGIN
  SELECT g.slug INTO NEW."gameSlug"
  FROM public."Game" g
  WHERE g.id = NEW."gameId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Comment_set_gameSlug" ON public."Comment";

CREATE TRIGGER "Comment_set_gameSlug"
BEFORE INSERT OR UPDATE OF "gameId" ON public."Comment"
FOR EACH ROW
EXECUTE FUNCTION public.set_comment_game_slug();

CREATE OR REPLACE FUNCTION public.sync_comment_game_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    UPDATE public."Comment"
    SET "gameSlug" = NEW.slug
    WHERE "gameId" = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Game_sync_comment_gameSlug" ON public."Game";

CREATE TRIGGER "Game_sync_comment_gameSlug"
AFTER UPDATE OF slug ON public."Game"
FOR EACH ROW
EXECUTE FUNCTION public.sync_comment_game_slug();
