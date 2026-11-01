"""Sinh data/historical/ly.json — gia phả nhà Lý (1009–1225), bản NHÁP.

  python3 -I scripts/historical/gen_ly.py data/historical/ly.json
  python3 -I scripts/historical/verify_quotes.py data/historical/ly.json <thư mục nguồn>

Nguồn: Đại Việt sử ký toàn thư (TT) Bản kỷ Q.2–4 (Lý kỷ) và Q.5 (Trần kỷ, cho cái chết của Huệ Tông / Chiêu Hoàng),
nguyên văn chữ Hán trên zh.wikisource. Tải vào một thư mục riêng (tt/q_二.txt … q_五.txt), cách tải ở verify_quotes.py.
Cùng khuôn với gen_tran.py. Khi đã duyệt (review.status) thì sửa thẳng ly.json — chạy lại script sẽ ghi đè.
"""
import json
import sys

OUT = sys.argv[1]
DRAFT = {"status": "draft", "note": "Khung P1 — trích từ nguyên văn Toàn thư; cần người duyệt đối chiếu bản dịch + Cương mục."}
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
    g = {"key": key, "name": name, "occupants": occupants, "citations": cites, "review": DRAFT}
    if location_name:
        g["location_name"] = location_name
    if notes:
        g["notes"] = notes
    graves.append(g)


def pexels(photo_id, slug, author, caption, w=960):
    return {"url": f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w={w}",
            "source_page": f"https://www.pexels.com/photo/{slug}-{photo_id}/", "author": author, "license": "Pexels License",
            "kind": "photograph", "caption": caption}


def H(key, category, title, summary, body, people, cites, loc=None, photos=None):
    h = {"key": key, "category": category, "title": title, "summary": summary, "body": body,
         "people": [{"person": k, "role_note": r} for k, r in people], "citations": cites, "review": DRAFT}
    if loc:
        h["location_name"] = loc
    if photos:
        h["photos"] = photos
    heritage.append(h)


def reign(n, temple, start, end, eras):
    return [{"dynasty": "Lý", "ordinal": n, "role": "emperor", "temple_name": temple, "start_year": start, "end_year": end,
             "era_names": [{"name": e, "from_year": y} for e, y in eras]}]


TD = "tiểu dẫn"
T1, T2, T3, T4 = "Lý kỷ, Thái Tổ hoàng đế", "Lý kỷ, Thái Tông hoàng đế", "Lý kỷ, Thánh Tông hoàng đế", "Lý kỷ, Nhân Tông hoàng đế"
T5, T6, T7, T8, T9 = ("Lý kỷ, Thần Tông hoàng đế", "Lý kỷ, Anh Tông hoàng đế", "Lý kỷ, Cao Tông hoàng đế",
                      "Lý kỷ, Huệ Tông hoàng đế", "Lý kỷ, Chiêu Hoàng")

# ── 1. Thái Tổ ─────────────────────────────────────────────────────
P(key="ly.thai-to", full_name="Lý Thái Tổ", gender="M", is_root=True, nickname="Lý Công Uẩn",
  birth={"lunar_year": 974, "lunar_month": 2, "lunar_day": 12}, death={"lunar_year": 1028, "lunar_month": 3}, lifespan=55,
  burial_place="Thọ Lăng, phủ Thiên Đức", posthumous_name="Thần Vũ hoàng đế",
  reigns=reign(1, "Thái Tổ", 1009, 1028, [("Thuận Thiên", 1010)]),
  bio="Vua đầu triều Lý, tên húy Công Uẩn, người châu Cổ Pháp (Bắc Giang). Mẹ họ Phạm, đi chơi chùa núi Tiêu, giao với thần nhân mà có thai; ba tuổi được bà gửi cho Lý Khánh Văn nuôi làm con. Làm quan nhà Lê đến chức Điện tiền chỉ huy sứ; khi Lê Long Đĩnh mất thì tự lên ngôi, dời đô về thành Đại La, đổi tên là Thăng Long. Ở ngôi 18 năm, thọ 55 tuổi, mất ngày Mậu Tuất tháng ba năm Mậu Thìn (1028) ở điện Long An, táng Thọ Lăng, thụy Thần Vũ hoàng đế, miếu hiệu Thái Tổ.",
  citations=[c("existence", 2, f"{T1} — {TD}", "姓李，諱公藴，北江古法州人也"),
             c("nickname", 2, f"{T1} — {TD}", "姓李，諱公藴", "Lý Công Uẩn"),
             c("birth", 2, f"{T1} — {TD}", "以丁太平五年甲戌二月十二日誕生", "âm 974-2-12"),
             c("lifespan", 2, f"{T1} — {TD}", "在位十八年，壽五十五", "55"),
             c("death", 2, "năm Mậu Thìn (1028)", "戊戌，帝崩于龍安殿", "âm 1028-3",
               note="Toàn thư ghi ngày Mậu Tuất tháng 3 (mùng 3); chỉ lấy tháng."),
             c("burial_place", 2, "năm Mậu Thìn (1028)", "冬十月，塟天德府壽陵", "Thọ Lăng, phủ Thiên Đức"),
             c("posthumous_name", 2, "năm Mậu Thìn (1028)", "塟天德府壽陵，謚曰神武皇帝，廟號太祖", "Thần Vũ hoàng đế"),
             c("reign:0", 2, f"{T1} — {TD}", "及卧朝崩，遂即帝位，改元順天，大赦"),
             c("reign:0", 2, f"{T1} — {TD}", "自立為帝，都昇龍城，在位十八年"),
             c("bio", 2, f"{T1} — {TD}", "其母范氏，逍遙遊焦山寺，與神人交，因而有娠"),
             c("bio", 2, f"{T1} — {TD}", "其母懷抱至李慶文家。慶文遂養以為子")])
