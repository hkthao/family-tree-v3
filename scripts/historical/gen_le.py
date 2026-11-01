"""Sinh data/historical/le.json — gia phả nhà Hậu Lê, giai đoạn LÊ SƠ (1428–1527), bản NHÁP.

  python3 -I scripts/historical/gen_le.py data/historical/le.json
  python3 -I scripts/historical/verify_quotes.py data/historical/le.json <thư mục nguồn>

Nguồn: Đại Việt sử ký toàn thư (TT) Bản kỷ Q.10–15 (zh.wikisource, tt/q_十.txt … q_十五.txt); locator có "năm X (YYYY)".
Giai đoạn Lê trung hưng (Q.16 trở đi) chưa làm. Cùng khuôn gen_ly.py / gen_tran.py.
"""
import json
import sys

OUT = sys.argv[1]
DRAFT = {"status": "draft", "note": "Khung P1 — trích từ nguyên văn Toàn thư; cần người duyệt đối chiếu bản dịch."}
persons, unions, graves, links, heritage = [], [], [], [], []


def c(field, vol, where, quote, value=None, note=None):
    d = {"field": field, "source": "TT", "locator": f"Bản kỷ Q.{vol}, {where}", "quote": quote}
    if value is not None:
        d["value"] = value
    if note:
        d["note"] = note
    return d


def P(**kw):
    kw.setdefault("review", DRAFT)
    persons.append(kw)


def U(key, husband, wife=None, order=None, cites=(), note=None):
    u = {"key": key, "husband": husband, "citations": list(cites), "review": DRAFT}
    if wife:
        u["wife"] = wife
    if order is not None:
        u["spouse_order"] = order
    if note:
        u["notes"] = note
    unions.append(u)


def G(key, name, occupants, cites, location_name=None, notes=None):
    if notes and not any(x["field"] == "notes" for x in cites):
        cites = cites + [{k: v for k, v in cites[0].items() if k not in ("value", "note")} | {"field": "notes"}]
    g = {"key": key, "name": name, "occupants": occupants, "citations": cites, "review": DRAFT}
    if location_name:
        g["location_name"] = location_name
    if notes:
        g["notes"] = notes
    graves.append(g)


def H(key, category, title, summary, body, people, cites, loc=None, photos=None):
    h = {"key": key, "category": category, "title": title, "summary": summary, "body": body,
         "people": [{"person": k, "role_note": r} for k, r in people], "citations": cites, "review": DRAFT}
    if loc:
        h["location_name"] = loc
    if photos:
        h["photos"] = photos
    heritage.append(h)


def pexels(photo_id, slug, author, caption, w=960):
    return {"url": f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w={w}",
            "source_page": f"https://www.pexels.com/photo/{slug}-{photo_id}/", "author": author, "license": "Pexels License",
            "kind": "photograph", "caption": caption}


def reign(n, temple, start, end, eras):
    return [{"dynasty": "Lê", "ordinal": n, "role": "emperor", "temple_name": temple, "start_year": start, "end_year": end,
             "era_names": [{"name": e, "from_year": y} for e, y in eras]}]


TD = "tiểu dẫn"
T = {k: f"Lê sơ, {v} — {TD}" for k, v in {
    1: "Thái Tổ", 2: "Thái Tông", 3: "Nhân Tông", 4: "Thánh Tông", 5: "Hiến Tông", 6: "Túc Tông", 7: "Uy Mục đế",
    8: "Tương Dực đế", 9: "Chiêu Tông", 10: "Cung Hoàng"}.items()}

# ── Tổ tiên Lê Lợi ─────────────────────────────────────────────────
ANC = "初，帝三世祖諱誨，嘗一日逰藍山"
P(key="le.hoi", full_name="Lê Hối", gender="M", is_root=True,
  bio="Ông tổ ba đời của Lê Thái Tổ. Một hôm đi chơi núi Lam, thấy đàn chim bay lượn như người tụ hội, cho là đất tốt nên dời đến ở; ba năm thì cơ nghiệp thành, từ đó đời đời làm bậc thủ lĩnh một vùng.",
  citations=[c("existence", 10, f"{T[1]}", ANC), c("bio", 10, f"{T[1]}", "因徙居焉。三年而產業成。自是世爲一方君長")])
U("u.hoi", "le.hoi")
P(key="le.dinh", full_name="Lê Đinh", gender="M", parents="u.hoi", titles=[{"title": "Tuyên Tổ Hiến Văn Duệ Triết hoàng đế (truy tôn)"}],
  bio="Con Lê Hối, ông nội Lê Thái Tổ; nối nghiệp nhà, có hơn nghìn người theo. Năm Đinh Tỵ (1437) được truy tôn Tuyên Tổ Hiến Văn Duệ Triết hoàng đế.",
  citations=[c("existence", 10, f"{T[1]}", "誨生汀，克承其家，有眾生千餘人"), c("parents", 10, f"{T[1]}", "誨生汀，克承其家，有眾生千餘人"),
             c("title:0", 11, "năm Đinh Tỵ (1437)", "宣祖憲文皇帝曰宣祖憲文睿哲皇帝"),
             c("bio", 10, f"{T[1]}", "誨生汀，克承其家，有眾生千餘人")])
P(key="le.dinh.nguyen-thi", full_name="Nguyễn Thị Quách", gender="F", titles=[{"title": "Trinh Từ Ý Văn Trang Hiến hoàng thái hậu (truy tôn)"}],
  bio="Vợ Lê Đinh, sinh ba con trai: Tòng (con trưởng), Khoáng (con thứ)… Truy tôn Trinh Từ Ý Văn Trang Hiến hoàng thái hậu (1437).",
  citations=[c("existence", 10, f"{T[1]}", "妻阮氏諱廓生三子，長曰從，次曰曠"),
             c("title:0", 11, "năm Đinh Tỵ (1437)", "貞慈懿文皇太后曰貞慈懿文莊献皇太后"),
             c("bio", 10, f"{T[1]}", "妻阮氏諱廓生三子，長曰從，次曰曠")])
U("u.dinh--nguyen-thi", "le.dinh", "le.dinh.nguyen-thi", 1, [c("union", 10, f"{T[1]}", "妻阮氏諱廓生三子，長曰從，次曰曠")])
P(key="le.khoang", full_name="Lê Khoáng", gender="M", parents="u.dinh--nguyen-thi", titles=[{"title": "Hiển Tổ Chiêu Đức Chí Nhân hoàng đế (truy tôn)"}],
  bio="Con thứ hai của Lê Đinh, cha Lê Thái Tổ. Năm Đinh Tỵ (1437) được truy tôn Hiển Tổ Chiêu Đức Chí Nhân hoàng đế.",
  citations=[c("existence", 10, f"{T[1]}", "妻阮氏諱廓生三子，長曰從，次曰曠"), c("parents", 10, f"{T[1]}", "妻阮氏諱廓生三子，長曰從，次曰曠"),
             c("title:0", 11, "năm Đinh Tỵ (1437)", "尊號顯祖昭德皇帝曰顯祖昭德至仁皇帝"),
             c("bio", 10, f"{T[1]}", "妻阮氏諱廓生三子，長曰從，次曰曠")])
P(key="le.khoang.trinh-thi", full_name="Trịnh Thị Thương", gender="F", titles=[{"title": "Hiển Từ Gia Thục Khâm Thuận hoàng thái hậu (truy tôn)"}],
  bio="Vợ Lê Khoáng, mẹ Lê Thái Tổ, người Lôi Dương. Truy tôn Hiển Từ Gia Thục Khâm Thuận hoàng thái hậu (1437).",
  citations=[c("existence", 10, f"{T[1]}", "曠妻雷陽主山人主山，今水注也鄭氏，諱蒼"),
             c("title:0", 11, "năm Đinh Tỵ (1437)", "顯慈嘉淑皇太后曰顯慈嘉淑欽順皇太后"),
             c("bio", 10, f"{T[1]}", "曠妻雷陽主山人主山，今水注也鄭氏，諱蒼")])
U("u.khoang--trinh-thi", "le.khoang", "le.khoang.trinh-thi", 1, [c("union", 10, f"{T[1]}", "曠妻雷陽主山人主山，今水注也鄭氏，諱蒼")])

