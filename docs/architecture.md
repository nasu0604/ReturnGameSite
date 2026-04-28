# return Game Platform Architecture

This branch starts the S3/CDN-backed rebuild while keeping the legacy `returngame`
app untouched for reference and asset migration.

## Goals

- Let admins upload Unity WebGL zip files from the site.
- Store game assets in S3 and serve them through CloudFront.
- Keep game metadata, comments, ratings, uploads, and admin users in PostgreSQL.
- Separate the public game portal from the operational API.

## Project Layout

- `apps/web`: Vite React frontend for public pages and admin screens.
- `apps/api`: Express API for auth, games, uploads, comments, ratings, and S3 work.
- `packages/shared`: Shared TypeScript types used by both apps.
- `returngame`: Legacy Firebase/CRA site, preserved for reference.

## Upload Pipeline Target

1. Admin uploads a Unity WebGL zip.
2. API stores the original zip under an S3 upload prefix.
3. API validates the archive shape.
4. API extracts and publishes files under `games/{slug}/{version}/`.
5. API writes or updates `Game`, `GameVersion`, and `Upload` records.
6. Web app reads game metadata from the API and embeds the CDN entry URL.

## Current Local Pipeline

Before S3 is connected, the API supports a local upload loop:

- `POST /api/uploads/webgl-zip` accepts a multipart zip file.
- The archive is validated for `index.html`, `Build/*.data`, `Build/*.wasm`, and `Build/*.loader.js`.
- Files are extracted to `apps/api/storage/games/{slug}`.
- Games are served at `/local-games/{slug}/index.html`.
- Metadata is written to `apps/api/storage/catalog.json`.

The upload endpoint is protected by a local JWT admin login. During the local
phase, the API reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET` from
`apps/api/.env`. A database-backed admin table already exists in the Prisma
schema and can replace the env-based admin check later.

## Recommended Domains

- `returngame.site`: public frontend.
- `admin.returngame.site`: optional admin frontend alias.
- `api.returngame.site`: backend API.
- `cdn.returngame.site`: CloudFront distribution for WebGL assets.

## Next Milestones

1. Install dependencies and confirm both apps run locally.
2. Implement admin auth and seed the first admin account.
3. Implement WebGL zip upload and validation.
4. Connect S3 upload and CloudFront URLs.
5. Migrate legacy `projects.json` data into PostgreSQL.
