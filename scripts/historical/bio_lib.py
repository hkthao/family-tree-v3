"""Dựng tiểu sử CÓ CẤU TRÚC (7 mục chuẩn + dòng thời gian) cho người trong file nháp, từ các trường đã có.

Dùng cuối gen_<triều>.py, trước khi ghi JSON:
    import bio_lib; bio_lib.structure(persons, unions, EVENTS, REMARKS)

  - Tóm lược: giữ phần mở đầu của tiểu sử viết tay (mặc định 2 câu đầu; keep_all=True giữ nguyên cả đoạn).
  - Xuất thân: cha mẹ (suy từ hôn nhân), ngày sinh, nơi sinh nếu có.
  - Lên ngôi: thời gian ở ngôi + niên hiệu.
  - Sự nghiệp theo năm: dòng "- Năm Giáp Tuất (974): …" cho sinh, lên ngôi, đổi niên hiệu, sự kiện thêm tay (EVENTS), mất.
    Giao diện dựng "Dòng thời gian" từ các dòng này (xem src/lib/personTimeline.ts).
  - Gia quyến: vợ/chồng và con (suy từ hôn nhân + cha mẹ).
  - Qua đời và lăng tẩm: ngày mất, thọ, nơi an táng, thụy.
  - Sử thần nhận xét: lời nhận xét viết tay (REMARKS) nếu có.
Mọi dữ kiện lấy từ trường đã có trích dẫn; EVENTS/REMARKS tự thêm phải kèm trích dẫn (cite) — hàm gắn vào person.citations (field "bio").
"""
import re

CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"]
CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"]


def canchi(y):
    return f"{CAN[(y - 4) % 10]} {CHI[(y - 4) % 12]}"


def year_label(y):
    return f"Năm {canchi(y)} ({y})"


def fmt_date(d):
    """{'lunar_year','lunar_month','lunar_day','lunar_leap'} → 'ngày 12 tháng 2 năm Giáp Tuất (974)' (âm lịch)."""
    if not d or not d.get("lunar_year"):
        return None
    parts = []
    if d.get("lunar_day"):
        parts.append(f"ngày {d['lunar_day']}")
    if d.get("lunar_month"):
        parts.append(f"tháng {d['lunar_month']}{' nhuận' if d.get('lunar_leap') else ''}")
    parts.append(f"năm {canchi(d['lunar_year'])} ({d['lunar_year']})")
    return " ".join(parts)


def fmt_dm(d):
    """Chỉ ngày/tháng (không năm): 'ngày 12 tháng 2' / 'tháng 3 nhuận' / ''."""
    parts = []
    if d.get("lunar_day"):
        parts.append(f"ngày {d['lunar_day']}")
    if d.get("lunar_month"):
        parts.append(f"tháng {d['lunar_month']}{' nhuận' if d.get('lunar_leap') else ''}")
    return " ".join(parts)


def first_sentences(text, n):
    sents = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    return " ".join(sents[:n]).strip()