# ── 1. Thái Tổ ─────────────────────────────────────────────────────
P(key="le.thai-to", full_name="Lê Thái Tổ", gender="M", parents="u.khoang--trinh-thi", nickname="Lê Lợi",
  birth={"lunar_year": 1385, "lunar_month": 8, "lunar_day": 6}, death={"lunar_year": 1433, "lunar_month": 8, "lunar_leap": True, "lunar_day": 22},
  lifespan=51, burial_place="Vĩnh Lăng, Lam Sơn",
  posthumous_name="Thống Thiên Khải Vận Thánh Đức Thần Công Duệ Văn Anh Vũ Đại Hiếu hoàng đế",
  reigns=reign(1, "Thái Tổ", 1428, 1433, [("Thuận Thiên", 1428)]),
  bio="Vua đầu triều Hậu Lê, tên húy Lợi, người làng Lam Sơn (Lương Giang, Thanh Hóa), sinh ngày 6 tháng 8 năm Ất Sửu (1385) ở làng Chủ Sơn. Mùa xuân năm Mậu Tuất (1418) khởi nghĩa ở Lam Sơn, sau mười năm đánh đuổi quân Minh; năm Mậu Thân (1428) lên ngôi ở Đông Kinh, đặt quốc hiệu Đại Việt, niên hiệu Thuận Thiên. Ở ngôi 6 năm, mất ngày 22 tháng 8 nhuận năm Quý Sửu (1433), thọ 51 tuổi, táng Vĩnh Lăng.",
  citations=[c("existence", 10, f"{T[1]}", "帝姓黎，諱利，清化梁江藍山鄕人也"),
             c("nickname", 10, f"{T[1]}", "帝姓黎，諱利，清化梁江藍山鄕人也", "Lê Lợi"),
             c("parents", 10, f"{T[1]}", "曠妻雷陽主山人主山，今水注也鄭氏，諱蒼。以陳昌符九年乙丑八月初六日，生帝于雷陽主山鄕"),
             c("birth", 10, f"{T[1]}", "以陳昌符九年乙丑八月初六日，生帝于雷陽主山鄕", "âm 1385-8-6"),
             c("lifespan", 10, f"{T[1]}", "在位六年，壽五十一，塟永陵", "51"),
             c("death", 10, "năm Quý Sửu (1433)", "二十二日，帝崩于正寢", "âm 1433-8n-22", note="Tháng 8 nhuận."),
             c("burial_place", 10, f"{T[1]}", "在位六年，壽五十一，塟永陵", "Vĩnh Lăng, Lam Sơn"),
             c("posthumous_name", 11, "năm Đinh Tỵ (1437)", "太祖統天啓運聖德神功睿文英武皇帝曰太祖統天啓運聖德神功睿文英武大孝皇帝",
               "Thống Thiên Khải Vận Thánh Đức Thần Công Duệ Văn Anh Vũ Đại Hiếu hoàng đế"),
             c("reign:0", 10, "năm Mậu Thân (1428)", "十五日，帝即位于東京，大赦，改元順天，建國號大越"),
             c("reign:0", 10, "năm Quý Sửu (1433)", "二十二日，帝崩于正寢"),
             c("bio", 10, "năm Mậu Tuất (1418)", "戊戌明永樂十六年春正月庚申，帝起兵於藍山")])
P(key="le.thai-to.pham-thi", full_name="Phạm Thị Ngọc Trần", gender="F", titles=[{"title": "Cung Từ hoàng thái hậu"}],
  bio="Vợ Lê Thái Tổ, mẹ Lê Thái Tông, người Lôi Dương, Thanh Hóa. Con lên ngôi tôn là Cung Từ hoàng thái hậu.",
  citations=[c("existence", 11, f"{T[2]}", "其母恭慈皇太后范氏，諱陳，清華雷陽群來鄕人也"),
             c("title:0", 11, f"{T[2]}", "其母恭慈皇太后范氏"), c("bio", 11, f"{T[2]}", "其母恭慈皇太后范氏，諱陳，清華雷陽群來鄕人也")])
