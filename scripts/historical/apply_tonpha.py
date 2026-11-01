# Hậu xử lý nguyen.json bằng trang Tôn phả (Hoàng tộc lược biên 1943): đặt tên Việt, tước hiệu, thụy cho hoàng tử / công chúa
# đã có (khoá nguyen.<vua>.s<N> / .d<N>) khớp theo (cha, giới, thứ tự) và xác nhận bằng chữ Hán (tên hoặc tước) có trong dòng Tôn phả.
# Chạy: python3 -I scripts/historical/apply_tonpha.py data/historical/nguyen.json data/historical/tonpha_de_pha.json
import json
import re
import sys

OUT, TP = sys.argv[1], sys.argv[2]
data = json.load(open(OUT, encoding="utf8"))
tp = json.load(open(TP, encoding="utf8"))
FATHER = {"gl": "Gia Long", "mm": "Minh Mạng", "tt": "Thiệu Trị"}
THUY_BAD = re.compile(r"Vương|Công|Chúa|Hoàng|Quận|Hầu|Nguyễn|Niên|hiệu|mất|Tước", re.I)
HAN = r"[㐀-鿿\U00020000-\U0002ffff]+"
done = skipped = 0
for p in data["persons"]:
    m = re.match(r"nguyen\.(gl|mm|tt)\.([sd])(\d+)$", p["key"])
    if not m or "Hoàng tử thứ" not in p["full_name"] and "Công chúa thứ" not in p["full_name"] and "(" not in p["full_name"]:
        continue
    fab, sd, num = m.group(1), m.group(2), int(m.group(3))
    e = next((x for x in tp[fab]["sons" if sd == "s" else "daughters"] if x["n"] == num), None)
    hm = re.search(r"\((.+)\)$", p["full_name"])
    if not e or not hm:
        skipped += 1
        continue
    line = re.sub(r"\s", "", e["line"])
    given = re.sub(r"^.*?(公主|郡王|郡公|王|公|皇子|皇女)", "", hm.group(1))
    cand = {hm.group(1), given} | {t["title"] for t in p.get("titles", [])}
    if not any(c and len(c) >= 2 and c in line for c in cand) and num not in (77, 59, 60, 6, 8, 11, 12):
        skipped += 1
        continue
    nm = e["name_vn"].strip()
    if not nm or "..." in nm:
        skipped += 1
        continue
    full = nm if nm.startswith("Nguyễn Phúc") else f"Nguyễn Phúc {nm}"
    han_name = hm.group(1)
    p["full_name"] = full
    loc = f"Tôn phả, Đế phả, {FATHER[fab]}, {'con trai' if sd == 's' else 'con gái'} thứ {num}"
    quote = e["line"].strip()
    cites = p.setdefault("citations", [])
    cites.append({"field": "full_name", "source": "NPT", "locator": loc, "quote": quote, "value": full})
    # Tước hiệu tiếng Việt (nếu Tôn phả ghi) — thêm bên cạnh tước chữ Hán đã có.
    tv = (e.get("title_vn") or "").strip()
    if tv and not re.search(r"\d|Niêu|Niên|Hoàng nữ|Hoàng nam", tv) and not any(t["title"] == tv for t in p.setdefault("titles", [])):
        p["titles"].append({"title": tv})
        cites.append({"field": f"title:{len(p['titles']) - 1}", "source": "NPT", "locator": loc, "quote": quote})
    # Thụy: đoạn "Tên Thụy (Hán)" không phải tước.
    for seg in re.split(r"\s+-\s+", e["line"]):
        sm = re.match(rf"^([A-ZĐ][\wÀ-ỹ ]+?)\s*\(({HAN})\)$", seg.strip())
        if sm and not THUY_BAD.search(sm.group(1)) and not p.get("posthumous_name"):
            p["posthumous_name"] = sm.group(1).strip()
            cites.append({"field": "posthumous_name", "source": "NPT", "locator": loc, "quote": seg.strip(), "value": p["posthumous_name"]})
            break
    # Tiểu sử: ghi tên chữ Hán trong Liệt truyện đã bị thay tên Việt.
    p["bio"] = re.sub(r"(## Tóm lược\n)", rf"\1Tên theo Liệt truyện: {han_name}. ", p["bio"], count=1) if "Tên theo Liệt truyện" not in p["bio"] else p["bio"]
    done += 1
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"Tôn phả: đã đặt tên Việt cho {done}, bỏ qua {skipped}")

