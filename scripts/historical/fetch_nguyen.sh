#!/usr/bin/env bash
# Tải nguyên văn chữ Hán các nguồn Nhà Nguyễn từ zh.wikisource vào MỘT thư mục riêng
# (dữ liệu tải về — không chạy gì trong đó).
#
#   bash scripts/historical/fetch_nguyen.sh /tmp/nguyen-src
#
# Bản wikitext thô (còn template {{漏字}}, {{*}}, {{注}}) — làm sạch khi so trích dẫn.
# Chờ 3 giây giữa các lần tải vì Wikimedia trả 429 nếu dồn dập.
#
# Phủ sóng (kiểm 01/11/2026):
#   前編  Đại Nam thực lục Tiền biên  — đủ 12 quyển (9 chúa Nguyễn, Q.1–12, tên trang 卷01…卷12)
#   正編  Chính biên kỷ 1–7 — CHỈ có vài quyển (thường Q.1 = tiểu dẫn vua); thiếu quyển cuối
#         (mất, thụy hiệu, lăng) của hầu hết các vua → các dữ kiện này cần nguồn khác
#   列傳  Liệt truyện sơ tập (hậu phi, hoàng tử, công chúa đời Gia Long: Q.1–3) và
#         nhị tập (Q.1–4 hậu phi, Q.5–… hoàng tử đời Minh Mạng, Thiệu Trị…) — đủ để dựng
#         hậu/con của các vua đầu.
set -euo pipefail
R="${1:?cần thư mục đích}"
mkdir -p "$R/tb" "$R/cb" "$R/lt1" "$R/lt2"
UA="giapha-research/1.0"

get() {  # get <tên trang> <file đích>
  curl -sL -A "$UA" --get --data-urlencode "title=$1" --data "action=raw" \
    "https://zh.wikisource.org/w/index.php" -o "$2"
  sleep 3
}

for n in 01 02 03 04 05 06 07 08 09 10 11 12; do get "大南寔錄/大南寔錄前編/卷$n" "$R/tb/tb_$n.txt"; done

# Chính biên: mỗi kỷ đặt tên quyển khác nhau (卷01 / 卷001 / 卷1) — chỉ lấy Q.1 của kỷ 1–7.
for k in 一:01 二:001 三:01 四:01 五:1 六:01 七:01; do
  get "大南寔錄/大南寔錄正編第${k%%:*}紀/卷${k##*:}" "$R/cb/cb_${k%%:*}_q1.txt"
done

for n in 01 02 03; do get "大南寔錄/大南正編列傳初集/卷$n" "$R/lt1/lt1_$n.txt"; done
for n in 01 02 03 04 05 06 07 08; do get "大南寔錄/大南正編列傳二集/卷$n" "$R/lt2/lt2_$n.txt"; done
echo "xong → $R"