U("u.thai-to--pham-thi", "le.thai-to", "le.thai-to.pham-thi", 1, [c("union", 11, f"{T[2]}", "太祖次子。在位九年，東巡而崩，壽二十")])
G("lang.vinh-lang", "Vĩnh Lăng", ["le.thai-to"],
  [c("existence", 10, f"{T[1]}", "在位六年，壽五十一，塟永陵"),
   c("location_name", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵", "Lam Sơn", note="Nhắc tới Vĩnh Lăng ở Lam Sơn khi chôn Thái Tông bên trái."),
   c("occupant:0", 10, f"{T[1]}", "在位六年，壽五十一，塟永陵"),
   c("notes", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵")],
  location_name="Lam Sơn", notes="Lăng Lê Thái Tổ ở Lam Sơn (sau là khu Lam Kinh, Thanh Hóa). Hựu Lăng của Thái Tông nằm bên trái.")

# ── 2. Thái Tông ───────────────────────────────────────────────────
P(key="le.thai-tong", full_name="Lê Thái Tông", gender="M", parents="u.thai-to--pham-thi", nickname="Lê Nguyên Long",
  birth={"lunar_year": 1423, "lunar_month": 11, "lunar_day": 20}, death={"lunar_year": 1442, "lunar_month": 8, "lunar_day": 4}, lifespan=20,
  burial_place="Hựu Lăng, Lam Sơn",
  posthumous_name="Kế Thiên Thể Đạo Hiển Đức Thánh Công Khâm Minh Văn Tư Anh Duệ Nhân Triết Chiêu Hiển Kiến Trung Văn hoàng đế",
  reigns=reign(2, "Thái Tông", 1433, 1442, [("Thiệu Bình", 1434), ("Đại Bảo", 1440)]),
  bio="Con thứ của Lê Thái Tổ, tên húy Nguyên Long, sinh ngày 20 tháng 11 năm Quý Mão (1423). Năm 1428 phong Lương quận công, năm 1430 lập hoàng thái tử; lên ngôi ngày 8 tháng 9 năm Quý Sửu (1433) khi mới 11 tuổi. Ở ngôi 9 năm, đi tuần phía đông, đến vườn vải Lệ Chi (Gia Định) thì mắc bệnh mất ngày 4 tháng 8 năm Nhâm Tuất (1442), thọ 20 tuổi, táng Hựu Lăng. Vụ án Lệ Chi Viên sau đó giết cả họ Nguyễn Trãi.",
  citations=[c("existence", 11, f"{T[2]}", "諱元龍，太祖次子"),
             c("nickname", 11, f"{T[2]}", "諱元龍，太祖次子", "Lê Nguyên Long"),
             c("parents", 11, f"{T[2]}", "其母恭慈皇太后范氏，諱陳"),
             c("birth", 11, f"{T[2]}", "以太祖起義六年癸卯冬十一月二十日誕生", "âm 1423-11-20"),
             c("lifespan", 11, f"{T[2]}", "在位九年，東巡而崩，壽二十，塟祐陵", "20"),
             c("death", 11, "năm Nhâm Tuất (1442)", "八月四日，帝至嘉定縣茘枝園，遽得虐疾崩", "âm 1442-8-4"),
             c("burial_place", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵", "Hựu Lăng, Lam Sơn"),
             c("posthumous_name", 11, "năm Nhâm Tuất (1442)", "上尊號曰繼天體道顯德聖功欽明文思英睿仁哲昭顯建中文皇帝，廟號太宗",
               "Kế Thiên Thể Đạo Hiển Đức Thánh Công Khâm Minh Văn Tư Anh Duệ Nhân Triết Chiêu Hiển Kiến Trung Văn hoàng đế"),
             c("reign:0", 10, "năm Quý Sửu (1433)", "秋九月八日，太子元龍即皇帝位，大赦改元，以明年為紹平元年"),
             c("reign:0", 11, "năm Nhâm Tuất (1442)", "八月四日，帝至嘉定縣茘枝園，遽得虐疾崩"),
             c("bio", 11, f"{T[2]}", "順天元年三月册封梁郡公，二年正月六日立為皇太子")])
G("lang.huu-lang", "Hựu Lăng", ["le.thai-tong"],
  [c("existence", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵"),
   c("location_name", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵", "Lam Sơn"),
   c("occupant:0", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵"),
   c("notes", 11, "năm Nhâm Tuất (1442)", "命翰林院侍讀學士兼知御前學生局近侍祗候阮天錫撰祐陵碑文")],
  location_name="Lam Sơn", notes="Lăng Lê Thái Tông, ở bên trái Vĩnh Lăng; Nguyễn Thiên Tích được giao soạn bia Hựu Lăng.")
P(key="le.thai-tong.nguyen-thi-anh", full_name="Nguyễn Thị Anh", gender="F", titles=[{"title": "Tuyên Từ hoàng thái hậu"}],
  bio="Vợ Lê Thái Tông, mẹ Lê Nhân Tông, người Đông Sơn, Thanh Hóa. Khi con còn nhỏ lên ngôi, bà buông rèm nghe chính. Bị giết cùng con trong vụ nổi loạn của Nghi Dân (1459); sau được truy tôn Tuyên Từ Nhân Ý Chiêu Túc hoàng thái hậu.",
  citations=[c("existence", 11, f"{T[3]}", "母宣慈皇太后阮氏，諱英，清化東山布衛人"),
             c("title:0", 11, f"{T[3]}", "母宣慈皇太后阮氏，諱英"),
             c("bio", 11, "năm Kỷ Mão (1459)", "帝及宣慈皇太后俱遇害"),
             c("bio", 12, "năm Canh Thìn (1460)", "阮太后尊謚曰：宣慈仁懿昭肅皇太后")])
U("u.thai-tong--nguyen-thi-anh", "le.thai-tong", "le.thai-tong.nguyen-thi-anh", 1,
  [c("union", 11, f"{T[3]}", "太宗第三子也。母宣慈皇太后阮氏，諱英")])
P(key="le.thai-tong.ngo-thi", full_name="Ngô Thị Ngọc Dao", gender="F", titles=[{"title": "Quang Thục hoàng thái hậu"}],
  bio="Vợ Lê Thái Tông (khởi đầu là tiệp dư), mẹ Lê Thánh Tông, người Thanh Hóa. Truyền rằng bà mơ thấy thượng đế ban cho một tiên đồng thì có thai. Con lên ngôi tôn là Quang Thục hoàng thái hậu.",
  citations=[c("existence", 12, f"{T[4]}", "其母光淑皇太后吳氏，清化安定董滂人也"),
             c("title:0", 12, f"{T[4]}", "其母光淑皇太后吳氏"),
             c("bio", 12, f"{T[4]}", "初太后爲婕妤，祈嗣，夢天帝錫以仙童，遂有娠")])
U("u.thai-tong--ngo-thi", "le.thai-tong", "le.thai-tong.ngo-thi", 2, [c("union", 12, f"{T[4]}", "太宗第四子也。在位三十八年")])
P(key="le.thai-tong.duong-thi", full_name="Dương Thị Bí", gender="F",
  bio="Vợ Lê Thái Tông, mẹ Lê Nghi Dân. Vì mắc tội với Thái Tông nên con trai trưởng không được lập làm thái tử.",
  citations=[c("existence", 11, "năm Kỷ Mão (1459)", "先是宜民母楊氏賁得罪於太宗，宜民不得立"),
             c("bio", 11, "năm Kỷ Mão (1459)", "先是宜民母楊氏賁得罪於太宗，宜民不得立")])
U("u.thai-tong--duong-thi", "le.thai-tong", "le.thai-tong.duong-thi", 3, [c("union", 11, "năm Kỷ Mão (1459)", "先是宜民母楊氏賁得罪於太宗，宜民不得立")])

# ── 3. Nhân Tông ───────────────────────────────────────────────────
P(key="le.nhan-tong", full_name="Lê Nhân Tông", gender="M", parents="u.thai-tong--nguyen-thi-anh", nickname="Lê Bang Cơ",
  birth={"lunar_year": 1441, "lunar_month": 6, "lunar_day": 9}, death={"lunar_year": 1459, "lunar_month": 10, "lunar_day": 3}, lifespan=19,
  burial_place="Mục Lăng", posthumous_name="Khâm Văn Nhân Hiếu Tuyên Minh hoàng đế",
  reigns=reign(3, "Nhân Tông", 1442, 1459, [("Thái Hòa", 1443), ("Diên Ninh", 1454)]),
  bio="Con thứ ba của Lê Thái Tông, tên húy Bang Cơ, sinh ngày 9 tháng 6 năm Tân Dậu (1441), lập thái tử năm 1442, lên ngôi ngày 12 tháng 8 cùng năm khi mới hai tuổi; mẹ buông rèm nghe chính. Ngày 3 tháng 10 năm Kỷ Mão (1459), Lạng Sơn vương Nghi Dân đêm bắc thang vào thành giết vua cùng Tuyên Từ hoàng thái hậu. Ở ngôi 17 năm, thọ 19 tuổi, táng Mục Lăng.",
  citations=[c("existence", 11, f"{T[3]}", "諱邦基，太宗第三子也"),
             c("nickname", 11, f"{T[3]}", "諱邦基，太宗第三子也", "Lê Bang Cơ"),
             c("parents", 11, f"{T[3]}", "母宣慈皇太后阮氏，諱英，清化東山布衛人"),
             c("birth", 11, f"{T[3]}", "帝以大寶二年辛酉六月九日甲戌誕生", "âm 1441-6-9"),
             c("lifespan", 11, f"{T[3]}", "在位十七年，壽一十九，塟穆陵", "19"),
             c("death", 11, "năm Kỷ Mão (1459)", "冬十月三日，諒山王宜民夜作梯，分三道上東門城，盗入宫禁。帝及宣慈皇太后俱遇害", "âm 1459-10-3"),
             c("burial_place", 11, f"{T[3]}", "在位十七年，壽一十九，塟穆陵", "Mục Lăng"),
             c("posthumous_name", 12, "năm Canh Thìn (1460)", "上仁宗尊號曰：欽文仁孝宣明皇帝，廟號仁宗", "Khâm Văn Nhân Hiếu Tuyên Minh hoàng đế"),
             c("reign:0", 11, "năm Nhâm Tuất (1442)", "三年六月六日立為皇太子，八月十二日即位，改元太和") if False else
             c("reign:0", 11, f"{T[3]}", "三年六月六日立為皇太子，八月十二日即位，改元太和，以誕日為憲天聖節"),
             c("reign:0", 11, "năm Kỷ Mão (1459)", "帝及宣慈皇太后俱遇害"),
             c("bio", 11, f"{T[3]}", "三年六月六日立為皇太子，八月十二日即位，改元太和，以誕日為憲天聖節")])
G("lang.muc-lang", "Mục Lăng", ["le.nhan-tong"],
  [c("existence", 11, f"{T[3]}", "在位十七年，壽一十九，塟穆陵"), c("occupant:0", 11, f"{T[3]}", "在位十七年，壽一十九，塟穆陵")],
  notes="Lăng Lê Nhân Tông; Toàn thư chỉ ghi tên lăng.")

# ── 3b. Nghi Dân ───────────────────────────────────────────────────
P(key="le.nghi-dan", full_name="Lê Nghi Dân", gender="M", parents="u.thai-tong--duong-thi",
  birth={"lunar_year": 1439, "lunar_month": 10}, death={"lunar_year": 1460},
  titles=[{"title": "Lạng Sơn vương"}, {"title": "Lệ Đức hầu (giáng phong)"}],
  reigns=[{"dynasty": "Lê", "ordinal": 4, "role": "emperor", "start_year": 1459, "end_year": 1460, "era_names": [{"name": "Thiên Hưng", "from_year": 1459}]}],
  bio="Con trưởng của Lê Thái Tông, sinh tháng 10 năm Kỷ Mùi (1439), phong Lạng Sơn vương. Mẹ họ Dương mắc tội với Thái Tông nên ông không được lập thái tử. Ngày 3 tháng 10 năm Kỷ Mão (1459) cùng bè đảng giết Nhân Tông và Tuyên Từ thái hậu, ngày 7 tự lên ngôi, niên hiệu Thiên Hưng. Tháng 6 năm Canh Thìn (1460), các đại thần lật đổ, giáng làm Lệ Đức hầu rồi bị bắt tự thắt cổ; Thánh Tông lên ngôi.",
  citations=[c("existence", 11, "năm Kỷ Mão (1459)", "初七日，諒山王宜民自立即皇帝位，大赦，改元天興"),
             c("parents", 11, "năm Kỷ Mão (1459)", "朕以太宗文皇帝長子，昔以正位東宫"),
             c("birth", 11, "năm Kỷ Mùi (1439)", "冬十月，皇子宜民生", "âm 1439-10"),
             c("death", 12, "năm Canh Thìn (1460)", "黎凌以帛授宜民，令自縊", "âm 1460"),
             c("title:0", 11, "năm Bính Tý (1456)", "諒山王宜民預焉"),
             c("title:1", 12, "năm Canh Thìn (1460)", "定儀降宜民爲厲德侯"),
             c("reign:0", 11, "năm Kỷ Mão (1459)", "初七日，諒山王宜民自立即皇帝位，大赦，改元天興"),
             c("bio", 11, "năm Kỷ Mão (1459)", "先是宜民母楊氏賁得罪於太宗，宜民不得立")])

# ── 4. Thánh Tông ──────────────────────────────────────────────────
P(key="le.thanh-tong", full_name="Lê Thánh Tông", gender="M", parents="u.thai-tong--ngo-thi", nickname="Lê Tư Thành; Lê Hạo",
  birth={"lunar_year": 1442, "lunar_month": 7, "lunar_day": 20}, death={"lunar_year": 1497, "lunar_month": 1, "lunar_day": 30}, lifespan=56,
  burial_place="Chiêu Lăng", posthumous_name="Sùng Thiên Quảng Vận Cao Minh Quang Chính Chí Đức Đại Công Thánh Văn Thần Vũ Đạt Hiếu Thuần hoàng đế",
  reigns=reign(5, "Thánh Tông", 1460, 1497, [("Quang Thuận", 1460), ("Hồng Đức", 1470)]),
  bio="Con thứ tư của Lê Thái Tông, tên húy Tư Thành, lại có tên Hạo, sinh ngày 20 tháng 7 năm Nhâm Tuất (1442). Năm 1459 được các đại thần đón về, diệt Nghi Dân; ngày 8 tháng 6 năm Canh Thìn (1460) lên ngôi ở điện Tường Quang, niên hiệu Quang Thuận (1460) rồi Hồng Đức (1470). Ở ngôi 38 năm, mở mang bờ cõi, đặt chế độ, được Toàn thư sánh với Hán Vũ đế, Đường Thái Tông. Mất ngày 30 tháng giêng năm Đinh Tỵ (1497) ở điện Bảo Quang, thọ 56 tuổi, táng Chiêu Lăng.",
  citations=[c("existence", 12, f"{T[4]}", "諱思誠，又諱灝，太宗第四子也"),
             c("nickname", 12, f"{T[4]}", "諱思誠，又諱灝，太宗第四子也", "Lê Tư Thành; Lê Hạo"),
             c("parents", 12, f"{T[4]}", "其母光淑皇太后吳氏，清化安定董滂人也"),
             c("birth", 12, f"{T[4]}", "以大寶三年壬戌，七月二十日誕生", "âm 1442-7-20"),
             c("lifespan", 12, f"{T[4]}", "在位三十八年，壽五十六而崩，㘸昭陵", "56"),
             c("death", 13, "năm Đinh Tỵ (1497)", "三十日壬子帝崩於寶光殿", "âm 1497-1-30"),
             c("burial_place", 12, f"{T[4]}", "在位三十八年，壽五十六而崩，㘸昭陵", "Chiêu Lăng"),
             c("posthumous_name", 13, "năm Đinh Tỵ (1497)", "上大行皇帝尊號曰崇天廣運高明光正至德大功聖文神武達孝淳皇帝，廟號聖宗",
               "Sùng Thiên Quảng Vận Cao Minh Quang Chính Chí Đức Đại Công Thánh Văn Thần Vũ Đạt Hiếu Thuần hoàng đế"),
             c("reign:0", 12, "năm Canh Thìn (1460)", "初八日，帝即位于祥光殿，改元光順元年，大赦天下"),
             c("reign:0", 13, "năm Đinh Tỵ (1497)", "三十日壬子帝崩於寶光殿"),
             c("bio", 12, f"{T[4]}", "及延甯年間，宜民僭位，改封帝爲嘉王")])
G("lang.chieu-lang", "Chiêu Lăng", ["le.thanh-tong"],
  [c("existence", 12, f"{T[4]}", "在位三十八年，壽五十六而崩，㘸昭陵"), c("occupant:0", 12, f"{T[4]}", "在位三十八年，壽五十六而崩，㘸昭陵")],
  notes="Lăng Lê Thánh Tông; Toàn thư chỉ ghi tên lăng (chữ 'táng' ở đây khắc dị thể).")

# ── 5. Hiến Tông ───────────────────────────────────────────────────
P(key="le.thanh-tong.nguyen-thi-hang", full_name="Nguyễn Thị Hằng", gender="F", titles=[{"title": "Trường Lạc Thánh Từ hoàng thái hậu"}],
  bio="Vợ Lê Thánh Tông, mẹ Lê Hiến Tông, con gái thứ hai của Nguyễn Đức Trung (người Gia Miêu ngoại trang, Tống Sơn). Truyền rằng bà nằm mộng thấy rồng vàng từ trời bay vào chỗ ở rồi sinh con.",
  citations=[c("existence", 14, f"{T[5]}", "其母長樂聖慈皇太后阮氏，諱晅"),
             c("title:0", 14, f"{T[5]}", "其母長樂聖慈皇太后阮氏，諱晅"),
             c("bio", 14, f"{T[5]}", "及彌月，夢黃龍自天而下，飛入所居，少頃遂生帝")])
U("u.thanh-tong--nguyen-thi-hang", "le.thanh-tong", "le.thanh-tong.nguyen-thi-hang", 1, [c("union", 14, f"{T[5]}", "諱鏳，又諱暉，聖宗之長子也")])
P(key="le.hien-tong", full_name="Lê Hiến Tông", gender="M", parents="u.thanh-tong--nguyen-thi-hang", nickname="Lê Huy; Lê Tăng",
  birth={"lunar_year": 1461, "lunar_month": 8, "lunar_day": 10}, death={"lunar_year": 1504, "lunar_month": 5, "lunar_day": 24}, lifespan=44,
  burial_place="Dụ Lăng", posthumous_name="Thể Thiên Ngưng Đạo Mậu Đức Chí Nhân Chiêu Văn Thiệu Vũ Tuyên Triết Khâm Thánh Chương Hiếu Duệ hoàng đế",
  reigns=reign(6, "Hiến Tông", 1497, 1504, [("Cảnh Thống", 1498)]),
  bio="Con trưởng của Lê Thánh Tông, tên húy Tăng, lại có tên Huy, sinh ngày 10 tháng 8 năm Tân Tỵ (1461), lập thái tử năm 1463, lên ngôi sau khi cha mất (1497), niên hiệu Cảnh Thống. Ở ngôi 7 năm, thiên hạ yên ổn, nhưng lao vào nữ sắc; mất ngày 24 tháng 5 năm Giáp Tý (1504) ở điện Đồ Trị, thọ 44 tuổi, táng Dụ Lăng.",
  citations=[c("existence", 14, f"{T[5]}", "諱鏳，又諱暉，聖宗之長子也"),
             c("nickname", 14, f"{T[5]}", "諱鏳，又諱暉，聖宗之長子也", "Lê Huy; Lê Tăng"),
             c("parents", 14, f"{T[5]}", "其母長樂聖慈皇太后阮氏，諱晅"),
             c("birth", 14, f"{T[5]}", "光順二年辛已，八月初十日生", "âm 1461-8-10"),
             c("lifespan", 14, f"{T[5]}", "在位七年，壽四十四歳而崩，葬裕陵", "44"),
             c("death", 14, "năm Giáp Tý (1504)", "五月二十三日，帝以女謁盛，嬰重疾，大漸，乃遺命皇太子嗣位。二十四日，帝崩于圖治殿", "âm 1504-5-24"),
             c("burial_place", 14, f"{T[5]}", "在位七年，壽四十四歳而崩，葬裕陵", "Dụ Lăng"),
             c("posthumous_name", 14, "năm Giáp Tý (1504)", "上大行皇帝尊諡曰體天凝道懋德至仁昭文紹武宣哲欽聖彰孝睿皇帝，廟號憲宗",
               "Thể Thiên Ngưng Đạo Mậu Đức Chí Nhân Chiêu Văn Thiệu Vũ Tuyên Triết Khâm Thánh Chương Hiếu Duệ hoàng đế"),
             c("reign:0", 14, f"{T[5]}", "洪德二十八年正月，聖宗崩，於是卽皇帝位，改元，大赦"),
             c("reign:0", 14, "năm Giáp Tý (1504)", "二十四日，帝崩于圖治殿"),
             c("bio", 14, f"{T[5]}", "光順三年三月，册立爲皇太子")])
G("lang.du-lang", "Dụ Lăng", ["le.hien-tong"],
  [c("existence", 14, f"{T[5]}", "在位七年，壽四十四歳而崩，葬裕陵"), c("occupant:0", 14, f"{T[5]}", "在位七年，壽四十四歳而崩，葬裕陵")],
  notes="Lăng Lê Hiến Tông; Toàn thư chỉ ghi tên lăng.")
P(key="le.hien-tong.nguyen-thi-hoan", full_name="Nguyễn Thị Hoàn", gender="F", titles=[{"title": "Trang Thuận Minh Ý hoàng thái hậu"}],
  bio="Vợ (quý phi) của Lê Hiến Tông, mẹ Lê Túc Tông, người Thiên Thi. Sau khi con lên ngôi, truy tôn Trang Thuận Minh Ý hoàng thái hậu.",
  citations=[c("existence", 14, f"{T[6]}", "其母，莊順皇太后阮氏，諱環，天施平陵人也"),
             c("title:0", 14, "năm Giáp Tý (1504)", "母貴妃爲莊順明懿皇太后"),
             c("bio", 14, f"{T[6]}", "其母，莊順皇太后阮氏，諱環，天施平陵人也")])
U("u.hien-tong--nguyen-thi-hoan", "le.hien-tong", "le.hien-tong.nguyen-thi-hoan", 1, [c("union", 14, f"{T[6]}", "憲宗之第三子也")])
P(key="le.hien-tong.nguyen-thi-can", full_name="Nguyễn Thị Cận", gender="F", titles=[{"title": "Chiêu Nhân hoàng thái hậu"}],
  bio="Vợ Lê Hiến Tông, mẹ Lê Uy Mục. Xuất thân nghèo, bán mình làm nô; do tội của chủ mà bị sung làm cung tì, rồi được Hiến Tông chú ý nạp làm phi. Con lên ngôi tôn là Chiêu Nhân hoàng thái hậu.",
  citations=[c("existence", 14, f"{T[7]}", "其母，昭仁皇太后阮氏，諱瑾，東岸扶騐人也"),
             c("title:0", 14, f"{T[7]}", "其母，昭仁皇太后阮氏，諱瑾"),
             c("bio", 14, f"{T[7]}", "少孤貧，自賣與奉天人")])
U("u.hien-tong--nguyen-thi-can", "le.hien-tong", "le.hien-tong.nguyen-thi-can", 2, [c("union", 14, f"{T[7]}", "憲宗第二子，肅宗之庶兄也")])

# ── 6. Túc Tông ────────────────────────────────────────────────────
P(key="le.tuc-tong", full_name="Lê Túc Tông", gender="M", parents="u.hien-tong--nguyen-thi-hoan", nickname="Lê Thuần",
  birth={"lunar_year": 1488, "lunar_month": 8, "lunar_day": 1}, death={"lunar_year": 1504, "lunar_month": 12, "lunar_day": 8}, lifespan=17,
  burial_place="Kính Lăng", posthumous_name="Chiêu Nghĩa Hiển Nhân Ôn Cung Uyên Mặc Đôn Hiếu Doãn Cung Khâm hoàng đế",
  reigns=reign(7, "Túc Tông", 1504, 1504, [("Thái Trinh", 1504)]),
  bio="Con thứ ba của Lê Hiến Tông, tên húy Thuần, sinh ngày 1 tháng 8 năm Mậu Thân (1488), lập thái tử năm 1499, lên ngôi tháng 6 năm Giáp Tý (1504), niên hiệu Thái Trinh. Ham học, thân hiền, nhưng mất sau chưa đầy một năm, ngày 8 tháng 12 năm Giáp Tý (1504) ở điện Hoàng Cực, thọ 17 tuổi, táng Kính Lăng.",
  citations=[c("existence", 14, f"{T[6]}", "憲宗之第三子也。在位未期年，壽十七歲而崩，葬敬陵"),
             c("nickname", 14, f"{T[6]}", "憲宗之第三子也", "Lê Thuần"),
             c("parents", 14, f"{T[6]}", "其母，莊順皇太后阮氏，諱環，天施平陵人也"),
             c("birth", 14, f"{T[6]}", "以洪德十九年，八月初一日而生帝", "âm 1488-8-1"),
             c("lifespan", 14, f"{T[6]}", "在位未期年，壽十七歲而崩，葬敬陵", "17"),
             c("death", 14, "năm Giáp Tý (1504)", "初七日癸亥，帝疾大漸，八日甲子，崩于皇極殿", "âm 1504-12-8"),
             c("burial_place", 14, f"{T[6]}", "在位未期年，壽十七歲而崩，葬敬陵", "Kính Lăng"),
             c("posthumous_name", 14, "năm Ất Sửu (1505)", "二月十六日甲戌，上大行皇帝尊諡曰昭義顯仁温恭淵黙惇孝允恭欽皇帝，廟號肅宗",
               "Chiêu Nghĩa Hiển Nhân Ôn Cung Uyên Mặc Đôn Hiếu Doãn Cung Khâm hoàng đế"),
             c("reign:0", 14, "năm Giáp Tý (1504)", "奉皇太子潦卽位，大赦，改元，以是年爲泰貞元年"),
             c("reign:0", 14, "năm Giáp Tý (1504)", "初七日癸亥，帝疾大漸，八日甲子，崩于皇極殿"),
             c("bio", 14, f"{T[6]}", "景統二年三月，立爲皇太子")])
G("lang.kinh-lang", "Kính Lăng", ["le.tuc-tong"],
  [c("existence", 14, f"{T[6]}", "在位未期年，壽十七歲而崩，葬敬陵"), c("occupant:0", 14, f"{T[6]}", "在位未期年，壽十七歲而崩，葬敬陵")],
  notes="Lăng Lê Túc Tông; Toàn thư chỉ ghi tên lăng.")

# ── 7. Uy Mục đế ───────────────────────────────────────────────────
P(key="le.uy-muc", full_name="Lê Uy Mục đế", gender="M", parents="u.hien-tong--nguyen-thi-can", nickname="Lê Tuấn; Lê Huyên",
  birth={"lunar_year": 1488, "lunar_month": 5, "lunar_day": 5}, death={"lunar_year": 1509, "lunar_month": 12, "lunar_day": 1}, lifespan=22,
  burial_place="An Lăng",
  reigns=reign(8, "Uy Mục đế", 1505, 1509, [("Đoan Khánh", 1505)]),
  bio="Con thứ hai của Lê Hiến Tông, tên húy Tuấn, lại có tên Huyên, sinh ngày 5 tháng 5 năm Mậu Thân (1488), là anh cùng cha khác mẹ của Túc Tông. Lên ngôi năm 1504 (niên hiệu Đoan Khánh từ năm Ất Sửu 1505). Toàn thư chép vua thích rượu, hay giết người, giết tông thất, hại bà nội, ngoại thích lộng hành, người đời gọi là 'quỷ vương'. Bị Giản Tu công (Tương Dực đế) đánh đuổi, ngày 1 tháng 12 năm Kỷ Tỵ (1509) uống thuốc độc tự tử, thọ 22 tuổi; được táng An Lăng, giáng làm Mẫn Lệ công.",
  citations=[c("existence", 14, f"{T[7]}", "諱濬，又諱諠，憲宗第二子，肅宗之庶兄也"),
             c("nickname", 14, f"{T[7]}", "諱濬，又諱諠，憲宗第二子", "Lê Tuấn; Lê Huyên"),
             c("parents", 14, f"{T[7]}", "其母，昭仁皇太后阮氏，諱瑾，東岸扶騐人也"),
             c("birth", 14, f"{T[7]}", "以洪德十九年，五月五日子時而生帝", "âm 1488-5-5"),
             c("lifespan", 14, f"{T[7]}", "在位五年，壽二十二歳，爲簡條公濴所逐，尋遇害，葬安陵", "22"),
             c("death", 14, "năm Kỷ Tỵ (1509)", "十二月初一日。帝飮鴆自盡", "âm 1509-12-1"),
             c("burial_place", 14, f"{T[7]}", "爲簡條公濴所逐，尋遇害，葬安陵", "An Lăng"),
             c("reign:0", 14, f"{T[7]}", "肅宗崩，無嗣，庶母敬妃阮氏於禁中定謀立之，遂卽皇帝位，大赦，改元"),
             c("reign:0", 14, "năm Kỷ Tỵ (1509)", "十二月初一日。帝飮鴆自盡"),
             c("bio", 14, f"{T[7]}", "帝嗜酒好殺，荒色立威，屠戮宗室，幽殺祖母，外戚縱横，百讓怒，時稱鬼王，亂徴見矣")])
G("lang.an-lang", "An Lăng", ["le.uy-muc"],
  [c("existence", 14, f"{T[7]}", "爲簡條公濴所逐，尋遇害，葬安陵"), c("occupant:0", 14, f"{T[7]}", "爲簡條公濴所逐，尋遇害，葬安陵"),
   c("location_name", 14, "năm Kỷ Tỵ (1509)", "止以餘燼回葬母鄕扶齡安陵，降爲愍厲公", "Phù Linh (quê mẹ)", note="Toàn thư ghi chôn tro ở quê mẹ là Phù Linh, tức An Lăng.")],
  location_name="Phù Linh (quê mẹ)", notes="Nơi chôn Uy Mục đế: xác bị đốt, chỉ lấy tro đem chôn ở quê mẹ (Phù Linh), gọi là An Lăng.")

# ── 8. Tương Dực đế ────────────────────────────────────────────────
P(key="le.kien-vuong", full_name="Kiến vương Lê Tân", gender="M", parents="u.thanh-tong--khuyet", titles=[{"title": "Kiến vương"}],
  bio="Con của Lê Thánh Tông (con trai thứ năm), phong Kiến vương, cha của Cẩm Giang vương Sùng và của Tương Dực đế. Sử chép ông là ông nội của Chiêu Tông và Cung Hoàng.",
  citations=[c("existence", 15, f"{T[8]}", "聖宗之孫，建王鑌之第二子也"), c("parents", 15, f"{T[8]}", "聖宗之孫，建王鑌之第二子也"),
             c("title:0", 15, f"{T[8]}", "建王鑌之第二子也"),
             c("bio", 15, f"{T[9]}", "聖宗之曾孫，建王鑌之嫡孫，錦江王漴之長子也")])
U("u.thanh-tong--khuyet", "le.thanh-tong")
P(key="le.kien-vuong.trinh-thi", full_name="Trịnh Thị Tuyên", gender="F", titles=[{"title": "Huy Từ Kiến hoàng thái hậu"}],
  bio="Vợ Kiến vương, mẹ Lê Tương Dực đế, con gái thứ tư của Đô đốc Trịnh Trọng Phong (người Lôi Dương). Con lên ngôi tôn là Huy Từ Kiến hoàng thái hậu.",
  citations=[c("existence", 15, f"{T[8]}", "其母徽慈建皇太后鄭氏，諱瑄"),
             c("title:0", 15, f"{T[8]}", "其母徽慈建皇太后鄭氏，諱瑄"),
             c("bio", 15, f"{T[8]}", "乃雷陽水注人，都督僉事兼左宗正仲峯之第四女也")])
U("u.kien-vuong--trinh-thi", "le.kien-vuong", "le.kien-vuong.trinh-thi", 1, [c("union", 15, f"{T[8]}", "聖宗之孫，建王鑌之第二子也")])
P(key="le.tuong-duc", full_name="Lê Tương Dực đế", gender="M", parents="u.kien-vuong--trinh-thi", nickname="Lê Oanh; Lê Huy",
  birth={"lunar_year": 1495, "lunar_month": 6, "lunar_day": 25}, death={"lunar_year": 1516}, lifespan=24,
  burial_place="Nguyên Lăng", titles=[{"title": "Giản Tu công"}, {"title": "Linh Ẩn vương (giáng phong sau khi mất)"}],
  reigns=reign(9, "Tương Dực đế", 1509, 1516, [("Hồng Thuận", 1509)]),
  bio="Cháu của Lê Thánh Tông, con thứ hai của Kiến vương Tân, tên húy Oanh, lại có tên Huy, sinh ngày 25 tháng 6 năm Ất Mão (1495), vốn là Giản Tu công. Khi Uy Mục giết tông thất, ông chạy vào Tây Đô, cuối năm Kỷ Tỵ (1509) dấy binh về Đông Kinh, lên ngôi, niên hiệu Hồng Thuận. Ở ngôi 8 năm; Toàn thư chép lúc đầu vua truyền giáo, thận hình, nhưng sau lười nhác, xây dựng đại điện tốn kém, dân mất nghiệp, giặc nổi lên. Quyền thần Trịnh Duy Sản giết ông ở cửa Thái Học năm Bính Tý (1516), thọ 24 tuổi, giáng làm Linh Ẩn vương, sau truy tôn Tương Dực đế, táng Nguyên Lăng.",
  citations=[c("existence", 15, f"{T[8]}", "諱瀠，又諱晭，聖宗之孫，建王鑌之第二子也"),
             c("nickname", 15, f"{T[8]}", "諱瀠，又諱晭，聖宗之孫，建王鑌之第二子也", "Lê Oanh; Lê Huy"),
             c("parents", 15, f"{T[8]}", "其母徽慈建皇太后鄭氏，諱瑄"),
             c("birth", 15, f"{T[8]}", "以洪德二十六年，六月二十五日生", "âm 1495-6-25"),
             c("lifespan", 15, f"{T[8]}", "在位八年，壽二十四，爲權臣鄭惟㦃所弑，葬元陵", "24"),
             c("death", 15, "năm Bính Tý (1516)", "鄭惟㦃弑帝于太學門", "âm 1516"),
             c("burial_place", 15, f"{T[8]}", "爲權臣鄭惟㦃所弑，葬元陵", "Nguyên Lăng"),
             c("title:0", 15, f"{T[8]}", "憲宗時封簡脩公") if False else c("title:0", 15, f"{T[8]}", "憲宗時封簡脩公，及威穆帝誅戮宗室"),
             c("title:1", 15, f"{T[8]}", "及遇害，鄭惟㦃降封爲靈隱王，後追尊襄翼帝"),
             c("reign:0", 14, "năm Kỷ Tỵ (1509)", "是月初四日，簡脩公卽皇帝位，大赦，改元，以是年爲洪順元年"),
             c("reign:0", 15, "năm Bính Tý (1516)", "鄭惟㦃弑帝于太學門"),
             c("bio", 15, f"{T[8]}", "帝卽位之初，敷敎愼罰，亦足以有爲也。然優游不斷，土木紛紜，小民失業，盗賊滋起")])
G("lang.nguyen-lang", "Nguyên Lăng", ["le.tuong-duc"],
  [c("existence", 15, f"{T[8]}", "爲權臣鄭惟㦃所弑，葬元陵"), c("occupant:0", 15, f"{T[8]}", "爲權臣鄭惟㦃所弑，葬元陵")],
  notes="Lăng Lê Tương Dực đế; Toàn thư chỉ ghi tên lăng.")
P(key="le.cam-giang", full_name="Cẩm Giang vương Lê Sùng", gender="M", parents="u.kien-vuong--khuyet", titles=[{"title": "Cẩm Giang vương"}],
  death={"lunar_year": 1509, "lunar_month": 11, "lunar_day": 23},
  bio="Con của Kiến vương Tân, anh của Giản Tu công (Tương Dực đế), cha của Lê Chiêu Tông và Lê Cung Hoàng. Bị Uy Mục giết cùng em là Tĩnh Lượng công và con rể năm Kỷ Tỵ (1509).",
  citations=[c("existence", 15, f"{T[9]}", "聖宗之曾孫，建王鑌之嫡孫，錦江王漴之長子也"),
             c("parents", 14, "năm Kỷ Tỵ (1509)", "濴兄錦江王漴"),
             c("death", 14, "năm Kỷ Tỵ (1509)", "二十三日，濴兄錦江王漴，幷弟靖亮公濴及涓與壽梅尉馬阮敬皆遇害", "âm 1509-11-23",
               note="Toàn thư không ghi tháng ngay trong câu này; ngày 23, tháng 11 là suy từ các câu liền trước — kiểm lại."),
             c("title:0", 15, f"{T[9]}", "錦江王漴之長子也"),
             c("bio", 15, f"{T[9]}", "聖宗之曾孫，建王鑌之嫡孫，錦江王漴之長子也")])
U("u.kien-vuong--khuyet", "le.kien-vuong")
P(key="le.cam-giang.trinh-thi", full_name="Trịnh Thị Loan", gender="F", titles=[{"title": "Hoàng thái hậu"}],
  bio="Vợ Cẩm Giang vương, mẹ Lê Chiêu Tông và Lê Cung Hoàng, người Thanh Chương, Phi Cảo. Năm Quý Mùi (1527) cùng con là Cung Hoàng bị Mạc Đăng Dung ép giết.",
  citations=[c("existence", 15, f"{T[9]}", "其母皇后鄭氏鸞，乃淸漳丕杲人也"),
             c("title:0", 15, "năm Đinh Hợi (1527)", "降封帝爲恭王，與皇太后鄭氏幽于西内宮"),
             c("bio", 15, f"{T[10]}", "逮登庸篡位，廢爲恭王，與皇太后俱遇害")])
U("u.cam-giang--trinh-thi", "le.cam-giang", "le.cam-giang.trinh-thi", 1, [c("union", 15, f"{T[9]}", "其母皇后鄭氏鸞，乃淸漳丕杲人也")])

# ── 9. Chiêu Tông ──────────────────────────────────────────────────
P(key="le.chieu-tong", full_name="Lê Chiêu Tông", gender="M", parents="u.cam-giang--trinh-thi", nickname="Lê Y; Lê Huệ",
  birth={"lunar_year": 1506, "lunar_month": 10, "lunar_day": 4}, death={"lunar_year": 1526}, lifespan=26,
  burial_place="Vĩnh Hưng Lăng", titles=[{"title": "Đà Dương vương (bị Mạc phế)"}],
  posthumous_name="Thần hoàng đế",
  reigns=reign(10, "Chiêu Tông", 1516, 1522, [("Quang Thiệu", 1516)]),
  bio="Chắt của Lê Thánh Tông, cháu nội Kiến vương Tân, con trưởng Cẩm Giang vương Sùng, tên húy Y, lại có tên Huệ, sinh ngày 4 tháng 10 năm Bính Dần (1506). Tương Dực đế bị giết (1516), ông được các đại thần đón lập ở Tây Đô, rồi về kinh, niên hiệu Quang Thiệu. Triều chính nằm trong tay người khác, vua nghe nịnh, săn bắn; năm 1522 chạy khỏi kinh, Mạc Đăng Dung lập em là Cung Hoàng và giáng ông làm Đà Dương vương. Năm Thống Nguyên thứ 5 (1526) bị Mạc Đăng Dung giết, thọ 26 tuổi, sau truy tôn Thần hoàng đế, miếu hiệu Chiêu Tông, táng Vĩnh Hưng Lăng.",
  citations=[c("existence", 15, f"{T[9]}", "諱椅，又諱譓，聖宗之曾孫，建王鑌之嫡孫，錦江王漴之長子也"),
             c("nickname", 15, f"{T[9]}", "諱椅，又諱譓，聖宗之曾孫，建王鑌之嫡孫", "Lê Y; Lê Huệ"),
             c("parents", 15, f"{T[9]}", "其母皇后鄭氏鸞，乃淸漳丕杲人也"),
             c("birth", 15, f"{T[9]}", "以端慶二年十月初四日生", "âm 1506-10-4"),
             c("lifespan", 15, f"{T[9]}", "在位七年，爲莫登庸所弒，壽二十六，葬永興陵", "26"),
             c("death", 15, f"{T[9]}", "統元五年爲登庸所弒，後追上尊謚爲神皇帝，廟號昭宗", "âm 1526"),
             c("burial_place", 15, f"{T[9]}", "爲莫登庸所弒，壽二十六，葬永興陵", "Vĩnh Hưng Lăng"),
             c("posthumous_name", 15, f"{T[9]}", "後追上尊謚爲神皇帝，廟號昭宗", "Thần hoàng đế"),
             c("title:0", 15, f"{T[9]}", "莫登庸立弟椿卽位，降帝爲陀陽王"),
             c("reign:0", 15, f"{T[9]}", "遂卽皇帝位，改元光紹，以誕日爲儀天聖節"),
             c("reign:0", 15, f"{T[9]}", "七年而幸外，莫登庸立弟椿卽位，降帝爲陀陽王"),
             c("bio", 15, f"{T[9]}", "昏暗不明，剛愎自用，其亡也宜哉")])
G("lang.vinh-hung-lang", "Vĩnh Hưng Lăng", ["le.chieu-tong"],
  [c("existence", 15, f"{T[9]}", "爲莫登庸所弒，壽二十六，葬永興陵"), c("occupant:0", 15, f"{T[9]}", "爲莫登庸所弒，壽二十六，葬永興陵")],
  notes="Lăng Lê Chiêu Tông; Toàn thư chỉ ghi tên lăng.")

# ── 10. Cung Hoàng ─────────────────────────────────────────────────
P(key="le.cung-hoang", full_name="Lê Cung Hoàng", gender="M", parents="u.cam-giang--trinh-thi", nickname="Lê Xuân; Lê Khoáng",
  birth={"lunar_year": 1507, "lunar_month": 7, "lunar_day": 26}, death={"lunar_year": 1527}, lifespan=21,
  burial_place="Hoa Dương Lăng", titles=[{"title": "Cung vương (bị Mạc phế)"}],
  reigns=reign(11, "Cung Hoàng", 1522, 1527, [("Thống Nguyên", 1522)]),
  bio="Em cùng mẹ của Lê Chiêu Tông, tên húy Xuân, lại có tên Khoáng, sinh ngày 26 tháng 7 năm Đinh Mão (1507). Mạc Đăng Dung lập ông làm vua khi Chiêu Tông chạy khỏi kinh, niên hiệu Thống Nguyên (1522). Quyền hành ở cả tay Mạc Đăng Dung; năm Đinh Hợi (1527) Mạc Đăng Dung cướp ngôi, giáng ông làm Cung vương, rồi cùng mẹ bị giết, thọ 21 tuổi, sau truy thụy Cung hoàng đế, táng Hoa Dương Lăng.",
  citations=[c("existence", 15, f"{T[10]}", "諱椿，又諱懬，聖宗之曾孫，建王鑌之孫，錦江王漴之次子也"),
             c("nickname", 15, f"{T[10]}", "諱椿，又諱懬，聖宗之曾孫，建王鑌之孫", "Lê Xuân; Lê Khoáng"),
             c("parents", 15, f"{T[10]}", "帝乃昭宗同母弟，以端慶三年七月二十六日生"),
             c("birth", 15, f"{T[10]}", "以端慶三年七月二十六日生", "âm 1507-7-26"),
             c("lifespan", 15, f"{T[10]}", "在位五年，壽二十一，爲莫登庸所弑，葬華陽陵", "21"),
             c("death", 15, f"{T[10]}", "逮登庸篡位，廢爲恭王，與皇太后俱遇害，後追謚曰恭皇帝", "âm 1527"),
             c("burial_place", 15, f"{T[10]}", "爲莫登庸所弑，葬華陽陵", "Hoa Dương Lăng"),
             c("title:0", 15, "năm Đinh Hợi (1527)", "降封帝爲恭王，與皇太后鄭氏幽于西内宮"),
             c("reign:0", 15, f"{T[10]}", "光紹七年昭宗出外，莫登庸因立爲帝"),
             c("reign:0", 15, "năm Đinh Hợi (1527)", "降封帝爲恭王，與皇太后鄭氏幽于西内宮"),
             c("bio", 15, f"{T[10]}", "逮登庸篡位，廢爲恭王，與皇太后俱遇害，後追謚曰恭皇帝")])
G("lang.hoa-duong-lang", "Hoa Dương Lăng", ["le.cung-hoang"],
  [c("existence", 15, f"{T[10]}", "爲莫登庸所弑，葬華陽陵"), c("occupant:0", 15, f"{T[10]}", "爲莫登庸所弑，葬華陽陵")],
  notes="Lăng Lê Cung Hoàng; Toàn thư chỉ ghi tên lăng.")

# ── Di sản ─────────────────────────────────────────────────────────
H("ds.khoi-nghia-lam-son", "story", "Khởi nghĩa Lam Sơn (1418)",
  "Ngày canh thân tháng giêng năm Mậu Tuất (1418), Lê Lợi khởi binh ở Lam Sơn, sau mười năm dẹp quân Minh.",
  "Mùa xuân tháng giêng năm Mậu Tuất (Minh Vĩnh Lạc 16, 1418), Lê Lợi khởi binh ở Lam Sơn. Trước đó quân Minh nhiều lần trao chức quan để dụ ông, ông không khuất phục, khảng khái có chí dẹp loạn, nói rằng 'trượng phu sinh ở đời phải cứu nạn lớn, lập công lớn, tiếng thơm nghìn năm, sao lại tầm thường làm người sai khiến'. Ông dẫn hào kiệt dựng cờ nghĩa, định diệt giặc Minh. Toàn thư chép ông dùng binh biết lấy mềm thắng cứng, lấy yếu thắng mạnh; các thành Nghệ An, Thuận Hóa, Tây Đô, Đông Đô đều do Nguyễn Trãi viết thư dụ mà hạ, không đánh mà hàng. Sau mười năm, ông dẹp xong loạn lớn, dựng nên đế nghiệp.",
  [("le.thai-to", "khởi binh")],
  [c("existence", 10, "năm Mậu Tuất (1418)", "戊戌明永樂十六年春正月庚申，帝起兵於藍山"),
   c("body", 10, "năm Mậu Tuất (1418)", "遂率豪傑建義旗，期滅明賊"),
   c("body", 10, f"{T[1]}", "經營天下凡十年間，克平大亂而成帝業"),
   c("person:0", 10, "năm Mậu Tuất (1418)", "帝起兵於藍山"),
   c("location_name", 10, "năm Mậu Tuất (1418)", "戊戌明永樂十六年春正月庚申，帝起兵於藍山", "Lam Sơn, Thanh Hóa", note="Lam Sơn nay thuộc Thanh Hóa.")],
  "Lam Sơn, Thanh Hóa")
H("ds.hoi-the-dong-quan", "story", "Hội thề Đông Quan (1427)",
  "Cuối năm Đinh Mùi (1427), Vương Thông cùng các tướng Minh thề ở phía nam thành, hẹn ngày 12 tháng 12 rút quân.",
  "Cuối năm Đinh Mùi (1427), quân Minh trong thành Đông Quan bị vây khốn, trông cậy vào viện binh nhưng đã bị ta đánh bại, nên xin hòa. Vương Thông cùng các tướng như Trần Tuấn, Trần Hữu và quan lại Minh thề ở phía nam thành, hẹn ngày 12 tháng 12 rút quân và để lại người đem tờ biểu xin trả đất cho ta giữ. Lê Lợi cho thả hơn mười vạn tù binh, mở đường lui cho quân Minh.",
  [("le.thai-to", "chủ trì hội thề")],
  [c("existence", 10, "năm Đinh Mùi (1427)", "會盟于城之南。期以十二月十二日班師，仍差人賫本，請還我土守"),
   c("body", 10, "năm Đinh Mùi (1427)", "時通等在城困迫，所恃者援兵，又爲我所敗，故講和乞㱕"),
   c("person:0", 10, "năm Đinh Mùi (1427)", "期以十二月十二日班師，仍差人賫本"),
   c("location_name", 10, "năm Đinh Mùi (1427)", "會盟于城之南", "Đông Quan (Hà Nội)", note="Đông Quan là thành Thăng Long thời Minh thuộc.")],
  "Đông Quan (Hà Nội)")
H("ds.lam-kinh", "place", "Lam Kinh (Lam Sơn)",
  "Quê hương và nơi phụng thờ của vua Lê: Lê Thái Tổ về Lam Kinh, các vua Lê sơ táng ở đây.",
  "Lam Kinh (Tây Kinh) là kinh đô thứ hai của nhà Lê sơ, nơi quê cũ Lam Sơn của Lê Lợi, nay ở Thanh Hóa. Toàn thư chép năm Quý Sửu (1433) Lê Thái Tổ 'về Lam Kinh' rồi mất; lăng của ông (Vĩnh Lăng) ở Lam Sơn, Hựu Lăng của Lê Thái Tông ở bên trái. Cả quần thể lăng miếu này sau thành di tích Lam Kinh.",
  [("le.thai-to", "mất và táng ở Lam Kinh"), ("le.thai-tong", "táng bên trái Vĩnh Lăng")],
  [c("existence", 10, "năm Quý Sửu (1433)", "帝回藍京。閏八月，彗星出西方"),
   c("body", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵"),
   c("person:0", 10, "năm Quý Sửu (1433)", "帝回藍京。閏八月，彗星出西方"),
   c("person:1", 11, "năm Nhâm Tuất (1442)", "塟大行皇帝于藍山永陵之左，曰祐陵"),
   c("location_name", 10, "năm Quý Sửu (1433)", "帝回藍京", "Lam Sơn, Thanh Hóa", note="Lam Sơn nay thuộc Thanh Hóa.")],
  "Lam Sơn, Thanh Hóa")
H("ds.bia-tien-si", "artifact", "Bia Tiến sĩ (Văn Miếu – Quốc Tử Giám)",
  "Các khoa thi tiến sĩ đời Lê sơ được dựng bia đề danh; Toàn thư ghi nhiều lần dựng bia, như khoa Đinh Mùi (1487), Canh Tuất (1490), Quý Sửu (1493), Bính Thìn (1496).",
  "Dưới triều Lê Thánh Tông, mỗi khoa thi tiến sĩ đều dựng bia đề danh: ngày 15 tháng 8 năm Đinh Mùi (1487) dựng bia khoa Hồng Đức 18, ngày 15 tháng 8 năm Canh Tuất (1490) dựng bia khoa Hồng Đức 21, ngày 19 tháng 8 năm Quý Sửu (1493) dựng bia khoa Quý Sửu, ngày 6 tháng 12 năm Bính Thìn (1496) dựng bia khoa Hồng Đức 27. Các bia này là nền của dãy bia tiến sĩ ở Văn Miếu – Quốc Tử Giám (Hà Nội), được UNESCO ghi vào Di sản tư liệu thế giới năm 2011.",
  [("le.thanh-tong", "cho dựng bia")],
  [c("existence", 13, "năm Đinh Mùi (1487)", "八月十五日，立洪德十八年丁未科進士題名碑"),
   c("body", 13, "năm Canh Tuất (1490)", "八月十五日，立洪德二十I年庚戌科進士題名碑".replace("I", "I")),
   c("body", 13, "năm Quý Sửu (1493)", "秋，八月十九日，立癸丑科進士題名碑"),
   c("body", 13, "năm Bính Thìn (1496)", "十二月初六日，立洪德二十七年丙辰科進士題名碑"),
   c("person:0", 13, "năm Đinh Mùi (1487)", "八月十五日，立洪德十八年丁未科進士題名碑"),
   c("location_name", 13, "năm Đinh Mùi (1487)", "八月十五日，立洪德十八年丁未科進士題名碑", "Văn Miếu – Quốc Tử Giám, Hà Nội", note="Toàn thư không ghi nơi dựng; vị trí hiện nay của dãy bia.")],
  "Văn Miếu – Quốc Tử Giám, Hà Nội",
  [pexels(38127389, "ancient-gate-at-the-temple-of-literature-hanoi", "valeria-drozdova-2148646707", "Cổng Văn Miếu, Hà Nội (ảnh Pexels)")])

data = {
    "clan": {"key": "le", "name": "Nhà Hậu Lê — Lê sơ (1428–1527)", "category": "royal",
             "description": "Nhà Hậu Lê do Lê Lợi (Thái Tổ) lập sau mười năm khởi nghĩa Lam Sơn đánh đuổi quân Minh (1418–1427), lên ngôi năm 1428. Gia phả này chép giai đoạn Lê sơ: từ ông tổ ba đời của Lê Thái Tổ đến Lê Cung Hoàng (1527), khi Mạc Đăng Dung cướp ngôi. Giai đoạn Lê trung hưng (từ 1533) sẽ chép sau. Theo Đại Việt sử ký toàn thư; mỗi dữ kiện đều có nguyên văn trích dẫn, xem dòng \"Theo:\" cuối tiểu sử."},
    "persons": persons, "unions": unions, "resting_places": graves, "heritage": heritage, "events": [], "same_person_links": links,
}
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(persons)} người, {len(unions)} hôn nhân, {len(graves)} lăng, {len(heritage)} di sản")

import os, subprocess
subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "normalize_bio.py"), OUT], check=True)