P(key="ly.thai-to.le-hau", full_name="Hoàng hậu Lê thị", gender="F",
  bio="Vợ Lý Thái Tổ, mẹ Lý Thái Tông.",
  citations=[c("existence", 2, f"{T2} — {TD}", "其母皇后黎氏"), c("bio", 2, f"{T2} — {TD}", "其母皇后黎氏")])
U("u.thai-to--le-hau", "ly.thai-to", "ly.thai-to.le-hau", 1, [c("union", 2, f"{T2} — {TD}", "其母皇后黎氏")])
G("lang.tho-lang", "Thọ Lăng", ["ly.thai-to"],
  [c("existence", 2, "năm Mậu Thìn (1028)", "塟天德府壽陵"),
   c("location_name", 2, "năm Mậu Thìn (1028)", "塟天德府壽陵", "phủ Thiên Đức"),
   c("occupant:0", 2, "năm Mậu Thìn (1028)", "冬十月，塟天德府壽陵"),
   c("notes", 2, "năm Mậu Thìn (1028)", "冬十月，塟天德府壽陵，謚曰神武皇帝，廟號太祖")],
  location_name="phủ Thiên Đức", notes="Lăng Lý Thái Tổ. Lê Văn Hưu chê các lăng nhà Lý đều chỉ gọi chung là 'Thọ Lăng'.")

# ── 2. Thái Tông ───────────────────────────────────────────────────
P(key="ly.thai-tong", full_name="Lý Thái Tông", gender="M", parents="u.thai-to--le-hau", nickname="Lý Phật Mã; Đức Chính",
  birth={"lunar_year": 1000, "lunar_month": 6, "lunar_day": 26}, death={"lunar_year": 1054, "lunar_month": 10, "lunar_day": 1}, lifespan=55,
  reigns=reign(2, "Thái Tông", 1028, 1054, [("Thiên Thành", 1028), ("Thông Thụy", 1034), ("Càn Phù Hữu Đạo", 1039),
                                          ("Minh Đạo", 1042), ("Thiên Cảm Thánh Vũ", 1044), ("Sùng Hưng Đại Bảo", 1049)]),
  bio="Con trưởng của Lý Thái Tổ, tên húy Phật Mã, một tên là Đức Chính, sinh ngày 26 tháng 6 năm Canh Tý (1000) ở phủ Trường An. Được lập làm thái tử khi cha lên ngôi; cha mất, ông dẹp loạn ba vương rồi lên ngôi. Ở ngôi 27 năm, thọ 55 tuổi, mất ngày 1 tháng 10 năm Giáp Ngọ (1054) ở điện Trường Xuân.",
  citations=[c("existence", 2, f"{T2} — {TD}", "諱佛瑪，一名德政，太祖長子也"),
             c("nickname", 2, f"{T2} — {TD}", "諱佛瑪，一名德政", "Lý Phật Mã; Đức Chính"),
             c("parents", 2, f"{T2} — {TD}", "太祖長子也。其母皇后黎氏"),
             c("birth", 2, f"{T2} — {TD}", "其母皇后黎氏，以黎應天七年庚子六月二十六日", "âm 1000-6-26"),
             c("lifespan", 2, f"{T2} — {TD}", "在位二十七年，壽五十五歲，崩于長春殿", "55"),
             c("death", 2, "năm Giáp Ngọ (1054)", "冬十月一日，帝崩于長春殿", "âm 1054-10-1"),
             c("reign:0", 2, f"{T2} — {TD}", "及太祖崩，賴奉曉之志勇，同心濟難，遂即皇帝位"),
             c("reign:0", 2, "năm Giáp Ngọ (1054)", "冬十月一日，帝崩于長春殿"),
             c("bio", 2, f"{T2} — {TD}", "太祖受禅，立為東宫太子")])
P(key="ly.thai-tong.mai-thi", full_name="Kim Thiên hoàng thái hậu Mai thị", gender="F",
  titles=[{"title": "Kim Thiên hoàng thái hậu"}],
  bio="Vợ Lý Thái Tông, mẹ Lý Thánh Tông. Khi con lên ngôi được tôn là Kim Thiên hoàng thái hậu; trước khi sinh con, bà mơ thấy mặt trăng vào lòng.",
  citations=[c("existence", 3, f"{T3} — {TD}", "其母金天太后枚氏"),
             c("title:0", 2, "năm Giáp Ngọ (1054)", "母枚氏為金天皇太后"),
             c("bio", 3, f"{T3} — {TD}", "初夢月入懷，因有娠")])
U("u.thai-tong--mai-thi", "ly.thai-tong", "ly.thai-tong.mai-thi", 1, [c("union", 3, f"{T3} — {TD}", "太宗長子也。其母金天太后枚氏")])

