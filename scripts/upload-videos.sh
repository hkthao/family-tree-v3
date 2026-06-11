#!/usr/bin/env bash
# Đẩy videos đã convert (videos/_dist/) lên VPS qua rsync.
#
# Cần env vars trong .env.deploy:
#   VPS_HOST       — IP / hostname
#   VPS_USER       — SSH user
#   VIDEOS_PATH    — đường dẫn đích trên VPS, vd "/var/www/giapha/static/videos"
#                    (mặc định nếu không set)
#
# Usage:
#   ./scripts/upload-videos.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env.deploy nếu có.
if [ -f "$ROOT/.env.deploy" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env.deploy"
  set +a
fi

: "${VPS_HOST:?Cần VPS_HOST (set ở .env.deploy)}"
: "${VPS_USER:?Cần VPS_USER (set ở .env.deploy)}"
VIDEOS_PATH="${VIDEOS_PATH:-/var/www/giapha/static/videos}"

LOCAL_DIR="$ROOT/videos/_dist"
if [ ! -d "$LOCAL_DIR" ]; then
  echo "Chưa có $LOCAL_DIR. Chạy ./scripts/build-videos.sh trước." >&2
  exit 1
fi

echo "Uploading $LOCAL_DIR → $VPS_USER@$VPS_HOST:$VIDEOS_PATH"
echo

# Tạo thư mục đích trước (sshpass-free, dùng key auth từ .ssh/config).
ssh "$VPS_USER@$VPS_HOST" "mkdir -p '$VIDEOS_PATH' && chmod 755 '$VIDEOS_PATH'"

# rsync — chỉ push file mới/khác. --delete để clean orphan ở đích.
rsync -avh --delete \
  --include="*.mp4" --include="*.jpg" --exclude="*" \
  "$LOCAL_DIR/" \
  "$VPS_USER@$VPS_HOST:$VIDEOS_PATH/"

echo
echo "Done. Files giờ phục vụ tại https://giapha.thaohk.com/static/videos/<name>.mp4"
echo "Kiểm tra: curl -I https://giapha.thaohk.com/static/videos/01-tao-dong-ho-desktop.mp4"
