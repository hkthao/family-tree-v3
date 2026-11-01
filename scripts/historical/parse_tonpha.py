"""Đọc trang Đế Phả của Tôn phả Nguyễn Phúc tộc (theo Hoàng tộc lược biên 1943) đã tải về:

  curl -sL -A "Mozilla/5.0" -o /tmp/chanhhe.html https://tonpha.nguyenphuoctoc.info/ChanhHe.aspx
  python3 -I scripts/historical/parse_tonpha.py /tmp/chanhhe.html data/historical/tonpha_de_pha.json

Mỗi hoàng đế (Gia Long → Bảo Đại): tên, ngày sinh/mất (như trang ghi), và các danh sách anh em trai / chị em gái /
con trai / con gái (thứ tự, tên Việt, tên Hán, tước hiệu, thụy). Chỉ trích những gì trang ghi.
"""
import html
import json
import re
import sys
import unicodedata

raw = open(sys.argv[1], encoding="utf8", errors="ignore").read()
t = re.sub(r"<script.*?</script>|<style.*?</style>", "", raw, flags=re.S)
t = re.sub(r"</(p|div|li|tr|h\d)>|<br\s*/?>", "\n", t)
t = unicodedata.normalize("NFC", html.unescape(re.sub(r"<[^>]+>", " ", t)))
t = t.replace("绵", "綿")
lines = [re.sub(r"[ \t]+", " ", l).strip() for l in t.split("\n")]
lines = [l for l in lines if l]
open(sys.argv[2].replace(".json", "_text.txt"), "w", encoding="utf8").write("\n".join(lines))

EMP = {"Ánh": "gl", "Đảm": "mm", "Miên Tông": "tt", "Hồng Nhậm": "td", "Ưng Chân": "dd", "Hồng Dật": "hh", "Ưng Đăng": "kp",
       "Ưng Lịch": "hn", "Ưng Thị": "dk", "Bửu Lân": "tth", "Vĩnh San": "dt", "Bửu Đảo": "kd", "Vĩnh Thụy": "bd"}
HAN = re.compile(r"[㐀-鿿\U00020000-\U0002ffff]+")
SECT = {"ANH EM TRAI": "brothers", "CHỊ EM GÁI": "sisters", "CON TRAI": "sons", "CON GÁI": "daughters"}
out, cur, sect = {}, None, None
for i, l in enumerate(lines):
    m = re.match(r"^Ngài Nguyễn Phúc ([^\d(（【\[]+?)\s*[\[(（]?[^\w]*?(?:阮|\s|$)", l)
    mm = re.match(r"^(?:\d+-)?Ngài Nguyễn Phúc (.+?)(?: \(| \[|\s+[㐀-鿿]| - |$)", l)
    if mm and not re.match(r"^\d+-", l):
        name = mm.group(1).strip()
        key = EMP.get(name)
        if key and key not in out:
            cur = key
            out[key] = {"name_vn": name, "header": l, "dates": [], "brothers": [], "sisters": [], "sons": [], "daughters": []}
            sect = None
            for k in range(1, 4):
                if i + k < len(lines) and re.match(r"^\(.*\d{4}.*\)$|^\(.*Nhâm.*\)$|^\(\d", lines[i + k]):
                    out[key]["dates"].append(lines[i + k])
        continue
    if l in SECT:
        sect = SECT[l]
        continue
    if cur and sect:
        lm = re.match(r"^(\d+)-(?:Ngài )?(.+)$", l)
        if not lm:
            continue
        body = lm.group(2)
        if "Nguyễn Phúc" not in body and "阮福" not in body and "阮氏" not in body:
            continue
        han = HAN.search(body[body.find("阮") :]) if "阮" in body else None
        han_s = han.group(0) if han else ""
        han_s = re.sub(r"^阮福|^阮氏", "", han_s)
        nm = re.match(r"^(?:Nguyễn Phúc |Nguyễn Thị )?(.+?)\s*[\[(（]?\s*阮", body)
        name_vn = (nm.group(1) if nm else body.split("-")[0]).strip(" -[(")
        rest = body[(han.end() + body.find("阮")) :] if han else body
        segs = [s.strip(" -[]()") for s in re.split(r"\s+-\s+", rest) if s.strip(" -[]()")]
        early = "mất sớm" in body
        title_vn = next((s for s in segs if not HAN.search(s) and "mất sớm" not in s and len(s) < 40), None)
        thuy = None
        for s in segs:
            tm = re.match(r"^(.+?)\s*[\(（]([㐀-鿿]+)[\)）]$", s)
            if tm and not re.search(r"(公|王|主|郡王|皇后|皇帝|皇子|皇女)$", tm.group(2)) and len(tm.group(2)) <= 4:
                thuy = (tm.group(1).strip(), tm.group(2))
                break
        out[cur][sect].append({"n": int(lm.group(1)), "name_vn": name_vn, "han": han_s, "title_vn": title_vn, "thuy": thuy,
                               "early_death": early, "line": l})
json.dump(out, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
for k, v in out.items():
    print(k, v["name_vn"], v["dates"][:1], {s: len(v[s]) for s in ("brothers", "sisters", "sons", "daughters")})
