"""Kiểm mọi trích dẫn chính sử trong file nháp: đoạn trích có THẬT trong nguyên
văn quyển ghi ở locator, và nằm đúng năm can chi ghi trong locator
("năm Giáp Ngọ (1234)").

Nguồn hỗ trợ (nguyên văn chữ Hán, zh.wikisource):
  TT  Đại Việt sử ký toàn thư  — locator "Bản kỷ Q.5, …"      → <root>/tt/q_五.txt
  CM  Khâm định Việt sử thông giám cương mục — "Chính biên Q.9, …" → <root>/cm/cm_九.txt
  VSL Việt sử lược, phụ "陳朝紀年" — "Phụ lục Trần triều kỷ niên" → <root>/vsl_tran.txt

Tải nguyên văn vào một thư mục riêng (dữ liệu tải về — không chạy gì trong đó):
  R=/tmp/sources && mkdir -p $R/tt $R/cm
  get() { curl -s -A "giapha-research/1.0" --get --data-urlencode "title=$1" \\
            --data "action=raw" "https://zh.wikisource.org/w/index.php" -o "$2"; }
  for q in 四 五 六 七 八; do get "大越史記全書/本紀卷之$q" $R/tt/q_$q.txt; done
  for q in 五 六 七 八 九 十 十一; do get "欽定越史通鑑綱目/正編/卷之$q" $R/cm/cm_$q.txt; done
  get "越史略/附陳朝紀年" $R/vsl_tran.txt

Chạy:  python3 -I scripts/historical/verify_quotes.py data/historical/tran.json $R

Bản số Toàn thư trên Wikisource có chép sai can chi ở vài tiêu đề năm (vd năm
1255 chép 丁卯 — đúng là 乙卯). Script tự nhận ra tiêu đề lệch khỏi dãy năm liền
kề, dùng can chi đúng để so, và in danh sách errata cho người duyệt.
"""
import json
import re
import sys

