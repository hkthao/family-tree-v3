# book-worker — dịch vụ dựng Sổ gia phả PDF (xem docs/plan-may-chu-xuat-so.md).
# Build từ thư mục "staging" do deploy/book-worker/deploy.sh dựng (worker.mjs đã gộp + assets + package.json gốc).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PDF_ASSET_DIR=/app/assets
# Bộ dựng PDF (react-pdf + react) cài riêng theo ĐÚNG phiên bản trong package.json gốc, như Dockerfile.mcp.
COPY root-package.json /tmp/root-package.json
RUN node -e "const p=require('/tmp/root-package.json');const v=(n)=>(p.dependencies?.[n]??p.devDependencies?.[n]).replace(/^[^0-9]*/,'');console.log(['@react-pdf/renderer','react'].map(n=>n+'@'+v(n)).join(' '))" > /tmp/pkgs.txt \
 && npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund $(cat /tmp/pkgs.txt) \
 && rm -rf /tmp/root-package.json /tmp/pkgs.txt /root/.npm
COPY assets ./assets
COPY worker.mjs ./worker.mjs
USER node
# Trần heap V8 thấp hơn mem_limit của container để Node tự báo lỗi thay vì bị OOM-kill đột ngột.
CMD ["node", "--max-old-space-size=700", "worker.mjs"]
