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
# Chính biên kỷ 4 Q.70 + kỷ 5 Q.5 + kỷ 6 phụ biên Q.1, Q.20 (Phế đế, Kiến Phúc…, Thành Thái, Duy Tân)
mkdir -p "$R/pb"
get "大南寔錄/大南寔錄正編第四紀/卷70" "$R/cb/cb_四_q70.txt"
get "大南寔錄/大南寔錄正編第五紀/卷5" "$R/cb/cb_五_q5.txt"
for n in 01 20; do get "大南寔錄/大南寔錄正編第六紀附編/卷$n" "$R/pb/pb_$n.txt"; done

# Bài báo về Bảo Đại (nguồn thứ cấp)
mkdir -p "$R/press"
curl -sL -A "Mozilla/5.0" "https://baophapluat.vn/nhung-bi-an-moi-giai-ma-ve-vua-bao-dai-post270847.html" -o "$R/press/bpl.html"
curl -sL -A "Mozilla/5.0" "https://www.sggp.org.vn/bao-dai-hoang-de-cuoi-cung-giai-ma-nhung-bi-an-ve-vua-bao-dai-post466207.html" -o "$R/press/sggp.html"

# Việt Nam sử lược (vi.wikisource, bản 1971, Phần V chương XIV–XV) — trang ghép nên phải qua API parse
mkdir -p "$R/vn"
python3 -I - "$R/vn" <<'PY'
import html, json, re, sys, time, urllib.parse, urllib.request
for ch in ("XII", "XIV", "XV"):
    q = {"action": "parse", "page": f"Việt Nam sử lược/Quyển II/1971/Phần V/Chương {ch}", "prop": "text", "format": "json", "redirects": "1"}
    r = urllib.request.Request("https://vi.wikisource.org/w/api.php?" + urllib.parse.urlencode(q), headers={"User-Agent": "giapha-research/1.0"})
    h = json.load(urllib.request.urlopen(r))["parse"]["text"]["*"]
    h = re.sub(r"<style.*?</style>|<sup.*?</sup>", "", h, flags=re.S)
    h = re.sub(r"</p>|<br\s*/?>|</li>|</h\d>", "\n", h)
    open(f"{sys.argv[1]}/vnsl1971_{ch}.txt", "w").write(html.unescape(re.sub(r"<[^>]+>", "", h)))
    time.sleep(3)
PY
echo "xong → $R"