# ── 3. Thánh Tông ──────────────────────────────────────────────────
P(key="ly.thanh-tong", full_name="Lý Thánh Tông", gender="M", parents="u.thai-tong--mai-thi", nickname="Lý Nhật Tôn",
  birth={"lunar_year": 1023, "lunar_month": 2, "lunar_day": 25}, death={"lunar_year": 1072, "lunar_month": 1}, lifespan=50,
  posthumous_name="Ứng Thiên Sùng Nhân Chí Đạo Uy Khánh Long Tường Minh Văn Duệ Vũ Hiếu Đức Thánh Thần hoàng đế",
  reigns=reign(3, "Thánh Tông", 1054, 1072, [("Long Thụy Thái Bình", 1054), ("Chương Thánh Gia Khánh", 1059), ("Long Chương Thiên Tự", 1066),
                                           ("Thiên Huống Bảo Tượng", 1068), ("Thần Vũ", 1069)]),
  bio="Con trưởng của Lý Thái Tông, tên húy Nhật Tôn, sinh ngày 25 tháng 2 năm Quý Hợi (1023) ở cung Long Đức, lập thái tử năm 1028. Nối ngôi năm 1054, đổi quốc hiệu là Đại Việt. Ở ngôi 17 năm, thọ 50 tuổi, mất tháng giêng năm Nhâm Tý (1072) ở điện Hội Tiên, miếu hiệu Thánh Tông.",
  citations=[c("existence", 3, f"{T3} — {TD}", "諱日尊，太宗長子也"),
             c("nickname", 3, f"{T3} — {TD}", "諱日尊，太宗長子也", "Lý Nhật Tôn"),
             c("parents", 3, f"{T3} — {TD}", "太宗長子也。其母金天太后枚氏"),
             c("birth", 3, f"{T3} — {TD}", "以順天十四年癸亥二月二十五日生", "âm 1023-2-25"),
             c("lifespan", 3, f"{T3} — {TD}", "在位十七年，壽五十歲，崩于會僊殿", "50"),
             c("death", 3, "năm Nhâm Tý (1072)", "春正月庚寅，帝崩于會僊殿", "âm 1072-1"),
             c("posthumous_name", 3, "năm Nhâm Tý (1072)", "上尊號曰應天崇仁至道威慶龍祥明文睿武孝德聖神皇帝，廟號聖宗",
               "Ứng Thiên Sùng Nhân Chí Đạo Uy Khánh Long Tường Minh Văn Duệ Vũ Hiếu Đức Thánh Thần hoàng đế"),
             c("reign:0", 3, f"{T3} — {TD}", "太宗崩，遂登太寳。在位十七年"),
             c("bio", 3, f"{T3} — {TD}", "天成元年，冊爲東宫太子")])
P(key="ly.thanh-tong.linh-nhan", full_name="Linh Nhân hoàng thái hậu", gender="F", nickname="Ỷ Lan",
  titles=[{"title": "Linh Nhân hoàng thái hậu", "from_year": 1073}],
  bio="Vợ Lý Thánh Tông, mẹ Lý Nhân Tông. Được phong Ỷ Lan phu nhân, sinh hoàng tử Càn Đức (Nhân Tông). Khi con lên ngôi (1072), tôn làm Linh Nhân hoàng thái hậu (1073).",
  citations=[c("existence", 3, f"{T4} — {TD}", "其母灵仁太后"),
             c("nickname", 3, "năm Quý Mão (1063)", "其後倚蘭夫人有娠，生皇子乾德，是爲仁宗", "Ỷ Lan"),
             c("title:0", 3, "năm Quý Sửu (1073)", "尊皇太妃爲靈仁皇太后"),
             c("bio", 3, "năm Quý Mão (1063)", "其後倚蘭夫人有娠，生皇子乾德，是爲仁宗")])
U("u.thanh-tong--linh-nhan", "ly.thanh-tong", "ly.thanh-tong.linh-nhan", 1, [c("union", 3, f"{T4} — {TD}", "聖宗長子也。其母灵仁太后")])

# ── 4. Nhân Tông ───────────────────────────────────────────────────
P(key="ly.nhan-tong", full_name="Lý Nhân Tông", gender="M", parents="u.thanh-tong--linh-nhan", nickname="Lý Càn Đức",
  birth={"lunar_year": 1066, "lunar_month": 1, "lunar_day": 25}, death={"lunar_year": 1127}, lifespan=63,
  burial_place="Thiên Đức lăng", posthumous_name="Hiếu Từ Thánh Thần Văn Vũ hoàng đế",
  reigns=reign(4, "Nhân Tông", 1072, 1127, [("Thái Ninh", 1072), ("Anh Vũ Chiêu Thắng", 1076), ("Quảng Hựu", 1085), ("Hội Phong", 1092),
                                          ("Long Phù", 1101), ("Hội Tường Đại Khánh", 1110), ("Thiên Phù Duệ Vũ", 1120), ("Thiên Phù Khánh Thọ", 1127)]),
  bio="Con trưởng của Lý Thánh Tông, tên húy Càn Đức, sinh ngày 25 tháng giêng năm Bính Ngọ (1066), lên ngôi năm 1072 khi còn nhỏ. Ở ngôi 56 năm, được Toàn thư gọi là vua thịnh của nhà Lý; mất năm Đinh Mùi (1127) ở điện Vĩnh Quang, thọ 63 tuổi, táng Thiên Đức lăng, thụy Hiếu Từ Thánh Thần Văn Vũ hoàng đế, miếu hiệu Nhân Tông. Không có con trai, truyền ngôi cho cháu là Thần Tông.",
  citations=[c("existence", 3, f"{T4} — {TD}", "諱乾德，聖宗長子也"),
             c("nickname", 3, f"{T4} — {TD}", "諱乾德，聖宗長子也", "Lý Càn Đức"),
             c("parents", 3, f"{T4} — {TD}", "聖宗長子也。其母灵仁太后"),
             c("birth", 3, f"{T4} — {TD}", "其母灵仁太后，以龍章天嗣元年丙午正月二十五日誕生", "âm 1066-1-25"),
             c("lifespan", 3, f"{T4} — {TD}", "在位五十六年，壽六十三歲，崩于永光殿", "63",
               note="Tuổi thọ 63 lệch với năm sinh 1066 và năm mất 1127 (sử tính tuổi mụ) — kiểm lại."),
             c("death", 3, "năm Đinh Mùi (1127)", "丁卯，帝崩于永光殿", "âm 1127"),
             c("burial_place", 3, "năm Mậu Thân (1128)", "塟天德陵", "Thiên Đức lăng"),
             c("posthumous_name", 3, "năm Mậu Thân (1128)", "戊子，尊大行皇帝謚曰孝慈聖神文武皇帝，廟號仁宗", "Hiếu Từ Thánh Thần Văn Vũ hoàng đế"),
             c("reign:0", 3, f"{T4} — {TD}", "聖宗崩，遂即皇帝位，在位五十六年"),
             c("bio", 3, f"{T4} — {TD}", "後日立爲皇太子")])
