# Travel blog & portfolio

A bilingual (English / 日本語) travel blog and portfolio, self-hosted on a home Linux server.

- **Blog & portfolio** built from a block-based editor (cover, wide, image + text, 3 portrait photos, text, video)
- **English ⇄ Japanese**: write in either language; DeepL translates on demand, and only re-translates fields whose source changed so manual edits to translations are kept
- **Family accounts**: invite-only, passwordless (magic-link) sign-in, private threaded comments, profile photos
- **Mailing list** with double opt-in, one-click unsubscribe, and an optional email to subscribers when you publish
- **Privacy**: GPS/camera metadata is stripped from every uploaded photo and video

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · PostgreSQL 18 + Prisma 7 · Better Auth · Tiptap · sharp + ffmpeg · Docker Compose · nginx · Cloudflare Tunnel · GitHub Actions

---

## Project layout

```
src/
  app/[lang]/        public site (home/about, blog, portfolio, contact, sign-in, profile…)
  app/admin/         admin portal (post editor, invites, subscribers, messages)
  app/api/           auth, media uploads, one-click unsubscribe
  components/        UI (block renderer, header, comments, admin editor…)
  dictionaries/      en.json / ja.json — all fixed UI text
  config/site.ts     your name and social links
  lib/               data access, auth, uploads, translation, email, newsletter
prisma/              database schema and migrations
deploy/              nginx config, backup and deploy scripts
tests/               unit tests (npm test)
```

## Customizing

| What | Where |
| --- | --- |
| Colors (light & dark) | the `SITE COLORS` block at the top of `src/app/globals.css` |
| Your name, social links | `src/config/site.ts` |
| About-me text and all UI wording | `src/dictionaries/en.json` and `ja.json` (Japanese must have every key English has, or the build fails) |
| Fonts | `src/app/fonts.ts` |

---

## Local development (Windows)

Requires Node.js 24, PostgreSQL and ffmpeg (all installed via winget).

```bash
npm install
npm run db:migrate        # create/update tables
npm run db:seed-demo      # optional: two demo posts with placeholder photos
npm run dev               # http://localhost:3000
```

`.env` holds local settings. Without `RESEND_API_KEY`, emails (sign-in links, confirmations) are **printed to the terminal** instead of being sent — copy the link from there. Sign in with the `ADMIN_EMAIL` address to get the admin portal at `/admin`.

Checks: `npm run lint`, `npm run typecheck`, `npm test`.

---

## Deploying to the home server

### How it fits together

```
visitor ──https──> Cloudflare ──tunnel──> cloudflared ─> nginx ─┬─> /media/*  (files on disk)
                                                                 └─> app (Next.js) ─> db (Postgres)
git push ─> GitHub Actions: lint, typecheck, test, build images ─> ghcr.io ─> server pulls them
```

No ports need to be open on your router: the Cloudflare Tunnel is an outbound connection.

### 1. GitHub

1. Create a repository and push this folder to it (`main` branch).
2. **Settings → Secrets and variables → Actions → Variables**: add `SITE_URL` = `https://yourdomain.com`.
3. Every push to `main` runs the checks and publishes two images: `ghcr.io/<you>/<repo>:latest` and `:migrator`.
4. If the repository is **public** (recommended for a portfolio), make the package public too (**Your profile → Packages → the package → Package settings → Change visibility**). If it's private, run `docker login ghcr.io` on the server once with a personal access token that has `read:packages`.

### 2. Server (first time)

```bash
git clone https://github.com/<you>/<repo>.git ~/site
cd ~/site
cp .env.production.example .env
nano .env               # fill in — generate secrets with: openssl rand -hex 32
chmod +x deploy/*.sh
./deploy/deploy.sh
```

The site is now on your LAN at `http://<server-ip>:8080`. Sign in with your `ADMIN_EMAIL`, then open `/admin`.

### 3. Domain → Cloudflare (domain stays registered at GoDaddy)

1. Create a free Cloudflare account → **Add a site** → enter your domain → Free plan. Cloudflare imports your existing DNS records; check they look right (especially MX records if you use email on the domain).
2. Cloudflare shows two **nameservers**. In GoDaddy: **My Products → your domain → DNS → Nameservers → Change → "I'll use my own nameservers"** and enter them.
3. Wait until Cloudflare says the site is active (often under an hour, up to 24h).
4. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** (type *Cloudflared*). Copy the **token** into `CLOUDFLARE_TUNNEL_TOKEN` in `.env`.
5. In the tunnel, add **Public hostnames**: `yourdomain.com` (and `www`) → service `http://nginx:80`.
6. `./deploy/deploy.sh` — it starts `cloudflared` automatically once the token is set.
7. Once the site works through the domain, **remove the port-forwarding rules from your router** — they're no longer needed.

### 4. Email (Resend)

1. Sign up at resend.com → **Domains → Add domain** → add the DNS records it shows in Cloudflare → verify.
2. Create an API key → `RESEND_API_KEY`. Set `EMAIL_FROM` to an address on that domain.
3. `./deploy/deploy.sh`.

The free tier sends 3,000 emails/month (100/day): plenty for magic links and a modest mailing list.

### 5. Translation (DeepL)

Sign up for **DeepL API Free** (500,000 characters/month), copy the key into `DEEPL_API_KEY`, redeploy.

### Updating

Push to `main`, wait for the GitHub Action to finish, then on the server:

```bash
cd ~/site && git pull && ./deploy/deploy.sh
```

(`git pull` is only needed when `docker-compose.yml` or `deploy/` changed.) Database migrations run automatically.

---

## Backups

The `backup` container runs daily:

- `~/site/backups/db/db_<date>.dump` — full database dump (last 14 days kept, `BACKUP_KEEP_DAYS`)
- `~/site/backups/uploads/` — a copy of every uploaded file

That folder is on the same disk as the site, so **also copy it somewhere else** regularly (an external drive, another computer, or cloud storage such as Backblaze B2 via `rclone`).

**Restore the database** (replaces current data):

```bash
cd ~/site
docker compose stop app
docker compose exec -T db pg_restore --clean --if-exists -U site -d site < backups/db/db_YYYY-MM-DD_HHMM.dump
docker compose start app
```

**Restore uploads:** `docker compose cp backups/uploads/. app:/data/uploads/`

---

## Notes & limits

- Video uploads are limited to 95 MB (Cloudflare's free plan rejects requests over 100 MB). Longer videos: upload to YouTube and use a YouTube block.
- iPhone **HEIC** photos aren't supported by the image processor — iPhones usually convert to JPEG when uploading through a browser; otherwise export as JPEG first.
- Subscriber emails are sent in English; translated posts fall back to the source language until translated.
