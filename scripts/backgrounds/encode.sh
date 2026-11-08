#!/bin/sh
# PNG → WebP trong public/backgrounds. Dùng: encode.sh <buildDir>. Vượt ngân sách (lg 256KB, sm 160KB) thì báo lỗi.
set -e
src=${1:-build-bg}; out=public/backgrounds; mkdir -p "$out"; fail=0
for f in "$src"/*.png; do
  b=$(basename "$f" .png)
  case $b in *-lg) q=72; max=262144;; *) q=70; max=163840;; esac
  cwebp -quiet -q $q -m 6 "$f" -o "$out/$b.webp"
  s=$(stat -f%z "$out/$b.webp" 2>/dev/null || stat -c%s "$out/$b.webp")
  echo "$b $((s/1024))KB"; [ "$s" -le "$max" ] || { echo "  VƯỢT NGÂN SÁCH"; fail=1; }
done
exit $fail