# ── Ngày sinh / mất của các vua (Tôn phả; âm lịch quy đổi từ dương lịch trong tonpha_lunar.json) ──
LUNAR = json.load(open(TP.replace("tonpha_de_pha", "tonpha_lunar"), encoding="utf8"))
KING = {"gl": "gia-long", "mm": "minh-mang", "tt": "thieu-tri", "td": "tu-duc", "dd": "duc-duc", "hh": "hiep-hoa", "kp": "kien-phuc",
        "dk": "dong-khanh", "tth": "thanh-thai", "dt": "duy-tan", "kd": "khai-dinh", "bd": "bao-dai"}
byk = {p["key"]: p for p in data["persons"]}
filled = 0
for code, slug in KING.items():
    p = byk.get(f"nguyen.{slug}")
    if not p:
        continue
    page = tp[code]
    quote = (page["dates"][0] if page["dates"] else page["header"]).strip()
    for which, fld in (("b", "birth"), ("d", "death")):
        L = LUNAR.get(f"{code}_{which}")
        if not L:
            continue
        cur = p.get(fld) or {}
        if cur and cur.get("lunar_year") != L["y"]:
            print(f"  ⚠ {slug} {fld}: DNTL {cur} ≠ Tôn phả âm {L['y']}-{L['m']}-{L['d']} (giữ DNTL)")
            continue
        if cur.get("lunar_month") and cur.get("lunar_day"):
            if (cur["lunar_month"], cur["lunar_day"]) != (L["m"], L["d"]):
                print(f"  ⚠ {slug} {fld}: DNTL tháng/ngày {cur['lunar_month']}/{cur['lunar_day']} ≠ Tôn phả {L['m']}/{L['d']} (giữ DNTL)")
            continue
        p[fld] = {"lunar_year": L["y"], "lunar_month": L["m"], "lunar_day": L["d"], **({"lunar_leap": True} if L["leap"] else {})}
        p["citations"].append({"field": fld, "source": "NPT", "locator": f"Tôn phả, Đế phả, {FATHER.get(code, p['full_name'])}",
                               "quote": quote, "value": f"âm {L['y']}-{L['m']}-{L['d']}",
                               "note": f"Âm lịch quy đổi từ dương lịch {L['solar']} (Tôn phả ghi dương lịch)."})
        filled += 1
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"Tôn phả: bổ sung {filled} mốc sinh/mất của các vua")

# ── Thêm hoàng tử / công chúa còn thiếu (chỉ các vua đến Đồng Khánh / Dục Đức; bỏ người Tôn phả chưa ghi tên) ──
ADD = {"gl": ("nguyen.gia-long", "u.gl--khuyet-hv", "Gia Long"), "mm": ("nguyen.minh-mang", "u.mm--khuyet-hv", "Minh Mạng"),
       "tt": ("nguyen.thieu-tri", "u.tt--khuyet-hv", "Thiệu Trị"), "dd": ("nguyen.duc-duc", "u.duc-duc--khuyet", "Dục Đức"),
       "dk": ("nguyen.dong-khanh", "u.dong-khanh--khuyet", "Đồng Khánh"), "hh": ("nguyen.hiep-hoa", "u.hiep-hoa--khuyet", "Hiệp Hòa")}
ukeys = {u["key"] for u in data["unions"]}
for fab, (hus, ukey, label) in ADD.items():
    if ukey not in ukeys:
        data["unions"].append({"key": ukey, "husband": hus, "citations": [], "review": {"status": "draft", "note": "Hôn nhân 'khuyết' — chỉ để gắn con của vua khi chưa rõ mẹ (Tôn phả không ghi)."}})
        ukeys.add(ukey)
byk = {p["key"]: p for p in data["persons"]}
if "Nguyễn Phúc Bửu Đảo" not in (byk["nguyen.khai-dinh"].get("nickname") or ""):
    kdp = byk["nguyen.khai-dinh"]
    kdp["nickname"] = "Nguyễn Phúc Bửu Đảo"
    e = next(x for x in tp["dk"]["sons"] if x["n"] == 1)
    kdp["citations"].append({"field": "nickname", "source": "NPT", "locator": "Tôn phả, Đế phả, Đồng Khánh, con trai thứ 1", "quote": e["line"].strip(), "value": "Nguyễn Phúc Bửu Đảo"})


def _norm(s):
    return re.sub(r"[\s.]", "", s or "")


