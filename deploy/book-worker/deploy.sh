#!/usr/bin/env bash
# Triển khai book-worker lên máy chủ xuất sổ qua SSH. Chạy từ GỐC repo:
#   BOOK_WORKER_SSH=user@host deploy/book-worker/deploy.sh
# Lần đầu: tạo sẵn /opt/book-worker/worker.env trên máy chủ (mẫu: deploy/book-worker/worker.env.example).
# Địa chỉ máy chủ chỉ nằm trong biến môi trường của người chạy, KHÔNG ghi vào repo.
set -euo pipefail
: "${BOOK_WORKER_SSH:?Đặt BOOK_WORKER_SSH=user@host}"
REMOTE_DIR=${BOOK_WORKER_DIR:-/opt/book-worker}

node book-worker/build.mjs
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp book-worker/dist/worker.mjs "$STAGE/worker.mjs"
cp package.json "$STAGE/root-package.json"
cp deploy/book-worker/Dockerfile deploy/book-worker/docker-compose.yml "$STAGE/"
mkdir -p "$STAGE/assets/icons"
cp -r public/fonts public/avatars public/watermarks "$STAGE/assets/"
cp public/icons/app-icon-192.png "$STAGE/assets/icons/"

tar -C "$STAGE" -czf - . | ssh "$BOOK_WORKER_SSH" "mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"
ssh "$BOOK_WORKER_SSH" "set -e; cd $REMOTE_DIR; test -f worker.env || { echo 'Thiếu $REMOTE_DIR/worker.env'; exit 1; }; chmod 600 worker.env; docker compose up -d --build; docker image prune -f >/dev/null; sleep 5; docker logs --tail 5 book-worker"
