#!/bin/bash
# Gia hạn chứng chỉ HTTPS của nginx và nạp lại cấu hình.
#
# VÌ SAO CẦN SCRIPT RIÊNG: certbot cài sẵn trên máy chủ chạy theo timer
# của hệ thống, nhưng nó đọc thư mục mặc định /etc/letsencrypt — trong
# khi nginx của app lại nạp cert từ một thư mục KHÁC (mount vào
# container). Hai chỗ đó không liên quan gì tới nhau, nên timer kia chạy
# đều đặn mà cert của app vẫn cứ hết hạn.
#
# Hậu quả đã xảy ra thật: 01/09/2026 cert giapha hết hạn, cả trang chết
# với mọi người dùng, không có cảnh báo nào trước đó. Cert analytics khi
# đó cũng chỉ còn 4 ngày.
#
# Cài trên máy chủ app (địa chỉ thật để ở doc vận hành ngoài repo —
# xem src/test/lib/noInfraSecrets.test.ts):
#   scp deploy/cron/renew-certs.sh <host>:<bin-dir>/
#   ssh <host> "chmod +x <bin-dir>/renew-certs.sh"
#   # crontab: 20 3 * * * <bin-dir>/renew-certs.sh
set -euo pipefail

# Thư mục cert mà nginx thật sự đọc (mount vào container).
CERT_DIR="${CERT_DIR:?đặt CERT_DIR = thư mục cert nginx đang dùng}"
# Thư mục nginx phục vụ /.well-known/acme-challenge/
WEBROOT="${WEBROOT:?đặt WEBROOT = thư mục webroot cho ACME}"
NGINX_CONTAINER="${NGINX_CONTAINER:-genealogy-app-nginx-1}"
LOG="${RENEW_LOG:-$(dirname "$0")/renew-certs.log}"

# `--deploy-hook` chỉ chạy khi THẬT SỰ có cert mới, nên nginx không bị
# nạp lại vô ích mỗi đêm.
# `|| true`: một cấu hình gia hạn cũ bị hỏng cũng làm certbot trả mã lỗi,
# và với `set -e` thì cả script dừng — mất luôn phần ghi hạn bên dưới,
# tức mất đúng cái cảnh báo sớm mà script này sinh ra để có.
certbot renew \
  --webroot -w "$WEBROOT" \
  --config-dir "$CERT_DIR" \
  --work-dir /var/lib/letsencrypt \
  --logs-dir /var/log/letsencrypt \
  --quiet \
  --deploy-hook "docker exec $NGINX_CONTAINER nginx -s reload" \
  >> "$LOG" 2>&1 || echo "[$(date -u +%FT%TZ)] certbot trả mã lỗi — xem log phía trên" >> "$LOG"

# Ghi lại hạn còn của từng cert — để đọc log là biết ngay có gì sắp hết
# hạn, không phải đợi trang chết mới biết.
for d in "$CERT_DIR"/live/*/; do
  name=$(basename "$d")
  [ -f "$d/fullchain.pem" ] || continue
  end=$(openssl x509 -enddate -noout -in "$d/fullchain.pem" | cut -d= -f2)
  echo "[$(date -u +%FT%TZ)] $name hết hạn $end" >> "$LOG"
done