G("lang.thien-duc", "Thiên Đức lăng", ["ly.nhan-tong"],
  [c("existence", 3, "năm Mậu Thân (1128)", "塟天德陵"), c("occupant:0", 3, "năm Mậu Thân (1128)", "塟天德陵"),
   c("notes", 3, "năm Mậu Thân (1128)", "欲行送塟仁宗禮也")],
  notes="Nơi an táng Lý Nhân Tông (Thần Tông lo việc đưa tang tháng 6 năm Mậu Thân).")

# ── 5. Thần Tông ───────────────────────────────────────────────────
P(key="ly.thanh-tong.sung-hien", full_name="Sùng Hiền hầu", gender="M", parents="u.thanh-tong--khuyet",
  titles=[{"title": "Sùng Hiền hầu"}],
  bio="Con của Lý Thánh Tông, em của Nhân Tông, cha của Lý Thần Tông. Sử không chép tên húy.",
  citations=[c("existence", 3, f"{T5} — {TD}", "聖宗之孫，仁宗之姪，崇賢候之子"),
             c("parents", 3, f"{T5} — {TD}", "聖宗之孫，仁宗之姪，崇賢候之子"),
             c("title:0", 3, f"{T5} — {TD}", "崇賢候之子"),
             c("bio", 3, "năm Bính Thân (1116)", "先是，崇賢侯夫人杜氏懷娠，至是產難")])
U("u.thanh-tong--khuyet", "ly.thanh-tong")
P(key="ly.thanh-tong.sung-hien.do-thi", full_name="Phu nhân Đỗ thị", gender="F",
  bio="Vợ Sùng Hiền hầu, mẹ Lý Thần Tông.",
  citations=[c("existence", 3, f"{T5} — {TD}", "乃夫人杜氏所生也"), c("bio", 3, f"{T5} — {TD}", "乃夫人杜氏所生也")])
U("u.sung-hien--do-thi", "ly.thanh-tong.sung-hien", "ly.thanh-tong.sung-hien.do-thi", 1, [c("union", 3, f"{T5} — {TD}", "乃夫人杜氏所生也")])
P(key="ly.than-tong", full_name="Lý Thần Tông", gender="M", parents="u.sung-hien--do-thi", nickname="Lý Dương Hoán",
  birth={"lunar_year": 1116}, death={"lunar_year": 1138}, lifespan=23, posthumous_name="Quảng Nhân Sùng Hiếu Văn Vũ hoàng đế",
  reigns=reign(5, "Thần Tông", 1128, 1138, [("Thiên Thuận", 1128), ("Thiên Chương Bảo Tự", 1133)]),
  bio="Cháu của Lý Thánh Tông, cháu gọi Nhân Tông bằng chú, con Sùng Hiền hầu và phu nhân Đỗ thị, tên húy Dương Hoán. Hai tuổi được nuôi trong cung, lập làm thái tử; Nhân Tông mất thì lên ngôi (1128). Ở ngôi 11 năm, mất năm Mậu Ngọ (1138) ở điện Vĩnh Quang, thọ 23 tuổi, thụy Quảng Nhân Sùng Hiếu Văn Vũ hoàng đế, miếu hiệu Thần Tông.",
  citations=[c("existence", 3, f"{T5} — {TD}", "諱陽煥，聖宗之孫，仁宗之姪，崇賢候之子"),
             c("nickname", 3, f"{T5} — {TD}", "諱陽煥，聖宗之孫", "Lý Dương Hoán"),
             c("parents", 3, f"{T5} — {TD}", "崇賢候之子，乃夫人杜氏所生也"),
             c("birth", 3, "năm Bính Thân (1116)", "先是，崇賢侯夫人杜氏懷娠，至是產難", "âm 1116",
               note="Toàn thư không ghi ngày sinh; mốc 1116 suy từ việc phu nhân Đỗ thị 'sinh khó' năm này."),
             c("lifespan", 3, f"{T5} — {TD}", "在位十一年，壽二十三歲，崩于永光殿", "23"),
             c("death", 3, "năm Mậu Ngọ (1138)", "帝崩于永光殿殯于殿之西陛", "âm 1138"),
             c("posthumous_name", 3, "năm Mậu Ngọ (1138)", "群臣上尊號曰廣仁崇孝文武皇帝，廟號神宗", "Quảng Nhân Sùng Hiếu Văn Vũ hoàng đế"),
             c("reign:0", 3, f"{T5} — {TD}", "仁宗崩，遂登太寳，在位十一年"),
             c("bio", 3, f"{T5} — {TD}", "年方二歲，育于宫中，立爲皇太子")])
