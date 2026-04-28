# return Game Platform

This branch is the start of the S3/CDN-backed rebuild for the return Game WebGL
portal. The legacy Firebase/CRA site remains in `returngame` and should be kept
intact until the new platform is ready.

## Layout

- `apps/web`: Vite React frontend for the public game portal and admin UI.
- `apps/api`: Express API for auth, games, uploads, comments, ratings, and S3.
- `packages/shared`: Shared TypeScript types.
- `docs/architecture.md`: System design notes and migration direction.
- `returngame`: Existing production-era site, preserved for reference.

## Local Setup

Install dependencies after reviewing the workspace package files:

```bash
npm install
```

Copy environment examples before running services:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

For local admin login, set these values in `apps/api/.env`:

```bash
JWT_SECRET=use-a-long-random-local-secret
ADMIN_EMAIL=admin@returngame.site
ADMIN_PASSWORD=your-local-password
```

Run the apps:

```bash
npm run dev:api
npm run dev:web
```

## Migration Notes

The current goal is to build the new platform next to the existing site, then
migrate reusable assets and game metadata when the upload pipeline is ready.

## Local WebGL Upload Test

Run both services:

```bash
npm run dev:api
npm run dev:web
```

Open `http://localhost:5173/admin`, upload a Unity WebGL `.zip`, then open the
created game from the public list. The local pipeline currently:

- extracts the zip into `apps/api/storage/games/{slug}`;
- validates `index.html`, `Build/*.data`, `Build/*.wasm`, and `Build/*.loader.js`;
- serves the game through `http://localhost:4000/local-games/{slug}/index.html`;
- stores local catalog metadata in `apps/api/storage/catalog.json`.

`apps/api/storage` is intentionally ignored because this is a local test target.
