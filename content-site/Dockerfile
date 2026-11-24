# Bản build tĩnh của content-site (Astro + Pagefind) → nginx.
# Build từ GỐC repo (cần landing/ để lấy giao diện + ảnh dùng chung):
#   docker build -f content-site/Dockerfile -t content-site:local .
FROM node:22-alpine AS build
WORKDIR /app/content-site
COPY content-site/package*.json ./
RUN npm ci
COPY content-site/ ./
COPY landing/ /app/landing/
COPY scripts/build-landing-guides.mjs /app/scripts/build-landing-guides.mjs
RUN npm run build

FROM nginx:1.27-alpine
COPY content-site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/content-site/dist /usr/share/nginx/html
EXPOSE 80
