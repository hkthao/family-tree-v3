#!/usr/bin/env bash
# Convert tutorial videos webm → mp4 (H.264) cho compatibility tốt
# (Safari, Edge cũ). Output vào videos/_dist/ — gitignored.
#
# Usage:
#   ./scripts/build-videos.sh
#   ./scripts/build-videos.sh --posters     # cũng extract poster
#
# Requires: ffmpeg trong PATH.
set -euo pipefail

OUT="videos/_dist"
mkdir -p "$OUT"

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg không có trong PATH. brew install ffmpeg" >&2
  exit 1
fi

want_posters=0
for arg in "$@"; do
  if [ "$arg" = "--posters" ]; then want_posters=1; fi
done

count=0
for dir in videos/*-mobile/ videos/*-desktop/; do
  [ -d "$dir" ] || continue
  src="${dir}video.webm"
  [ -f "$src" ] || continue
  name=$(basename "$dir")
  mp4="$OUT/${name}.mp4"
  poster="$OUT/${name}.jpg"

  if [ ! -f "$mp4" ] || [ "$src" -nt "$mp4" ]; then
    echo "→ Convert $name"
    # -crf 23 = quality default. -preset slow = better compression
    # cho 1 lần convert. -movflags +faststart = streaming progressive.
    # -an = drop audio (videos câm — Playwright không record audio).
    ffmpeg -y -hide_banner -loglevel error \
      -i "$src" \
      -c:v libx264 -crf 23 -preset slow -movflags +faststart \
      -pix_fmt yuv420p -an \
      "$mp4"
  else
    echo "  $name (skip — up to date)"
  fi

  if [ "$want_posters" = "1" ] && { [ ! -f "$poster" ] || [ "$src" -nt "$poster" ]; }; then
    echo "  poster $name"
    ffmpeg -y -hide_banner -loglevel error \
      -i "$src" -ss 0.5 -vframes 1 -q:v 4 \
      "$poster"
  fi

  count=$((count + 1))
done

echo
echo "Done. $count files → $OUT/"
ls -lh "$OUT" | tail -n +2 | awk '{print "  ", $9, $5}'
