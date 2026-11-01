# Được gen_nguyen.py nạp bằng exec — thêm hoàng tử / công chúa (Liệt truyện) vào cây Nhà Nguyễn.
# Dữ kiện (thứ tự, mẹ, năm sinh, năm mất, tuổi thọ) lấy từ nguyên văn chữ Hán (Wikisource), có quote kiểm được;
# TÊN Việt lấy từ bản dịch Viện Sử học (OCR) chỉ khi khớp hán-việt từng chữ, còn lại giữ tên chữ Hán.
import sys as _sys

_sys.path.insert(0, __import__("os").path.dirname(__file__))
import princes_lib as PL  # noqa: E402

_uni = PL.load_unihan(f"{SRC}/../unihan/Unihan_Readings.txt")
_vn3 = open(f"{SRC}/../lietruyen/t3_hoangtu_congchua.txt", encoding="utf8").read()
_vn2 = "\n".join(open(f"{SRC}/../lietruyen/txt2/p{i:04d}.txt", encoding="utf8").read() for i in range(10, 21))
LN = {"t3": PL.vn_norm(re.sub(r"[\s​]+", "", _vn3)), "t2": PL.vn_norm(re.sub(r"[\s​]+", "", _vn2))}
TEXT["ln"] = LN
_vnh = {"t3": PL.vn_headings(_vn3), "t2": PL.vn_headings(_vn2)}

FATHER_OF = {"世祖": ("nguyen.gia-long", "gl", "Gia Long"), "聖祖": ("nguyen.minh-mang", "mm", "Minh Mạng"),
             "憲祖": ("nguyen.thieu-tri", "tt", "Thiệu Trị"), "興祖": ("nguyen.hung-to", "ht", "Hưng Tổ")}
EXISTING_HAN = {"壽春王綿定", "寧順郡王綿宜", "永祥郡王綿宏", "從善郡王綿審", "綏理王綿寊（子洪蔘）", "襄安郡王綿寳", "瑞太王洪依", "堅太王洪侅",
                "英睿皇太子景", "皇子晸"}
KNOWN_UNION = {  # (cha, cụm họ-mẹ trong nguyên văn) → khoá union đã có
    ("mm", "嘉妃范氏"): "u.minh-mang--gia-phi-pham", ("mm", "莊嬪陳氏"): "u.minh-mang--trang-tan-tran",
    ("mm", "吳氏"): "u.minh-mang--hien-phi-ngo", ("mm", "淑嬪阮克氏"): "u.minh-mang--thuc-tan-nguyen-khac",
    ("mm", "婕妤黎氏"): "u.minh-mang--tiep-du-le", ("mm", "安嬪胡氏"): "u.minh-mang--an-tan-ho",
    ("gl", "皇后宋氏"): "u.gia-long--thua-thien", ("gl", "承天高皇后宋氏"): "u.gia-long--thua-thien",
    ("gl", "順天高皇后陳氏"): "u.gia-long--thuan-thien", ("gl", "皇后陳氏"): "u.gia-long--thuan-thien",
    ("ht", "孝康皇后阮氏"): "u.hung-to--hieu-khang", ("tt", "慈裕博惠康壽太太皇太后范登氏"): "u.thieu-tri--nghi-thien",
}
TITLE_VI = {"皇后": "Hoàng hậu", "皇貴妃": "Hoàng quý phi", "貴妃": "Quý phi", "淑妃": "Thục phi", "賢妃": "Hiền phi", "惠妃": "Huệ phi",
            "嘉妃": "Gia phi", "德妃": "Đức phi", "麗妃": "Lệ phi", "妃": "Phi", "莊嬪": "Trang tần", "淑嬪": "Thục tần", "安嬪": "An tần",
            "和嬪": "Hòa tần", "柔嬪": "Nhu tần", "麗嬪": "Lệ tần", "瑞嬪": "Thụy tần", "禮嬪": "Lễ tần", "端嬪": "Đoan tần", "德嬪": "Đức tần",
            "順嬪": "Thuận tần", "恭嬪": "Cung tần", "宮嬪": "Cung tần", "嬪": "Tần", "婕妤": "Tiệp dư", "昭容": "Chiêu dung", "貴人": "Quý nhân",
            "美人": "Mỹ nhân", "才人": "Tài nhân", "宮人": "Cung nhân", "良人": "Lương nhân", "選侍": "Tuyển thị", "女官": "Nữ quan"}