def structure(persons, unions, events=None, remarks=None, keep_all=False, summary_sentences=2):
    events, remarks = events or {}, remarks or {}
    by = {p["key"]: p for p in persons}
    u_by = {u["key"]: u for u in unions}
    kids_of = {}
    for p in persons:
        if p.get("parents"):
            kids_of.setdefault(p["parents"], []).append(p)
    spouse_unions = {}
    for u in unions:
        spouse_unions.setdefault(u["husband"], []).append(u)
        if u.get("wife"):
            spouse_unions.setdefault(u["wife"], []).append(u)

    def nm(k):
        return by[k]["full_name"] if k in by else k

    for p in persons:
        old = (p.get("bio") or "")
        if re.search(r"^##\s", old, re.M):
            # Khung 7 mục của normalize_bio mà chỉ "Tóm lược" có chữ → dựng lại các mục còn lại; mục đã viết tay thì giữ nguyên
            parts = re.split(r"^##\s+(.+)$", old.strip(), flags=re.M)
            body = {parts[i].strip(): parts[i + 1].strip() for i in range(1, len(parts), 2)}
            if any(v for k, v in body.items() if k != "Tóm lược"):
                continue
            old = body.get("Tóm lược", "")
        sec = {}
        sec["Tóm lược"] = old.strip() if keep_all else (first_sentences(old, summary_sentences) or old.strip())

        # Xuất thân
        xs = []
        pu = u_by.get(p.get("parents") or "")
        if pu:
            who = [nm(pu["husband"])] + ([nm(pu["wife"])] if pu.get("wife") else [])
            xs.append(("Con của " + " và ".join(who)) + ".")
        b = fmt_date(p.get("birth"))
        if b:
            xs.append(f"Sinh {b}" + (f" tại {p['birth_place']}" if p.get("birth_place") else "") + " (âm lịch).")
        if xs:
            sec["Xuất thân"] = " ".join(xs)

        # Lên ngôi
        rs = []
        for r in p.get("reigns") or []:
            era = [e for e in r.get("era_names", [])]
            line = f"Ở ngôi từ năm {canchi(r['start_year'])} ({r['start_year']}) đến năm {canchi(r['end_year'])} ({r['end_year']})" if r.get("start_year") and r.get("end_year") else ""
            if r.get("temple_name"):
                line += f", miếu hiệu {r['temple_name']}"
            if era:
                line += "; niên hiệu " + ", ".join(f"{e['name']} ({e['from_year']})" for e in era)
            if line:
                rs.append(line + ".")
        if rs:
            sec["Lên ngôi"] = " ".join(rs)

        # Sự nghiệp theo năm (dòng thời gian)
        rows = []
        if p.get("birth", {}).get("lunar_year"):
            dm = fmt_dm(p["birth"])
            rows.append((p["birth"]["lunar_year"], "Sinh" + (f" {dm}" if dm else "") + "."))
        for r in p.get("reigns") or []:
            if r.get("start_year"):
                rows.append((r["start_year"], "Lên ngôi" + (f", ở ngôi đến năm {r['end_year']}" if r.get("end_year") else "") + "."))
            for e in r.get("era_names", []):
                rows.append((e["from_year"], f"Đổi niên hiệu {e['name']}."))
        for y, text, cite in events.get(p["key"], []):
            rows.append((y, text))
            if cite:
                p.setdefault("citations", []).append({**cite, "field": "bio"})
        if p.get("death", {}).get("lunar_year"):
            d = p["death"]
            dd = fmt_dm(d)
            rows.append((d["lunar_year"], ("Mất" + (f" {dd}" if dd else "") + (f", thọ {p['lifespan']} tuổi" if p.get("lifespan") else "") + ".")))
        if rows:
            seen, lines = set(), []
            for y, t in sorted(rows, key=lambda x: x[0]):
                t = re.sub(r"\s+", " ", t).strip()
                if (y, t) in seen:
                    continue
                seen.add((y, t))
                lines.append(f"- {year_label(y)}: {t}")
            sec["Sự nghiệp theo năm"] = "\n".join(lines)

        # Gia quyến
        fs = []
        for u in spouse_unions.get(p["key"], []):
            other = u.get("wife") if u["husband"] == p["key"] else u["husband"]
            kids = kids_of.get(u["key"], [])
            if other:
                fs.append(f"{'Vợ' if u['husband'] == p['key'] else 'Chồng'}: {nm(other)}" + (f"; con: {', '.join(k['full_name'] for k in kids)}" if kids else "") + ".")
            elif kids:
                fs.append(f"Con (không rõ mẹ): {', '.join(k['full_name'] for k in kids)}.")
        if fs:
            sec["Gia quyến"] = "\n".join(fs)

        # Qua đời và lăng tẩm
        qs = []
        if p.get("death", {}).get("lunar_year"):
            d = p["death"]
            qs.append("Mất " + (fmt_date(d) or "") + (f", thọ {p['lifespan']} tuổi" if p.get("lifespan") else "") + ".")
        if p.get("burial_place"):
            qs.append(f"An táng: {p['burial_place']}.")
        if p.get("posthumous_name"):
            qs.append(f"Thụy hiệu: {p['posthumous_name']}.")
        if qs:
            sec["Qua đời và lăng tẩm"] = " ".join(qs)

        rem = remarks.get(p["key"])
        if rem:
            sec["Sử thần nhận xét"] = rem[0]
            for cite in rem[1:]:
                p.setdefault("citations", []).append({**cite, "field": "bio"})

        order = ["Tóm lược", "Xuất thân", "Lên ngôi", "Sự nghiệp theo năm", "Gia quyến", "Qua đời và lăng tẩm", "Sử thần nhận xét"]
        if any(sec.values()) and not any(x.get("field") == "bio" for x in p.get("citations", [])):
            # bio dựng từ các trường đã có trích dẫn — mượn trích dẫn "parents" (hoặc "existence") làm chỗ dựa
            src = next((x for f in ("parents", "existence") for x in p.get("citations", []) if x.get("field") == f), None)
            if src:
                p.setdefault("citations", []).append({**src, "field": "bio"})
        p["bio"] = "\n\n".join(f"## {s}\n{sec.get(s, '')}".rstrip() for s in order)
