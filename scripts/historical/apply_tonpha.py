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