SURNAME_VI = {"阮": "Nguyễn", "陳": "Trần", "黎": "Lê", "范": "Phạm", "胡": "Hồ", "吳": "Ngô", "杜": "Đỗ", "潘": "Phan", "武": "Võ", "丁": "Đinh",
              "梁": "Lương", "蓋": "Cái", "葢": "Cái", "高": "Cao", "黃": "Hoàng", "黄": "Hoàng", "張": "Trương", "楊": "Dương", "宋": "Tống", "鄧": "Đặng",
              "裴": "Bùi", "陶": "Đào", "阮文": "Nguyễn Văn", "阮有": "Nguyễn Hữu", "阮克": "Nguyễn Khắc", "阮公": "Nguyễn Công", "阮嘉": "Nguyễn Gia",
              "阮廷": "Nguyễn Đình", "阮福": "Nguyễn Phúc", "阮登": "Nguyễn Đăng", "武文": "Võ Văn", "陳文": "Trần Văn", "范登": "Phạm Đăng",
              "尊室": "Tôn Thất", "段": "Đoàn", "王": "Vương", "鄭": "Trịnh", "謝": "Tạ", "林": "Lâm", "孫": "Tôn", "何": "Hà", "章": "Chương"}


def mother_name_vi(phrase):
    t = next((k for k in sorted(TITLE_VI, key=len, reverse=True) if phrase.startswith(k)), None)
    rest = phrase[len(t):] if t else phrase
    sur = rest[:-1] if rest.endswith("氏") else rest
    sv = SURNAME_VI.get(sur) or (" ".join((_uni.get(ch) or ["?"])[0].capitalize() for ch in sur) if sur else "")
    if "?" in sv or not t:
        return f"Mẹ ({phrase})"
    return f"{TITLE_VI[t]} {sv} thị"


_mother_made = {}
_khuyet = {}
_han_by_key = {}  # (cha, sex, N) → mục
_made = []
_FIRST = {}


def _union_for(father_key, fab, phrase, vol_src, vol, where, quote):
    """Trả khoá union của (cha, mẹ). Mẹ chưa rõ → hôn nhân 'khuyết' duy nhất của cha."""
    if not phrase:
        k = f"u.{fab}--khuyet-hv"
        if k not in _khuyet and not any(u["key"] == k for u in unions):
            existing = [u for u in unions if u["husband"] == father_key and "wife" not in u]
            if existing:
                return existing[0]["key"]
            U(k, father_key)
            _khuyet[k] = True
        return k if k in _khuyet else next(u["key"] for u in unions if u["husband"] == father_key and "wife" not in u)
    known = KNOWN_UNION.get((fab, phrase))
    if known and any(u["key"] == known for u in unions):
        return known
    mk = f"nguyen.me.{fab}." + "".join(f"{ord(ch):x}" for ch in phrase)[:20]
    uk = f"u.{fab}--" + mk.split(".", 2)[2]
    if mk not in _mother_made:
        P(key=mk, full_name=mother_name_vi(phrase), gender="F",
          bio=f"Vợ lẽ của {FATHER_NAME[fab]} (nguyên văn chép: {phrase}); mẹ của một hoặc nhiều hoàng tử, công chúa. Chức danh và họ ghi theo nguyên văn; các con cùng ghi một chức danh và họ được gộp vào một người, nên có thể gồm hai người khác nhau trùng chức danh, họ.",
          citations=[c("existence", vol_src, vol, where, quote), c("bio", vol_src, vol, where, quote)])
        U(uk, father_key, mk, None, [c("union", vol_src, vol, where, quote)])
        _mother_made[mk] = uk
    return _mother_made[mk]


FATHER_NAME = {v[1]: v[2] for v in FATHER_OF.values()}
_VOL_OF = {"lt2/lt2_05.txt": ("lt2", 5), "lt2/lt2_06.txt": ("lt2", 6), "lt2/lt2_07.txt": ("lt2", 7), "lt2/lt2_08.txt": ("lt2", 8),
           "lt2/lt2_09.txt": ("lt2", 9), "lt2/lt2_10.txt": ("lt2", 10), "lt1/lt1_02.txt": ("lt", 2), "lt1/lt1_03.txt": ("lt", 3)}
_files = list(_VOL_OF)
_used_vn = {"t3": set(), "t2": set()}
_stats = {"added": 0, "vn": 0, "han": 0}
# lượt 1: gom mục; lượt 2: tạo người (để 'cùng mẹ với X' tra được)
_items = []
for _f in _files:
    _src, _vol = _VOL_OF[_f]
    for _g, _h, _b in PL.entries(f"{SRC}/{_f}"):
        if "缺" in _h or len(_b) < 25 or _h in EXISTING_HAN:
            continue
        _sex = "d" if ("女" in _g) else "s"
        _fa = FATHER_OF[_g[:2]]
        _r = PL.parse_cn(_h, _b)
        _items.append({"f": _f, "src": _src, "vol": _vol, "g": _g, "h": _h, "b": _b, "sex": _sex, "fa": _fa, "r": _r})

# phương ngữ OCR: ghép tên Việt
for _it in _items:
    _text = "t2" if _it["src"] == "lt" else "t3"
    _m = PL.match_vn(_it["h"], _it["sex"], _vnh[_text], _uni, _used_vn[_text])
    if _m and "head" in _m:
        _used_vn[_text].add(_m["head"])
        _it["vn"] = (_text, _m)