added = 0
# Chỉ so trùng với người ĐÃ có trước lần chạy này (anh em họ có thể trùng tên giữa các nhánh).
blob = [_norm(q["full_name"]) for q in data["persons"]] + [_norm(q.get("nickname")) for q in data["persons"]]
ttl = [t["title"].casefold() for q in data["persons"] for t in q.get("titles", [])]
for fab, (hus, ukey, label) in ADD.items():
    for sd, nm, gender, kind in (("s", "sons", "M", "con trai"), ("d", "daughters", "F", "con gái")):
        for e in tp[fab][nm]:
            key = f"nguyen.{fab}.{sd}{e['n']}"
            name = e["name_vn"].strip()
            # Đã có dưới khoá khác: Cảnh (anh-due), Đảm (Minh Mạng), Miên Thẩm, Hồng Nhậm (Tự Đức).
            if key in byk or key in ("nguyen.gl.s1", "nguyen.gl.s4", "nguyen.mm.s10", "nguyen.tt.s2") or not name or "..." in name or "Bửu Đảo" in name:
                continue
            short = re.sub(r"^Nguyễn Phúc ", "", name).strip(" .")
            full = f"Nguyễn Phúc {short}"
            tv = (e.get("title_vn") or "").strip()
            if _norm(full) in blob or (tv and any(tv.casefold() in t for t in ttl) and not re.search(r"\d|Hoàng|tảo thương|mất sớm", tv, re.I)):
                print(f"  = đã có: {key} {full} ({tv})")
                continue
            loc = f"Tôn phả, Đế phả, {label}, {kind} thứ {e['n']}"
            quote = e["line"].strip()
            early = bool(e.get("early_death")) or bool(re.search(r"tảo thương|mất sớm", e["line"], re.I))
            person = {"key": key, "full_name": full, "gender": gender, "parents": ukey,
                      "bio": f"## Tóm lược\n{'Con trai' if gender == 'M' else 'Con gái'} thứ {e['n']} của {label}." + (" Mất sớm." if early else "") +
                             "\n\n## Xuất thân\n\n## Lên ngôi\n\n## Sự nghiệp theo năm\n\n## Gia quyến\n\n## Qua đời và lăng tẩm\n\n## Sử thần nhận xét",
                      "citations": [{"field": "existence", "source": "NPT", "locator": loc, "quote": quote},
                                    {"field": "bio", "source": "NPT", "locator": loc, "quote": quote},
                                    {"field": "full_name", "source": "NPT", "locator": loc, "quote": quote, "value": full},
                                    {"field": "parents", "source": "NPT", "locator": loc, "quote": quote}],
                      "review": {"status": "draft", "note": "Thêm từ trang Tôn phả (Hoàng tộc lược biên 1943); cần đối chiếu Đại Nam liệt truyện nếu có."}}
            if tv and not re.search(r"\d|Niêu|Niên|Hoàng nữ|Hoàng nam", tv):
                person["titles"] = [{"title": tv}]
                person["citations"].append({"field": "title:0", "source": "NPT", "locator": loc, "quote": quote})
            for seg in re.split(r"\s+-\s+", e["line"]):
                sm = re.match(rf"^([A-ZĐ][\wÀ-ỹ ]+?)\s*\(({HAN})\)$", seg.strip())
                if sm and not THUY_BAD.search(sm.group(1)):
                    person["posthumous_name"] = sm.group(1).strip()
                    person["citations"].append({"field": "posthumous_name", "source": "NPT", "locator": loc, "quote": seg.strip(), "value": person["posthumous_name"]})
                    break
            data["persons"].append(person)
            byk[key] = person
            added += 1
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"Tôn phả: thêm {added} hoàng tử / công chúa")


# ── Dọn tên còn chữ Hán / thẻ HTML (người Việt không đọc được chữ Hán) ──
# 1) bỏ thẻ <small> chú giải chữ lạ trong tên Liệt truyện; 2) đặt tên Việt cho con Hưng Tổ (= anh chị em của Gia Long trên Tôn phả)
# và hai người lẻ khoá .sx/.dx; 3) phiên âm Hán-Việt tên "Mẹ (…氏)"; 4) bỏ bản thêm trùng.
import os

CJK = re.compile(r"[㐀-鿿\U00020000-\U0002ffff]")
UNI_PATH = sys.argv[3] if len(sys.argv) > 3 else "/private/tmp/claude-501/unihan/Unihan_Readings.txt"
_uni = {}
if os.path.exists(UNI_PATH):
    for ln in open(UNI_PATH, encoding="utf8"):
        if "\tkVietnamese\t" in ln:
            cp, _, val = ln.rstrip("\n").split("\t")
            _uni[chr(int(cp[2:], 16))] = val.split()[0].lower()
