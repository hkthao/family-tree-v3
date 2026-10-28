"""Kiểm mọi trích dẫn Toàn thư (source "TT") trong file nháp: đoạn trích có
thật trong nguyên văn quyển ghi ở locator ("Bản kỷ Q.5, …"), và năm can chi
của đoạn khớp năm ghi trong locator ("năm Giáp Ngọ (1234)").

Tải nguyên văn chữ Hán (zh.wikisource, Nội các quan bản) vào thư mục riêng:
  mkdir -p /tmp/tt && for q in 四 五 六 七 八; do
    curl -s -A "giapha-research/1.0" --get --data-urlencode "title=大越史記全書/本紀卷之$q" \
      --data "action=raw" "https://zh.wikisource.org/w/index.php" -o "/tmp/tt/q_$q.txt"; done

Chạy:  python3 -I scripts/historical/verify_quotes.py data/historical/tran.json /tmp/tt
"""
import json
import re
import sys

data = json.load(open(sys.argv[1], encoding="utf8"))
SRC = sys.argv[2]
VOL = {4: "四", 5: "五", 6: "六", 7: "七", 8: "八"}
CAN = dict(zip("Giáp Ất Bính Đinh Mậu Kỷ Canh Tân Nhâm Quý".split(), "甲乙丙丁戊己庚辛壬癸"))
CHI = dict(zip("Tý Sửu Dần Mão Thìn Tỵ Ngọ Mùi Thân Dậu Tuất Hợi".split(), "子丑寅卯辰巳午未申酉戌亥"))
GZ, ZZ = "".join(CAN.values()), "".join(CHI.values())


def clean(t):
    t = re.sub(r"-\{|\}-", "", t)
    t = re.sub(r"\{\{annotate\|([^}]*)\}\}", r"\1", t)
    t = re.sub(r"<[^>]+>", "", t)
    return t


texts = {q: clean(open(f"{SRC}/q_{c}.txt", encoding="utf8").read()) for q, c in VOL.items()}


def ganzhi_year(y):
    return "甲乙丙丁戊己庚辛壬癸"[(y - 4) % 10] + "子丑寅卯辰巳午未申酉戌亥"[(y - 4) % 12]


def year_before(text, pos):
    head = None
    for m in re.finditer(r"(?m)^([%s][%s])" % (GZ, ZZ), text[:pos]):
        head = m.group(1)
    return head


def items():
    for kind in ("persons", "unions", "resting_places", "heritage", "events", "same_person_links"):
        for x in data.get(kind, []):
            for c in x.get("citations", []):
                yield x.get("key") or x.get("person"), c


bad = 0
total = 0
for key, c in items():
    if c["source"] != "TT":
        continue
    total += 1
    m = re.search(r"Q\.(\d)", c["locator"])
    vol = int(m.group(1)) if m else None
    text = texts.get(vol)
    q = c["quote"]
    pos = text.find(q) if text else -1
    if pos < 0:
        other = [v for v, t in texts.items() if q in t]
        print(f"✗ {key} [{c['field']}] không thấy trong Q.{vol}" + (f" (có ở Q.{other})" if other else "") + f": {q}")
        bad += 1
        continue
    ym = re.search(r"năm (\S+) (\S+) \((\d{4})\)", c["locator"])
    if ym:
        can, chi, y = ym.group(1), ym.group(2), int(ym.group(3))
        want = CAN.get(can, "?") + CHI.get(chi, "?")
        if want != ganzhi_year(y):
            print(f"✗ {key} [{c['field']}] locator: {can} {chi} ≠ năm {y} ({ganzhi_year(y)})")
            bad += 1
        got = year_before(text, pos + 2)
        # Errata đã biết: bản số zh.wikisource chép năm 1388 (Xương Phù 12, Hồng Vũ 21) là 戊戌.
        if (want, got) == ("戊辰", "戊戌") and y in (1388, 1389):
            print(f"⚠ {key} [{c['field']}] năm {y}: bản số chép 戊戌 (errata đã biết — đối chiếu niên hiệu)")
            continue
        if got != want:
            print(f"✗ {key} [{c['field']}] locator ghi {can} {chi} ({want}) nhưng đoạn trích nằm dưới năm {got}: {q[:30]}")
            bad += 1
print(f"\n{total} trích dẫn Toàn thư, {bad} lỗi")