P(key="ly.than-tong.le-hau", full_name="Hoàng hậu Lê thị", gender="F",
  bio="Vợ Lý Thần Tông, mẹ Lý Anh Tông.",
  citations=[c("existence", 4, f"{T6} — {TD}", "其母黎氏皇后"), c("bio", 4, f"{T6} — {TD}", "其母黎氏皇后")])
U("u.than-tong--le-hau", "ly.than-tong", "ly.than-tong.le-hau", 1, [c("union", 4, f"{T6} — {TD}", "神宗嫡長子也。其母黎氏皇后")])

# ── 6. Anh Tông ────────────────────────────────────────────────────
P(key="ly.anh-tong", full_name="Lý Anh Tông", gender="M", parents="u.than-tong--le-hau", nickname="Lý Thiên Tộ",
  birth={"lunar_year": 1136, "lunar_month": 4}, death={"lunar_year": 1175, "lunar_month": 7}, lifespan=40,
  reigns=reign(6, "Anh Tông", 1138, 1175, [("Thiệu Minh", 1138), ("Đại Định", 1140), ("Chính Long Bảo Ứng", 1163), ("Thiên Cảm Chí Bảo", 1174)]),
  bio="Con trưởng (đích) của Lý Thần Tông, tên húy Thiên Tộ, sinh tháng 4 năm Bính Thìn (1136), lập thái tử tháng 9 năm Mậu Ngọ (1138). Lên ngôi năm 1138 khi mới ba tuổi. Ở ngôi 37 năm, mất tháng 7 năm Ất Mùi (1175) ở điện Thụy Quang, thọ 40 tuổi. Toàn thư chê việc phế lập nghe lời đàn bà, hình phạt không rõ nên giặc cướp nổi lên.",
  citations=[c("existence", 4, f"{T6} — {TD}", "諱天祚，神宗嫡長子也"),
             c("nickname", 4, f"{T6} — {TD}", "諱天祚，神宗嫡長子也", "Lý Thiên Tộ"),
             c("parents", 4, f"{T6} — {TD}", "神宗嫡長子也。其母黎氏皇后"),
             c("birth", 4, f"{T6} — {TD}", "以天彰宝嗣四年丙辰四月誕生", "âm 1136-4"),
             c("lifespan", 4, f"{T6} — {TD}", "在位三十七年，壽四十歲，崩于瑞光殿", "40"),
             c("death", 4, "năm Ất Mùi (1175)", "秋七月，乙巳，帝崩于瑞光殿", "âm 1175-7"),
             c("reign:0", 4, f"{T6} — {TD}", "神宗崩，遂登大宝，在位三十七年"),
             c("bio", 4, f"{T6} — {TD}", "戊午年九月立爲皇太子")])
P(key="ly.anh-tong.do-hau", full_name="Hoàng hậu Đỗ thị", gender="F", titles=[{"title": "Chiêu Linh hoàng thái hậu"}],
  bio="Vợ Lý Anh Tông, mẹ Lý Cao Tông. Khi con còn nhỏ lên ngôi, bà là Chiêu Linh thái hậu cùng nhiếp chính.",
  citations=[c("existence", 4, f"{T7} — {TD}", "其母杜氏皇后"), c("title:0", 4, "năm Mậu Tuất (1178)", "昭靈皇太后宴羣臣於別殿"),
             c("bio", 4, f"{T7} — {TD}", "其母杜氏皇后")])
U("u.anh-tong--do-hau", "ly.anh-tong", "ly.anh-tong.do-hau", 1, [c("union", 4, f"{T7} — {TD}", "英宗第六子也。其母杜氏皇后")])

# ── 7. Cao Tông ────────────────────────────────────────────────────
P(key="ly.cao-tong", full_name="Lý Cao Tông", gender="M", parents="u.anh-tong--do-hau", nickname="Lý Long Cán",
  birth={"lunar_year": 1173, "lunar_month": 5, "lunar_day": 25}, death={"lunar_year": 1210, "lunar_month": 10, "lunar_day": 28}, lifespan=38,
  reigns=reign(7, "Cao Tông", 1175, 1210, [("Trinh Phù", 1176), ("Thiên Tư Gia Thụy", 1186), ("Thiên Gia Bảo Hựu", 1202), ("Trị Bình Long Ứng", 1205)]),
  bio="Con thứ sáu của Lý Anh Tông, tên húy Long Cán, sinh ngày 25 tháng 5 năm Quý Tỵ (1173), lập thái tử năm 1174. Lên ngôi năm 1175 khi mới ba tuổi. Ở ngôi 35 năm, mất ngày 28 tháng 10 năm Canh Ngọ (1210) ở cung Thánh Thọ, thọ 38 tuổi. Toàn thư nói vua chơi bời vô độ, hình chính không rõ, giặc cướp nổi lên khắp nơi, cơ nghiệp nhà Lý từ đó suy.",
  citations=[c("existence", 4, f"{T7} — {TD}", "諱龍𣉙，英宗第六子也"),
             c("nickname", 4, f"{T7} — {TD}", "諱龍𣉙，英宗第六子也", "Lý Long Cán"),
             c("parents", 4, f"{T7} — {TD}", "英宗第六子也。其母杜氏皇后"),
             c("birth", 4, f"{T7} — {TD}", "以政隆寳應十一年癸巳五月二十五日誕生", "âm 1173-5-25"),
             c("lifespan", 4, f"{T7} — {TD}", "在位三十五年，壽三十八歲，崩于聖壽宮", "38"),
             c("death", 4, "năm Canh Ngọ (1210)", "二十八日，壬午，帝崩于聖壽宫", "âm 1210-10-28"),
             c("reign:0", 4, f"{T7} — {TD}", "英宗崩，遂登大寳，在位三十五年"),
             c("bio", 4, f"{T7} — {TD}", "天感至寳二年冊立爲皇太子")])
