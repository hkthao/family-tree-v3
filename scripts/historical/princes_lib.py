"""Phân tích Đại Nam liệt truyện (chữ Hán, zh.wikisource) + bản dịch Viện Sử học (OCR) cho
hoàng tử / công chúa nhà Nguyễn. Chỉ là thư viện — gen_nguyen.py gọi.

  - entries(path): các mục "==Nhóm==" / "===Người===" của một quyển chữ Hán
  - cnum(s): số Hán ("二十有五") → int
  - parse_cn(heading, body): tách thứ tự, mẹ, sinh, mất, thọ… kèm đoạn trích nguyên văn
  - vn_entries(text): các mục trong bản dịch ("Con thứ N của <vua>") để lấy TÊN Việt
Không suy diễn: không rõ → để None.
"""
import re
import unicodedata


def clean(t):
    t = re.sub(r"<ref>.*?</ref>", "", t)
    t = re.sub(r"\{\{漏字\|([^|}]*)\|[^}]*\}\}", r"\1", t)
    t = re.sub(r"\{\{[*注註]\|([^}]*)\}\}", r"（\1）", t)
    return re.sub(r"\{\{[^}]*\}\}", "", t)


def entries(path):
    """→ [(nhóm, tiêu đề, nội dung)]"""
    t = clean(open(path, encoding="utf8").read())
    t = t[t.find("<onlyinclude>"):]
    marks = [(m.start(), m.end(), len(m.group(1)), m.group(2)) for m in re.finditer(r"\n(={2,3})([^=\n]+)\1\n", t)]
    out, group = [], None
    for i, (s, e, lvl, h) in enumerate(marks):
        nxt = marks[i + 1][0] if i + 1 < len(marks) else len(t)
        if lvl == 2:
            group = h
        else:
            out.append((group, h, t[e:nxt].strip()))
    return out


_D = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}


def cnum(s):
    """二十有五→25, 十有三→13, 三十→30, 元→1, 百→100…; không hiểu → None."""
    s = s.replace("有", "").replace("元", "一")
    if not s:
        return None
    if "百" in s:
        a, _, b = s.partition("百")
        hi = _D.get(a, 1) if a else 1
        rest = cnum(b) if b else 0
        return None if rest is None else hi * 100 + rest
    if "十" in s:
        a, _, b = s.partition("十")
        tens = _D.get(a, 1) if a else 1
        if a and a not in _D:
            return None
        ones = 0
        if b:
            if b not in _D:
                return None
            ones = _D[b]
        return tens * 10 + ones
    return _D[s] if s in _D else (int("".join(str(_D[c]) for c in s)) if all(c in _D for c in s) else None)


ERA_START = {"嘉隆": 1801, "明命": 1819, "紹治": 1840, "嗣德": 1847, "建福": 1883, "咸宜": 1884, "同慶": 1885,
             "成泰": 1888, "維新": 1906, "啟定": 1915, "保大": 1925}
ERA_RE = "|".join(ERA_START)
N_RE = r"(?:元|[一二三四五六七八九十百]+)"


def era_year(era, n):
    return ERA_START[era] + n


