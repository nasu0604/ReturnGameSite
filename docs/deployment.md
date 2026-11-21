# ReturnGameSite Deployment Checklist

This deployment keeps Supabase PostgreSQL, AWS S3, and CloudFront CDN in place.

Do not commit real secret values. Use the variable names below in each hosting console or server `.env`.

## Production Environment Variables

### Cloudflare Pages, `apps/web`

- `VITE_API_BASE_URL=https://api.returngame.site/api`
- `VITE_CDN_BASE_URL=https://cdn.returngame.site`

### AWS Lightsail, `apps/api/.env`

- `NODE_ENV=production`
- `PORT=4000`
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `AWS_REGION`
- `S3_BUCKET`
- `S3_UPLOAD_PREFIX`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `CDN_BASE_URL=https://cdn.returngame.site`
- `CORS_ORIGIN=https://returngame.site`

## Cloudflare Pages

- Root directory: repository root
- Install command: `npm ci`
- Build command: `npm run build -w apps/web`
- Build output directory: `apps/web/dist`
- Node.js version: `20` or newer
- Environment variable for Node version if needed: `NODE_VERSION=20`
- Production branch: the branch you deploy from
- Environment variables: set the `apps/web` variables listed above

The web build emits separate HTML for the home and about pages. Cloudflare Pages serves `about.html` at `/about`. The rules in `apps/web/public/_redirects` preserve direct game and admin links by serving their React entry pages.

## Search Engine Setup

1. Confirm that `https://returngame.site/`, `/about`, `/robots.txt`, and `/sitemap.xml` are publicly reachable on the production domain.
2. In [Google Search Console](https://search.google.com/search-console), add the domain `returngame.site` and publish the DNS TXT record Google assigns at the active DNS provider. For HTML-tag verification instead, select the URL-prefix property `https://returngame.site/` and set `GOOGLE_SITE_VERIFICATION` in the Cloudflare Pages production build environment.
3. In [Naver Search Advisor](https://searchadvisor.naver.com/), register `https://returngame.site` and select HTML-tag verification. Set `NAVER_SITE_VERIFICATION` in the Cloudflare Pages production build environment. For both variables, copy only the value of the tag's `content` attribute.
4. Redeploy when using HTML-tag verification and verify ownership in the corresponding console. Submit `https://returngame.site/sitemap.xml` to both consoles. The sitemap lists the home and about pages. Then use URL Inspection in Google and 웹페이지 수집 in Naver to request the home and about pages.

## Lightsail API Deployment

Use Ubuntu with Node.js 20 or newer. The API listens on `127.0.0.1:4000` behind Nginx.

1. Clone or upload the repository to `/var/www/ReturnGameSite`.
2. Create `/var/www/ReturnGameSite/apps/api/.env` from `apps/api/.env.production.example`.
3. Install dependencies from the repository root:
   ```bash
   npm ci
   ```
4. Generate Prisma Client and build:
   ```bash
   npm run prisma:generate -w apps/api
   npm run build
   ```
5. Apply migrations to Supabase:
   ```bash
   npm run prisma:migrate:deploy -w apps/api
   ```
6. Start with PM2:
   ```bash
   npm install -g pm2
   pm2 start apps/api/ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```

Alternatively, adapt `apps/api/deploy/return-game-api.service.example` for systemd.

## Nginx and HTTPS

1. Copy `apps/api/deploy/nginx-api.returngame.site.conf.example` to `/etc/nginx/sites-available/api.returngame.site`.
2. Enable it:
   ```bash
   sudo ln -s /etc/nginx/sites-available/api.returngame.site /etc/nginx/sites-enabled/api.returngame.site
   sudo nginx -t
   sudo systemctl reload nginx
   ```
3. Issue TLS with Certbot after DNS points to Lightsail:
   ```bash
   sudo certbot --nginx -d api.returngame.site
   ```

The Nginx config keeps large WebGL zip uploads working with `client_max_body_size 1100m` and long proxy timeouts.

## Gabia DNS

- `returngame.site`: point to Cloudflare Pages using the Pages custom domain instructions.
- `www.returngame.site`: optional, point to the same Cloudflare Pages project or redirect to apex.
- `api.returngame.site`: `A` record to the Lightsail static public IP.
- `cdn.returngame.site`: keep the existing CloudFront DNS target, usually a `CNAME` to the CloudFront distribution domain.

Avoid pointing the apex and API records to the same service unless Cloudflare Pages explicitly gives the required target.

## Post-Deployment Verification

1. `https://api.returngame.site/api/health` returns `{ "ok": true }`.
2. `https://returngame.site` loads the frontend.
3. Browser network calls go to `https://api.returngame.site/api`.
4. Admin login succeeds.
5. New WebGL zip upload succeeds and upload progress reaches completed.
6. Existing game WebGL zip replacement succeeds.
7. Game iframe loads from `https://cdn.returngame.site/.../index.html`.
8. Thumbnail and history image URLs use `https://cdn.returngame.site`.
9. Comments can be created and deleted.
10. Game view count increments.
11. Refreshing deep links such as `/admin` or a game detail URL works.