P(key="ly.cao-tong.dam-hau", full_name="Hoàng hậu Đàm thị", gender="F", titles=[{"title": "Hoàng thái hậu"}],
  bio="Vợ Lý Cao Tông, mẹ Lý Huệ Tông. Tháng 3 năm Bính Ngọ (1186) được phong An Toàn nguyên phi; khi con lên ngôi (1210) được tôn làm hoàng thái hậu cùng nghe chính sự.",
  citations=[c("existence", 4, f"{T8} — {TD}", "其母譚氏皇后"),
             c("title:0", 4, "năm Canh Ngọ (1210)", "尊母譚氏爲皇太后，同聽政令"),
             c("bio", 4, "năm Bính Ngọ (1186)", "三月，冊譚氏爲安全元妃")])
U("u.cao-tong--dam-hau", "ly.cao-tong", "ly.cao-tong.dam-hau", 1, [c("union", 4, f"{T8} — {TD}", "高宗長子，其母譚氏皇后")])

# ── 8. Huệ Tông ────────────────────────────────────────────────────
P(key="ly.hue-tong", full_name="Lý Huệ Tông", gender="M", parents="u.cao-tong--dam-hau", nickname="Lý Sảm",
  birth={"lunar_year": 1194, "lunar_month": 7}, death={"lunar_year": 1226, "lunar_month": 8, "lunar_day": 10}, lifespan=33,
  reigns=reign(8, "Huệ Tông", 1210, 1224, [("Kiến Gia", 1211)]),
  bio="Con trưởng của Lý Cao Tông, tên húy Sảm, sinh tháng 7 năm Giáp Dần (1194), lập thái tử tháng giêng năm Mậu Thìn (1208). Lên ngôi năm 1210 khi mới 16 tuổi, ở ngôi 14 năm. Mắc bệnh phong, không có con trai nên truyền ngôi cho con gái thứ là Chiêu Hoàng (1224), rồi xuất gia ở chùa Chân Giáo. Ngày 10 tháng 8 năm Bính Tuất (1226) bị Trần Thủ Độ giết, thọ 33 tuổi.",
  citations=[c("existence", 4, f"{T8} — {TD}", "諱旵，高宗長子，其母譚氏皇后"),
             c("nickname", 4, f"{T8} — {TD}", "諱旵，高宗長子", "Lý Sảm"),
             c("parents", 4, f"{T8} — {TD}", "高宗長子，其母譚氏皇后"),
             c("birth", 4, f"{T8} — {TD}", "於甲寅年七月誕生", "âm 1194-7"),
             c("lifespan", 4, f"{T8} — {TD}", "傳位昭皇，後爲陳守度所殺，壽三十三歲", "33"),
             c("death", 5, "năm Bính Tuất (1226)", "秋八月十日，陳守度弑李惠宗於真教襌寺", "âm 1226-8-10"),
             c("reign:0", 4, "năm Canh Ngọ (1210)", "皇太子旵即位于柩前，時方十六歲"),
             c("reign:0", 4, "năm Giáp Thân (1224)", "冬十月，詔昭聖公主爲皇太子以傳位，帝出家"),
             c("bio", 4, f"{T8} — {TD}", "治平龍應四年戊辰正月冊立爲皇太子，高宗崩，遂登太寳，在位十四年")])
P(key="ly.hue-tong.tran-thi", full_name="Thuận Trinh hoàng hậu Trần thị", gender="F", titles=[{"title": "Hoàng hậu"}],
  bio="Vợ Lý Huệ Tông, mẹ Thuận Thiên công chúa và Lý Chiêu Hoàng. Từ nguyên phi bị giáng làm ngự nữ, rồi được phong phu nhân Thuận Trinh; tháng 12 năm Bính Tý (1216) được lập làm hoàng hậu, anh là Trần Tự Khánh được làm Thái úy phụ chính.",
  citations=[c("existence", 4, "năm Bính Tý (1216)", "冬十二月，冊夫人爲皇后，拜嗣慶爲太尉輔政"),
             c("title:0", 4, "năm Bính Tý (1216)", "冬十二月，冊夫人爲皇后"),
             c("bio", 4, "năm Bính Tý (1216)", "冬十二月，冊夫人爲皇后，拜嗣慶爲太尉輔政")])
U("u.hue-tong--tran-thi", "ly.hue-tong", "ly.hue-tong.tran-thi", 1, [c("union", 4, "năm Bính Tý (1216)", "冬十二月，冊夫人爲皇后，拜嗣慶爲太尉輔政")])
P(key="ly.thuan-thien", full_name="Thuận Thiên công chúa", gender="F", parents="u.hue-tong--tran-thi",
  titles=[{"title": "Thuận Thiên công chúa"}],
  bio="Con gái lớn của Lý Huệ Tông, sinh tại Cứu Liên (tháng 6 năm Bính Tý 1216), sau phong Thuận Thiên công chúa. Sau lấy Trần Liễu, rồi trở thành hoàng hậu của Trần Thái Tông.",
  citations=[c("existence", 4, "năm Bính Tý (1216)", "夏六月，皇長女生于究連，後封順天公主"),
             c("parents", 4, "năm Bính Tý (1216)", "帝中風疾，醫治不驗，未有太子，中宫所生公主而已"),
             c("title:0", 4, "năm Bính Tý (1216)", "後封順天公主"),
             c("bio", 4, "năm Bính Tý (1216)", "夏六月，皇長女生于究連，後封順天公主")])