data = json.load(open(sys.argv[1], encoding="utf8"))
ROOT = sys.argv[2]
NUM = {4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九", 10: "十", 11: "十一"}
CAN = dict(zip("Giáp Ất Bính Đinh Mậu Kỷ Canh Tân Nhâm Quý".split(), "甲乙丙丁戊己庚辛壬癸"))
CHI = dict(zip("Tý Sửu Dần Mão Thìn Tỵ Ngọ Mùi Thân Dậu Tuất Hợi".split(), "子丑寅卯辰巳午未申酉戌亥"))
GZ, ZZ = "".join(CAN.values()), "".join(CHI.values())
CYCLE = [GZ[i % 10] + ZZ[i % 12] for i in range(60)]


def ganzhi_year(y):
    return CYCLE[(y - 4) % 60]


def nxt(g, k=1):
    return CYCLE[(CYCLE.index(g) + k) % 60] if g in CYCLE else None


def clean(t, keep_cm_years=False):
    t = re.sub(r"-\{|\}-", "", t)
    if keep_cm_years:
        # Cương mục đánh dấu năm bằng {{annotate|丙戌}} → giữ làm mốc riêng.
        t = re.sub(r"\{\{annotate\|([%s][%s])\}\}" % (GZ, ZZ), r"\n§\1§", t)
    t = re.sub(r"\{\{annotate\|([^}]*)\}\}", r"\1", t)
    t = re.sub(r"\{\{僻字\|([^|}]*)\|[^}]*\}\}", r"\1", t)
    t = re.sub(r"<[^>]+>", "", t)
    return t


def tt_headers(text):
    """(vị trí, can chi đúng) của tiêu đề năm Toàn thư."""
    return fix_sequence([(m.start(), m.group(1)) for m in re.finditer(r"(?m)^([%s][%s])[^\n，。]{0,6}年" % (GZ, ZZ), text)], text)


def fix_sequence(hs, text):
    """Sửa mốc năm lệch khỏi hai năm liền kề (hoặc không phải can chi hợp lệ)."""
    out, errata = [], []
    for i, (pos, g) in enumerate(hs):
        prev = out[-1][1] if out else None
        after = hs[i + 1][1] if i + 1 < len(hs) else None
        bogus = g not in CYCLE
        if prev and after and g != nxt(prev) and (after == nxt(prev, 2) or bogus):
            errata.append((g, nxt(prev), text[pos:pos + 16]))
            g = nxt(prev)
        out.append((pos, g))
    return out, errata


def load():
    vols = {}
    for n, c in NUM.items():
        for kind, path, keep in (("TT", f"{ROOT}/tt/q_{c}.txt", False), ("CM", f"{ROOT}/cm/cm_{c}.txt", True)):
            try:
                raw = open(path, encoding="utf8").read()
            except FileNotFoundError:
                continue
            text = clean(raw, keep)
            if kind == "TT":
                heads, errata = tt_headers(text)
            else:
                heads, errata = fix_sequence([(m.start(), m.group(1)) for m in re.finditer(r"§([%s][%s])§" % (GZ, ZZ), text)], text)
                text = re.sub(r"\n§[^§]+§", lambda m: "\0" * len(m.group(0)), text)  # giữ vị trí
            vols[(kind, n)] = (text, heads, errata)
    try:
        vols[("VSL", 0)] = (clean(open(f"{ROOT}/vsl_tran.txt", encoding="utf8").read()), [], [])
    except FileNotFoundError:
        pass
    return vols


VOLS = load()


def find(text, q):
    """Tìm đoạn trích; bỏ qua mốc năm Cương mục chèn giữa (ký tự \\0)."""
    pos = text.find(q)
    if pos >= 0:
        return pos
    flat = text.replace("\0", "")
    p = flat.find(q)
    if p < 0:
        return -1
    # quy đổi vị trí trên chuỗi đã bỏ \0 về chuỗi gốc
    k = -1
    for i, ch in enumerate(text):
        if ch != "\0":
            k += 1
            if k == p:
                return i
    return -1


def year_at(heads, pos):
    g = None
    for hpos, hg in heads:
        if hpos <= pos + 2:
            g = hg
        else:
            break
    return g


def items():
    for kind in ("persons", "unions", "resting_places", "heritage", "events", "same_person_links"):
        for x in data.get(kind, []):
            for c in x.get("citations", []):
                yield x.get("key") or x.get("person"), c


for (kind, n), (_, _, errata) in sorted(VOLS.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    for wrong, right, line in errata:
        print(f"⚠ errata {kind} Q.{n}: tiêu đề chép {wrong}, đúng là {right} — «{line}»")

bad = total = 0
for key, c in items():
    src = c["source"]
    if src not in ("TT", "CM", "VSL"):
        continue
    total += 1
    if src == "VSL":
        vol = 0
    else:
        m = re.search(r"Q\.(\d+)", c["locator"])
        vol = int(m.group(1)) if m else None
    entry = VOLS.get((src, vol))
    if not entry:
        print(f"✗ {key} [{c['field']}] chưa tải nguồn {src} Q.{vol}")
        bad += 1
        continue
    text, heads, _ = entry
    q = c["quote"]
    pos = find(text, q)
    if pos < 0:
        other = [v for (k, v), e in VOLS.items() if k == src and find(e[0], q) >= 0]
        print(f"✗ {key} [{c['field']}] không thấy trong {src} Q.{vol}" + (f" (có ở Q.{other})" if other else "") + f": {q}")
        bad += 1
        continue
    ym = re.search(r"năm (\S+) (\S+) \((\d{4})\)", c["locator"])
    if ym and heads:
        can, chi, y = ym.group(1), ym.group(2), int(ym.group(3))
        want = CAN.get(can, "?") + CHI.get(chi, "?")
        if want != ganzhi_year(y):
            print(f"✗ {key} [{c['field']}] locator: {can} {chi} ≠ năm {y} ({ganzhi_year(y)})")
            bad += 1
        got = year_at(heads, pos)
        if got != want:
            print(f"✗ {key} [{c['field']}] locator ghi {can} {chi} ({want}) nhưng đoạn trích ({src} Q.{vol}) nằm dưới năm {got}: {q[:30]}")
            bad += 1
print(f"\n{total} trích dẫn chính sử, {bad} lỗi")