def parse_cn(heading, body):
    """Tách dữ kiện + đoạn trích nguyên văn (quote đều là chuỗi con của body)."""
    r = {"order": None, "mother": None, "mother_q": None, "same_mother_as": None, "birth": None, "death": None,
         "lifespan": None, "order_q": None, "first": None}
    r["first"] = re.split(r"[。]", body, 1)[0][:60]
    m = re.search(r"第(" + N_RE + r")(子|女)", body[:160]) or re.search(r"皇(" + N_RE + r")(子|女)", heading)
    if m:
        r["order"] = cnum(m.group(1))
        s = body.find(m.group(0)) if m.group(0) in body else -1
        r["order_q"] = body[max(0, s - 6): s + len(m.group(0)) + 2] if s >= 0 else None
    mm = re.search(r"母(?!失詳)([^，。；（）]{2,16}?氏)[^，。；]{0,16}", body[:260])
    if mm:
        r["mother"] = mm.group(1)
        r["mother_q"] = mm.group(0)
    else:
        m2 = re.search(r"([^，。；（）]{2,16}?氏)所出", body[:260])
        if m2:
            r["mother"] = m2.group(1)
            r["mother_q"] = m2.group(0)
    sm = re.search(r"([^，。（）]{2,14}?)(?:之)?同母(?:弟|兄|妹|姊|姉)", body[:200])
    if sm:
        r["same_mother_as"] = sm.group(1)
        r["same_q"] = sm.group(0)
    # sinh: "(以)?嘉隆九年生"
    b = re.search(r"(" + ERA_RE + r")(" + N_RE + r")年生", body)
    if b and cnum(b.group(2)) is not None:
        r["birth"] = (era_year(b.group(1), cnum(b.group(2))), b.group(0))
    # mất: era trước gần nhất trong thân bài
    last_era = None
    for dm in re.finditer(r"(?:(" + ERA_RE + r")(" + N_RE + r")|(" + N_RE + r"))年[，,]?(?:[^。]{0,40}?)(?:薨|卒|殤|殞)", body):
        pass
    for dm in re.finditer(r"(" + ERA_RE + r")?(" + N_RE + r")年(?:[^。，]{0,6}[，,])?[^。]{0,24}?(薨|卒)", body):
        era = dm.group(1)
        if era is None:
            ctx = body[: dm.start()]
            ms = list(re.finditer(r"(" + ERA_RE + r")", ctx))
            era = ms[-1].group(1) if ms else None
        n = cnum(dm.group(2))
        if era and n is not None:
            r["death"] = (era_year(era, n), dm.group(0))
            break
    life = re.search(r"(?:壽|年|辰年)(" + N_RE + r")(?:有(?=[一二三四五六七八九]))?([一二三四五六七八九]?)歲", body)
    if life:
        n = cnum(life.group(1) + ("有" + life.group(2) if life.group(2) else ""))
        if n is not None:
            r["lifespan"] = (n, life.group(0))
    return r


# ── Bản dịch tiếng Việt (OCR) ────────────────────────────────────────
FATHER_VN = {"Thế": "gl", "Thánh": "mm", "Hiến": "tt", "Hưng": "ht"}


def vn_norm(s):
    return unicodedata.normalize("NFC", s)


def vn_entries(text, daughters_from_marker="TRUYỆN CÁC CÔNG CHÚA"):
    """→ [{head, n, father, line, sex}] theo thứ tự xuất hiện. Số thứ tự do OCR nên chỉ dùng khi hợp lý."""
    lines = [vn_norm(l.rstrip()) for l in text.split("\n")]
    sex = "s"
    out = []
    for i, l in enumerate(lines):
        if daughters_from_marker in l:
            sex = "d"
        m = re.match(r"^(?:Là )?[Cc]on thứ (\d{1,2}|hai|ba|tư|năm|sáu|bảy|tám|chín|mười)\b[^\n]{0,8}?của (Th[ếế]|Thánh|Hi[ếêế]n|Hưng)", l.strip())
        if not m:
            continue
        j = i - 1
        while j >= 0 and not lines[j].strip():
            j -= 1
        head = lines[j].strip() if j >= 0 else ""
        n = m.group(1)
        words = {"hai": 2, "ba": 3, "tư": 4, "năm": 5, "sáu": 6, "bảy": 7, "tám": 8, "chín": 9, "mười": 10}
        n = int(n) if n.isdigit() else words[n]
        key = m.group(2)[:2]
        father = {"Th": None}.get(key)
        fm = m.group(2)
        father = "gl" if fm.startswith("Th") and "Thánh" not in fm else ("mm" if fm == "Thánh" else ("tt" if fm.startswith("Hi") else "ht"))
        # "Thế" vs "Thánh"
        if fm == "Thánh":
            father = "mm"
        elif fm.startswith("Th"):
            father = "gl"
        out.append({"head": head, "n": n, "father": father, "line": l.strip(), "sex": sex, "idx": i})
    return out


# ── Ghép tên Việt theo hán-việt (không dựa số thứ tự OCR) ─────────────────────
def load_unihan(path):
    uni = {}
    for line in open(path, encoding="utf8"):
        if "\tkVietnamese\t" in line:
            cp, _, val = line.rstrip("\n").split("\t")
            uni[chr(int(cp[2:], 16))] = [x.lower() for x in val.split()]
    return uni