# ── 9. Chiêu Hoàng ────────────────────────────────────────────────
P(key="ly.chieu-hoang", full_name="Lý Chiêu Hoàng", gender="F", parents="u.hue-tong--tran-thi", nickname="Lý Phật Kim; Thiên Hinh",
  birth={"lunar_year": 1218, "lunar_month": 9}, death={"lunar_year": 1278, "lunar_month": 3}, lifespan=61,
  titles=[{"title": "Chiêu Thánh công chúa", "from_year": 1218}],
  reigns=[{"dynasty": "Lý", "ordinal": 9, "role": "emperor", "temple_name": "Chiêu Hoàng", "start_year": 1224, "end_year": 1225,
           "era_names": [{"name": "Thiên Chương Hữu Đạo", "from_year": 1224}]}],
  bio="Con gái thứ hai của Lý Huệ Tông, sinh tháng 9 năm Mậu Dần (1218), sau phong Chiêu Thánh công chúa, tên húy là Phật Kim, sau đổi là Thiên Hinh. Huệ Tông không có con trai nên lập bà làm hoàng thái tử rồi nhường ngôi (tháng 10 năm Giáp Thân 1224), hiệu Chiêu Hoàng. Ở ngôi hơn một năm, tháng 12 năm Ất Dậu (1225) nhường ngôi cho chồng là Trần Cảnh (Trần Thái Tông). Mất tháng 3 năm Mậu Dần (1278), thọ 61 tuổi.",
  citations=[c("existence", 4, f"{T9} — {TD}", "惠宗次女也"),
             c("nickname", 4, f"{T9} — {TD}", "初諱仸金，後改天馨", "Lý Phật Kim; Thiên Hinh"),
             c("parents", 4, "năm Bính Tý (1216)", "帝中風疾，醫治不驗，未有太子，中宫所生公主而已"),
             c("birth", 4, "năm Mậu Dần (1218)", "九月，皇次女生，後封昭聖公主", "âm 1218-9"),
             c("death", 5, "năm Mậu Dần (1278)", "三月，黎輔陳夫人昭聖公主李氏薨", "âm 1278-3"),
             c("lifespan", 5, "năm Mậu Dần (1278)", "至是年六十一薨", "61"),
             c("title:0", 4, "năm Mậu Dần (1218)", "皇次女生，後封昭聖公主"),
             c("reign:0", 4, "năm Giáp Thân (1224)", "昭聖即位，改元天彰有道元年，尊號曰昭皇"),
             c("reign:0", 4, "năm Ất Dậu (1225)", "昭皇乃降服，勸進陳煚即皇帝位"),
             c("bio", 4, f"{T9} — {TD}", "惠宗無嗣，立爲皇太子以傳位。在位二年，遂禪位于陳")])

# ── Di sản ─────────────────────────────────────────────────────────
H("ds.thang-long", "place", "Kinh thành Thăng Long (dời đô 1010)",
  "Năm 1010 Lý Thái Tổ dời đô từ Hoa Lư về thành Đại La, đổi tên là Thăng Long.",
  "Mùa thu tháng 7 năm Canh Tuất (1010), Lý Thái Tổ dời kinh đô từ thành Hoa Lư về thành Đại La, thấy rồng vàng hiện lên ở thuyền ngự nên đổi tên thành là Thăng Long. Vua cho dựng cung điện trong kinh thành: điện Càn Nguyên làm nơi thiết triều, bên trái là điện Tập Hiền, bên phải là điện Giảng Vũ, cửa Phi Long, cửa Đan Phượng. Đây là nền của Hà Nội ngày nay; khu Hoàng thành Thăng Long được UNESCO ghi danh Di sản thế giới năm 2010.",
  [("ly.thai-to", "dời đô, đặt tên Thăng Long")],
  [c("existence", 2, "năm Canh Tuất (1010)", "秋七月，帝自華閭城徙都于京府大羅城，暫泊城下，黄龍見于御舟，因改其城曰昇龍城"),
   c("body", 2, "năm Canh Tuất (1010)", "遂於昇龍京城之内起造宫殿。前起乾元殿，以為視朝之所。左置集賢殿，右立講武殿"),
   c("person:0", 2, "năm Canh Tuất (1010)", "帝自華閭城徙都于京府大羅城"),
   c("location_name", 2, "năm Canh Tuất (1010)", "帝自華閭城徙都于京府大羅城", "Hà Nội (thành Đại La xưa)")], "Hà Nội (thành Đại La xưa)",
  [pexels(38015799, "ancient-gate-at-imperial-citadel-of-thang-long", "valeria-drozdova-2148646707", "Cổng thành ở Hoàng thành Thăng Long, Hà Nội (ảnh Pexels)")])