_uni.setdefault("維", "duy")

RARE = {"玉<small>左從玉，右從睿</small>": "玉璿"}
for p in data["persons"]:
    for k, v in RARE.items():
        p["full_name"] = p["full_name"].replace(k, v)
        p["bio"] = p.get("bio", "").replace(k, v)
        for t in p.get("titles", []):
            t["title"] = t["title"].replace(k, v)

SPECIAL = {  # khoá → (trang Tôn phả, danh sách, số thứ tự, nhãn)
    "nguyen.tt.sx-2": ("tt", "sons", 28, "Thiệu Trị, con trai thứ 28"),
    "nguyen.tt.dx": ("tt", "daughters", 1, "Thiệu Trị, con gái thứ 1"),
    "nguyen.ht.s2": ("gl", "brothers", 2, "Gia Long, em trai thứ 2 (con Hưng Tổ)"),
    "nguyen.ht.s5": ("gl", "brothers", 5, "Gia Long, em trai thứ 5 (con Hưng Tổ)"),
    "nguyen.ht.s6": ("gl", "brothers", 6, "Gia Long, em trai thứ 6 (con Hưng Tổ)"),
    "nguyen.ht.d2": ("gl", "sisters", 8, "Gia Long, em gái (con Hưng Tổ)"),
    "nguyen.ht.d3": ("gl", "sisters", 9, "Gia Long, em gái (con Hưng Tổ)"),
    "nguyen.ht.d4": ("gl", "sisters", 10, "Gia Long, em gái (con Hưng Tổ)"),
}
byk = {p["key"]: p for p in data["persons"]}
# Bản thêm trước đó trùng người đã có dưới khoá .sx/.dx (chỉ khác chữ Hán biến thể).
data["persons"] = [p for p in data["persons"] if p["key"] not in ("nguyen.tt.s28", "nguyen.tt.d1")]
byk = {p["key"]: p for p in data["persons"]}
renamed = 0
for key, (fab, lst, num, label) in SPECIAL.items():
    p = byk.get(key)
    if not p or not CJK.search(p["full_name"]):
        continue
    e = next((x for x in tp[fab][lst] if x["n"] == num), None)
    if not e or not e["name_vn"].strip() or "..." in e["name_vn"]:
        continue
    nm = e["name_vn"].strip()
    p["full_name"] = nm if nm.startswith("Nguyễn Phúc") else f"Nguyễn Phúc {nm}"
    loc = f"Tôn phả, Đế phả, {label}"
    quote = e["line"].strip()
    cites = p.setdefault("citations", [])
    cites.append({"field": "full_name", "source": "NPT", "locator": loc, "quote": quote, "value": p["full_name"]})
    tv = (e.get("title_vn") or "").strip()
    if tv and not re.search(r"\d|Niêu|Niên|Hoàng nữ|Hoàng nam", tv) and not any(t["title"] == tv for t in p.setdefault("titles", [])):
        p["titles"].append({"title": tv})
        cites.append({"field": f"title:{len(p['titles']) - 1}", "source": "NPT", "locator": loc, "quote": quote})
    for seg in re.split(r"\s+-\s+", e["line"]):
        sm = re.match(rf"^([A-ZĐ][\wÀ-ỹ ]+?)\s*\(({HAN})\)$", seg.strip())
        if sm and not THUY_BAD.search(sm.group(1)) and not p.get("posthumous_name"):
            p["posthumous_name"] = sm.group(1).strip()
            cites.append({"field": "posthumous_name", "source": "NPT", "locator": loc, "quote": seg.strip(), "value": p["posthumous_name"]})
            break
    renamed += 1

SUR = {"維": "Duy", "阮": "Nguyễn", "武": "Võ", "黄": "Hoàng", "黃": "Hoàng", "宋": "Tống", "潘": "Phan", "陳": "Trần", "黎": "Lê", "范": "Phạm", "胡": "Hồ", "吳": "Ngô"}
TIT = {"贈昭儀": "Truy tặng Chiêu nghi", "贈昭容": "Truy tặng Chiêu dung", "良妃": "Lương phi", "才人": "Tài nhân", "宮娥": "Cung nga",
       "嫻嬪": "Nhàn tần", "慈妃": "Từ phi", "庶人": "Thứ nhân", "母": "Mẹ họ"}


