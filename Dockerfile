# Multi-stage Vite SPA → nginx static image.
#
# Stage 1 builds the bundle with the VITE_* env vars baked in
# (they're consumed by import.meta.env at build time, so they
# must be present when `npm run build` runs — passed in via
# --build-arg from the deploy pipeline).
#
# Stage 2 is a minimal nginx:alpine serving dist/ on :80 with
# the SPA-fallback + cache headers from netlify.toml mirrored
# into nginx.conf.

FROM node:22-alpine AS build
WORKDIR /app

# Cache dep install layer ahead of source copy.
COPY package*.json ./
RUN npm ci

# Now copy the rest and build. Build-args populate Vite env so
# the version footer + Supabase client + Sentry DSN compile in.
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SENTRY_DSN=
ARG VITE_VAPID_PUBLIC_KEY=
ARG VITE_UMAMI_URL=
ARG VITE_UMAMI_WEBSITE_ID=
# vite.config.ts reads GITHUB_SHA / COMMIT_REF to stamp the
# drawer footer ("v0.1.0 · <sha>"). The build context has no
# git binary and .dockerignore drops .git/, so without this
# build-arg we'd fall back to "dev". CI passes the real SHA.
ARG GITHUB_SHA=dev
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV VITE_UMAMI_URL=$VITE_UMAMI_URL
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID
ENV GITHUB_SHA=$GITHUB_SHA
RUN npm run build

# ─── Runtime stage ──────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck — Nginx is up if index.html is served.
# Dùng 127.0.0.1 thay vì localhost: busybox wget thử ::1 (IPv6) trước,
# mà nginx chỉ `listen 80;` (IPv4) → "Connection refused" báo unhealthy giả.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

EXPOSE 80