H("ds.chua-mot-cot", "place", "Chùa Một Cột (Diên Hựu)",
  "Chùa Diên Hựu do Lý Thái Tông cho dựng năm 1049 trên một cột đá, theo giấc mộng thấy Phật Quan Âm ngồi tòa sen.",
  "Mùa đông tháng 10 năm Kỷ Sửu (1049), Lý Thái Tông cho dựng chùa Diên Hựu. Trước đó vua mơ thấy Phật Quan Âm ngồi trên đài sen, dắt vua lên đài. Khi tỉnh dậy, vua kể lại với các quan, có người cho là điềm gở; sư Thiền Tuệ khuyên vua dựng chùa, dựng cột đá giữa đất, làm đài sen Quan Âm trên đó như trong mộng. Tăng chúng đi vòng tụng kinh cầu cho vua sống lâu, nên đặt tên là Diên Hựu. Chùa nay gọi là chùa Một Cột ở Hà Nội.",
  [("ly.thai-tong", "cho dựng chùa")],
  [c("existence", 2, "năm Kỷ Sửu (1049)", "冬十月，造延祐寺。初，帝夢觀音仸坐蓮花臺，引帝登臺"),
   c("body", 2, "năm Kỷ Sửu (1049)", "有僧禪慧者勸帝造寺，立石柱于地中，搆觀音蓮花臺于其上，如夢中所見"),
   c("body", 2, "năm Kỷ Sửu (1049)", "僧徒旋繞誦經求延壽，故名延祐"),
   c("person:0", 2, "năm Kỷ Sửu (1049)", "冬十月，造延祐寺"),
   c("location_name", 2, "năm Kỷ Sửu (1049)", "冬十月，造延祐寺", "Hà Nội", note="Vị trí hiện nay (chùa Một Cột); Toàn thư không ghi địa điểm.")], "Hà Nội",
  [pexels(31688897, "one-pillar-pagoda-in-hanoi-vietnam", "dqnguyen15", "Chùa Một Cột (Diên Hựu), Hà Nội (ảnh Pexels)")])
H("ds.van-mieu", "place", "Văn Miếu (1070)",
  "Năm 1070 Lý Thánh Tông cho tu sửa Văn Miếu, tô tượng Khổng Tử, Chu Công và bốn vị phối thờ, vẽ tượng bảy mươi hai hiền; hoàng thái tử đến học.",
  "Mùa thu tháng 8 năm Canh Tuất (1070), Lý Thánh Tông cho tu sửa Văn Miếu, tô tượng Khổng Tử, Chu Công và Tứ phối, vẽ hình bảy mươi hai người hiền, bốn mùa cúng tế; hoàng thái tử đến học ở đây. Sau này Văn Miếu – Quốc Tử Giám ở Hà Nội trở thành trường đại học đầu tiên của nước ta (Quốc Tử Giám lập năm 1076 đời Nhân Tông).",
  [("ly.thanh-tong", "cho tu sửa, lập thờ Khổng Tử")],
  [c("existence", 3, "năm Canh Tuất (1070)", "秋八月，脩文廟，塑孔子、周公及四配像，畫七十二賢像，四時享祀"),
   c("body", 3, "năm Canh Tuất (1070)", "皇太子臨學焉"),
   c("body", 3, "năm Bính Thìn (1076)", "選文職官員識字者入國子監"),
   c("person:0", 3, "năm Canh Tuất (1070)", "秋八月，脩文廟，塑孔子"),
   c("location_name", 3, "năm Canh Tuất (1070)", "秋八月，脩文廟，塑孔子、周公及四配像", "Hà Nội", note="Vị trí hiện nay (Văn Miếu – Quốc Tử Giám); Toàn thư không ghi địa điểm.")], "Hà Nội",
  [pexels(38127389, "ancient-gate-at-the-temple-of-literature-hanoi", "valeria-drozdova-2148646707", "Cổng Văn Miếu, Hà Nội (ảnh Pexels)")])

links += [
    {"person": "ly.chieu-hoang", "other_clan": "tran", "other_person": "tran.chieu-thanh",
     "note": "Vua cuối triều Lý, hoàng hậu đầu tiên của Trần Thái Tông",
     "citations": [c("same_person", 4, "năm Ất Dậu (1225)", "昭皇乃降服，勸進陳煚即皇帝位")], "review": DRAFT},
    {"person": "ly.thuan-thien", "other_clan": "tran", "other_person": "tran.thuan-thien",
     "note": "Công chúa Thuận Thiên nhà Lý, vợ Trần Liễu rồi hoàng hậu Trần Thái Tông",
     "citations": [c("same_person", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻順天公主李氏為順天皇后")], "review": DRAFT},
]

data = {
    "clan": {"key": "ly", "name": "Nhà Lý (1009–1225)", "category": "royal",
             "description": "Nhà Lý do Lý Công Uẩn (Thái Tổ) lập năm 1009, dời đô về Thăng Long, truyền chín đời qua 216 năm. Cao điểm dưới Thánh Tông, Nhân Tông; suy từ Anh Tông, Cao Tông; Lý Chiêu Hoàng nhường ngôi cho chồng là Trần Cảnh (1225), mở đầu nhà Trần. Gia phả này chép từ Thái Tổ qua các đời vua và hoàng hậu, theo Đại Việt sử ký toàn thư. Mỗi dữ kiện đều có nguyên văn trích dẫn; xem dòng \"Theo:\" cuối tiểu sử."},
    "persons": persons, "unions": unions, "resting_places": graves, "heritage": heritage, "events": [], "same_person_links": links,
}
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(persons)} người, {len(unions)} hôn nhân, {len(graves)} lăng, {len(links)} thông gia")

import os, subprocess
subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "normalize_bio.py"), OUT], check=True)