def vi(ch):
    return SUR.get(ch) or (_uni.get(ch) or "?").capitalize()


def mother_vi(phrase):
    t = next((k for k in sorted(TIT, key=len, reverse=True) if phrase.startswith(k)), None)
    rest = phrase[len(t):] if t else phrase
    rest = rest[:-1] if rest.endswith("氏") else rest
    sur = " ".join([vi(rest[0])] + [(_uni.get(c) or "?").capitalize() for c in rest[1:]]) if rest else ""
    if "?" in sur:
        return None
    if t == "母":
        return f"Mẹ họ {sur}"
    return f"{TIT[t]} {sur} thị" if t else f"{sur} thị"


fixed_m = 0
for p in data["persons"]:
    m = re.match(r"^Mẹ \((.+)\)$", p["full_name"])
    if m and CJK.search(m.group(1)):
        nv = mother_vi(m.group(1))
        if nv:
            p["full_name"] = nv
            fixed_m += 1
# Còn sót chữ Hán trong ngoặc (chữ lạ bị mất, không tra được) → bỏ phần Hán, giữ "Công chúa của X".
left = 0
for p in data["persons"]:
    m = re.match(r"^(.*?) \(([^()]*)\)$", p["full_name"])
    if m and CJK.search(m.group(2)) and p["key"].startswith("nguyen.") and not p["key"].startswith("nguyen.me."):
        p["full_name"] = m.group(1)
        left += 1
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"Dọn tên: đặt tên Việt {renamed}, phiên âm mẹ {fixed_m}, bỏ Hán còn sót {left}")


# ── Tước hiệu chữ Hán: bỏ nếu đã có tước tiếng Việt; không thì phiên âm Hán-Việt. Dọn thẻ HTML trong trích dẫn. ──
def han_to_vi(t):
    words = [(_uni.get(c) or "?") for c in t]
    return None if "?" in words else " ".join(words).capitalize()


dropped = translit = 0
for p in data["persons"]:
    ts = p.get("titles") or []
    if not any(CJK.search(t["title"]) for t in ts):
        continue
    has_vi = any(not CJK.search(t["title"]) for t in ts)
    new, remap = [], {}
    for i, t in enumerate(ts):
        if CJK.search(t["title"]):
            if has_vi:
                dropped += 1
                continue
            tv = han_to_vi(t["title"])
            if not tv:
                continue
            t = {**t, "title": tv}
            translit += 1
        remap[i] = len(new)
        new.append(t)
    cites = []
    for c in p.get("citations", []):
        m = re.match(r"title:(\d+)$", c["field"])
        if m:
            if int(m.group(1)) not in remap:
                continue
            c = {**c, "field": f"title:{remap[int(m.group(1))]}"}
        cites.append(c)
    p["titles"], p["citations"] = new, cites
    if not new:
        del p["titles"]
for p in data["persons"]:
    for c in p.get("citations", []):
        q = c.get("quote", "")
        if "<" in q:
            for k, v in RARE.items():
                q = q.replace(k, v)
            c["quote"] = re.sub(r"<[^>]+>", "", q)
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"Tước hiệu: bỏ {dropped} tước Hán đã có bản Việt, phiên âm {translit}")

# Câu "Tên theo Liệt truyện: <Hán>." thừa (tên Hán còn có ở câu "Tên chữ Hán: …") → bỏ.
for p in data["persons"]:
    p["bio"] = re.sub(r"Tên theo Liệt truyện: [^.]*?\. ", "", p.get("bio", ""))
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)

# Người đã có tên Việt đầy đủ: câu "Tên chữ Hán: …" chỉ còn là chữ Hán khó đọc → bỏ (chữ Hán vẫn nằm trong trích dẫn nguồn).
for p in data["persons"]:
    if p["full_name"].startswith("Nguyễn Phúc "):
        p["bio"] = re.sub(r" ?Tên chữ Hán: [^\n]*?\.(?= |\n|$)", "", p.get("bio", ""))
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)

# Bio của "Mẹ (…)": tên đã phiên âm Hán-Việt ở full_name → bỏ phần "(nguyên văn chép: <Hán>)" khó đọc.
for p in data["persons"]:
    if p["key"].startswith("nguyen.me."):
        p["bio"] = re.sub(r" \(nguyên văn chép[^)]*\)", "", p.get("bio", ""))
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
