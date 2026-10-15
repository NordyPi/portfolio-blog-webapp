# syntax=docker/dockerfile:1.7
# Two images are built from this file:
#   --target runner    the website            (ghcr.io/<you>/<repo>:latest)
#   --target migrator  applies DB migrations  (ghcr.io/<you>/<repo>:migrator)

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dependencies (incl. dev deps: needed for the build and for `prisma migrate`) ----
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, which only needs a syntactically valid URL.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm ci

# ---- build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into page metadata (canonical URLs); the rest of the config is read at runtime.
ARG SITE_URL=http://localhost:3000
ENV SITE_URL=$SITE_URL
# Placeholders so modules can be imported during the build. No database is contacted at build
# time, and the real values come from the server's .env at runtime.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-never-used-at-runtime" \
    npx prisma generate && \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-never-used-at-runtime" \
    npm run build

# ---- migrator: `prisma migrate deploy`, then exit ----
FROM base AS migrator
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runner: the website ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads
# ffmpeg transcodes uploaded videos (and strips their location metadata).
RUN apk add --no-cache ffmpeg \
 && addgroup -S -g 1001 app && adduser -S -u 1001 -G app app \
 && mkdir -p /data/uploads && chown -R app:app /data
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