_by_name = {}
for _it in _items:
    _tit, _nm = PL.split_cn_heading(_it["h"], _it["sex"])
    _it["han_name"] = _nm
    _by_name[(_it["fa"][1], _nm[-2:] if len(_nm) > 1 and _nm[0] in "綿洪" else _nm[-1:])] = _it

def _wide(body, q, pad=8):
    """Mở rộng đoạn trích ra hai bên (vẫn là chuỗi con của body) cho đủ độ dài tối thiểu."""
    i = body.find(q)
    return body[max(0, i - pad): i + len(q) + pad] if i >= 0 else q


_seen_keys = set()
for _it in _items:
    _fk, _fab, _fname = _it["fa"]
    _r, _h, _b, _src, _vol = _it["r"], _it["h"], _it["b"], _it["src"], _it["vol"]
    _sx = _it["sex"]
    _n = _r["order"]
    _key = f"nguyen.{_fab}.{_sx}{_n if _n is not None else 'x'}"
    _i = 2
    while _key in _seen_keys:
        _key = f"nguyen.{_fab}.{_sx}{_n if _n is not None else 'x'}-{_i}"
        _i += 1
    _seen_keys.add(_key)
    _where = _h
    _first = _b[:20]
    # mẹ
    _phrase = _r["mother"]
    _mq = _r["mother_q"]
    if not _phrase and _r.get("same_mother_as"):
        _ref = _r["same_mother_as"]
        _tail = _ref[-2:] if len(_ref) > 1 and _ref[-2] in "綿洪" else _ref[-1:]
        _tgt = _by_name.get((_fab, _tail))
        if _tgt and _tgt["r"]["mother"]:
            _phrase = _tgt["r"]["mother"]
            _mq = None
    _uk = _union_for(_fk, _fab, _phrase, _src, _vol, _where, _mq or _first)
    # tên
    _title_cn, _name_cn = PL.split_cn_heading(_h, _sx)
    _vn = _it.get("vn")
    kind_vi = "Công chúa" if _sx == "d" else "Hoàng tử"
    if _vn:
        _full = re.sub(r"\s+", " ", _vn[1]["head"]).strip()
        _stats["vn"] += 1
    else:
        _full = f"{kind_vi} thứ {_n} của {_fname} ({_h})" if _n is not None else f"{kind_vi} của {_fname} ({_h})"
        _stats["han"] += 1
    cites = [c("existence", _src, _vol, _where, _first), c("parents", _src, _vol, _where, _mq or _first)]
    kw = {}
    parts = []
    if _n is not None:
        parts.append(f"{'Con gái' if _sx == 'd' else 'Con trai'} thứ {_n} của {_fname}")
        cites.append(c("bio", _src, _vol, _where, _r["order_q"]) if _r["order_q"] else c("bio", _src, _vol, _where, _first))
    if _phrase:
        parts.append(f"mẹ là {mother_name_vi(_phrase)}")
    birth_y = _r["birth"][0] if _r["birth"] else None
    death_y = _r["death"][0] if _r["death"] else None
    if birth_y:
        kw["birth"] = {"lunar_year": birth_y}
        cites.append(c("birth", _src, _vol, _where, _wide(_b, _r["birth"][1]), f"âm {birth_y}"))
        parts.append(f"sinh năm {birth_y}")
    if death_y and (birth_y is None or death_y >= birth_y):
        kw["death"] = {"lunar_year": death_y}
        cites.append(c("death", _src, _vol, _where, _wide(_b, _r["death"][1]), f"âm {death_y}"))
        parts.append(f"mất năm {death_y}")
        death_ok = True
    else:
        death_ok = False
    if _r["lifespan"] and death_ok and birth_y and abs((death_y - birth_y + 1) - _r["lifespan"][0]) <= 2:
        kw["lifespan"] = _r["lifespan"][0]
        cites.append(c("lifespan", _src, _vol, _where, _wide(_b, _r["lifespan"][1]), str(_r["lifespan"][0])))
        parts.append(f"thọ {_r['lifespan'][0]} tuổi")
    if _title_cn and _title_cn not in ("皇子", "皇女"):
        _tv = _vn[1]["title_vn"] if _vn else _title_cn
        kw["titles"] = [{"title": _tv}]
        cites.append(c("title:0", _src, _vol, _where, _first))
    if _vn:
        _t, _m = _vn
        cites.append(c("existence", "ln", _t, "bản dịch, mục " + _full, (_m["raw"] + " " + _m["next"])[:70]))
    bio = ". ".join(parts) + "." if parts else f"Có tên trong Đại Nam liệt truyện ({_h})."
    bio += f" Tên chữ Hán: {_name_cn}."
    cites.append(c("bio", _src, _vol, _where, _first))
    P(key=_key, full_name=_full, gender="F" if _sx == "d" else "M", parents=_uk, bio=bio, citations=cites, **kw)
    _stats["added"] += 1
print("hoàng tử/công chúa:", _stats)
