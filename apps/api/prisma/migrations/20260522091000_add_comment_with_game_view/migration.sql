CREATE OR REPLACE VIEW public."CommentWithGame" AS
SELECT
  c.id,
  c."gameId",
  g.slug AS "gameSlug",
  g.title AS "gameTitle",
  c.author,
  c.body,
  c."createdAt",
  c."updatedAt",
  c."deletedAt",
  c."authorIp"
FROM public."Comment" c
JOIN public."Game" g ON g.id = c."gameId";