def unacc(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").replace("đ", "d")
    return s


def vn_headings(text):
    """Dòng tiêu đề tên người trong bản dịch: ngắn, Viết Hoa, theo sau là 'Là con…/Con…/Tự là…'."""
    lines = [vn_norm(l.rstrip()) for l in text.split("\n")]
    out = []
    for i, l in enumerate(lines):
        s = l.strip()
        if not (3 <= len(s) <= 70) or s.endswith((".", ",", ";", ":")):
            continue
        if not re.match(r"^[A-ZÀ-ỸĐ]", s):
            continue
        if not all(w[:1].isupper() or w[:1].islower() for w in s.split()):
            continue
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        nxt = lines[j].strip() if j < len(lines) else ""
        if re.match(r"^(Là con|Con |Tự là|Là em|Em |Là cháu|Cháu |Là anh|Mẹ |Con gái|Là hoàng)", nxt) or re.match(r"^(Con thứ|Là con thứ)", nxt):
            raw = s
            s = re.sub(r"\s+", " ", s).replace("Miễn", "Miên").replace("Miến", "Miên")
            out.append({"head": s, "raw": raw, "next": nxt, "idx": i})
    return out


TITLE_CN = {"郡王": ("Quận vương", 2), "郡公": ("Quận công", 2), "公主": ("công chúa", 2), "王": ("Vương", 1), "公": ("công", 1),
            "太王": ("Thái vương", 2), "縣公": ("Huyện công", 2), "縣侯": ("Huyện hầu", 2), "皇子": ("Hoàng tử", 2)}


def split_cn_heading(h, sex):
    """'壽春王綿定' → (title_cn, name_cn). Công chúa: '安恬公主玉珉'."""
    h = re.sub(r"（.*?）", "", h)
    if sex == "d":
        m = re.match(r"^(.*?公主)(.+)$", h)
        if m:
            return m.group(1), m.group(2)
        m = re.match(r"^皇女(.+)$", h)
        return ("皇女", m.group(1)) if m else (None, h)
    m = re.match(r"^(皇子)(.+)$", h)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r"^(.+?(?:郡王|郡公|太王|縣公|縣侯|王|公))((?:綿|洪|膺|昞|昴|昕|曄)?.+)$", h)
    if m:
        return m.group(1), m.group(2)
    return None, h


def match_vn(cn_heading, sex, vnh, uni, used):
    """Tìm tiêu đề dịch khớp với tiêu đề Hán. Trả {head, title_vn, name_vn} hoặc None (không chắc)."""
    title, name = split_cn_heading(cn_heading, sex)
    if not name:
        return None
    cands = []
    for e in vnh:
        words = e["head"].split()
        if sex == "d":
            if len(words) < 3:
                continue
            idx_ct = [k for k, w in enumerate(words) if w.lower() == "chúa"]
            if not idx_ct:
                continue
            k = idx_ct[0]
            t_words, n_words = words[: k + 1], words[k + 1:]
            if title == "皇女":
                continue
        else:
            m = re.search(r"\b(Miên|Hồng|Hoàng tử)\b", e["head"])
            kk = next((k for k, w in enumerate(words) if w in ("Miên", "Hồng", "Nguyễn")), None)
            if title == "皇子":
                if words[0] != "Hoàng" or len(words) < 3:
                    continue
                t_words, n_words = words[:2], words[2:]
            else:
                if kk is None or kk < 2:
                    continue
                t_words, n_words = words[:kk], words[kk:]
        if not title or len(t_words) != len(title):
            continue
        ok = True
        verified = 0
        for ch, w in zip(title, t_words):
            rd = uni.get(ch)
            if rd:
                if unacc(w) not in [unacc(r) for r in rd]:
                    ok = False
                    break
                verified += 1
        if not ok or verified < max(1, len(title) - 1):
            continue
        # tên riêng: các chữ có reading phải khớp
        nchars = [c for c in name if c not in "綿洪膺"] if sex == "s" else list(name)
        nwords = [w for w in n_words if w not in ("Miên", "Hồng", "Nguyễn", "Phúc")]
        if len(nwords) != len(nchars):
            continue
        for ch, w in zip(nchars, nwords):
            rd = uni.get(ch)
            if rd and unacc(w) not in [unacc(r) for r in rd]:
                ok = False
                break
        if not ok:
            continue
        cands.append({"head": e["head"], "raw": e["raw"], "next": e["next"], "title_vn": " ".join(t_words), "name_vn": " ".join(n_words), "idx": e["idx"]})
    cands = [c for c in cands if c["head"] not in used]
    return cands[0] if len(cands) == 1 else (None if not cands else {"ambiguous": [c["head"] for c in cands]})
