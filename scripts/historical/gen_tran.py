"""Sinh data/historical/tran.json — khung gia phả nhà Trần (bản NHÁP).

  python3 -I scripts/historical/gen_tran.py data/historical/tran.json
  python3 -I scripts/historical/verify_quotes.py data/historical/tran.json <thư mục nguồn>

Trích dẫn là nguyên văn chữ Hán: Đại Việt sử ký toàn thư (TT, Bản kỷ Q.4–8),
Cương mục (CM, Chính biên Q.6–11), Việt sử lược (VSL, phụ 陳朝紀年) — zh.wikisource.
Giá trị (value), tiểu sử là phiên âm/dịch của người soạn — người duyệt kiểm lại.
Phần mở rộng (nguồn thứ hai, các nhánh, di sản) ở gen_tran_ext.py.

Chỉ dùng để dựng bản khung. Khi đã bắt đầu duyệt (review.status), sửa thẳng
tran.json — chạy lại script này sẽ ghi đè trạng thái duyệt.
"""
import json
import sys

OUT = sys.argv[1]

TD = "tiểu dẫn"  # đoạn chữ nhỏ đầu kỷ mỗi vua


def c(field, vol, where, quote, value=None, note=None):
    d = {"field": field, "source": "TT", "locator": f"Bản kỷ Q.{vol}, {where}", "quote": quote}
    if value is not None:
        d["value"] = value
    if note:
        d["note"] = note
    return d


DRAFT = {"status": "draft", "note": "Khung P1 — AI trích từ nguyên văn Toàn thư; cần người duyệt đối chiếu bản dịch + Cương mục."}

persons = []
unions = []
graves = []
links = []


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


TONG = "Trần kỷ, Thái Tông hoàng đế"

# ── Tổ tiên: Kinh → Hấp → Lý → Thừa ────────────────────────────────
TIEN = "初，帝之先世閩人或曰桂林人有名京者，來居天長即墨鄕"
P(key="tran.kinh", full_name="Trần Kinh", gender="M", is_root=True,
  bio="Tổ tiên xa nhất của nhà Trần mà Toàn thư chép tên. Tổ tiên là người đất Mân (có thuyết nói người Quế Lâm); Kinh đến ở hương Tức Mặc, phủ Thiên Trường, đời đời làm nghề đánh cá.",
  citations=[c("existence", 5, f"{TONG} — {TD}", "有名京者，來居天長即墨鄕"),
             c("bio", 5, f"{TONG} — {TD}", "帝之先世閩人"),
             c("bio", 5, f"{TONG} — {TD}", "世以漁為業")])
U("u.kinh", "tran.kinh")
P(key="tran.hap", full_name="Trần Hấp", gender="M", parents="u.kinh",
  citations=[c("existence", 5, f"{TONG} — {TD}", "生翕，翕生李"), c("parents", 5, f"{TONG} — {TD}", "來居天長即墨鄕。生翕")])
U("u.hap", "tran.hap")
P(key="tran.ly", full_name="Trần Lý", gender="M", parents="u.hap",
  citations=[c("existence", 5, f"{TONG} — {TD}", "翕生李，李生承"), c("parents", 5, f"{TONG} — {TD}", "翕生李，李生承")])
U("u.ly", "tran.ly")

P(key="tran.thua", full_name="Trần Thừa", gender="M", parents="u.ly",
  death={"lunar_year": 1234, "lunar_month": 1, "lunar_day": 18}, lifespan=51,
  burial_place="Thọ Lăng (sau gọi Huy Lăng), hương Tinh Cương, phủ Long Hưng",
  posthumous_name="Khai Vận Lập Cực Hoằng Nhân Ứng Đạo Thuần Chân Chí Đức Thần Vũ Thánh Văn Thùy Dụ Chí Hiếu hoàng đế",
  titles=[{"title": "Thái thượng hoàng"}, {"title": "Miếu hiệu Huy Tông, năm 1248 đổi là Thái Tổ", "from_year": 1234}],
  bio="Cha của Trần Thái Tông, đời đời làm nghề đánh cá. Con lên ngôi, được tôn làm Thượng hoàng. Mất ngày 18 tháng Giêng năm Giáp Ngọ (1234) ở cung Phụ Thiên, thọ 51 tuổi, táng Thọ Lăng; miếu hiệu Huy Tông, năm Mậu Thân (1248) đổi là Thái Tổ.",
  citations=[c("existence", 5, f"{TONG} — {TD}", "李生承，世以漁為業"),
             c("parents", 5, f"{TONG} — {TD}", "李生承，世以漁為業"),
             c("death", 5, "năm Giáp Ngọ (1234)", "甲午三年宋端平元年春正月十八日，上皇崩于附天宫，壽五十一", "âm 1234-1-18"),
             c("lifespan", 5, "năm Giáp Ngọ (1234)", "上皇崩于附天宫，壽五十一", "51"),
             c("burial_place", 5, "năm Giáp Ngọ (1234)", "塟龍興府壽陵陵在星罡鄕", "Thọ Lăng (sau gọi Huy Lăng), hương Tinh Cương, phủ Long Hưng"),
             c("posthumous_name", 5, "năm Giáp Ngọ (1234)", "謚曰開運立極弘人應道純真至德神武聖文垂裕至孝皇帝",
               "Khai Vận Lập Cực Hoằng Nhân Ứng Đạo Thuần Chân Chí Đức Thần Vũ Thánh Văn Thùy Dụ Chí Hiếu hoàng đế"),
             c("title:0", 5, "năm Giáp Ngọ (1234)", "上皇崩于附天宫"),
             c("title:1", 5, "năm Mậu Thân (1248)", "改徽宗廟號曰太祖廟，壽陵曰徽陵"),
             c("bio", 5, "năm Giáp Ngọ (1234)", "廟號徽宗")])
P(key="tran.thua.le-thi", full_name="Lê thị", gender="F",
  bio="Vợ Trần Thừa, mẹ Trần Thái Tông.",
  citations=[c("existence", 5, f"{TONG} — {TD}", "帝乃承之次子也，母黎氏"), c("bio", 5, f"{TONG} — {TD}", "帝乃承之次子也，母黎氏")])
U("u.thua--le-thi", "tran.thua", "tran.thua.le-thi", 1,
  [c("union", 5, f"{TONG} — {TD}", "帝乃承之次子也，母黎氏")])
G("lang.tho-lang", "Thọ Lăng", ["tran.thua"],
  [c("existence", 5, "năm Giáp Ngọ (1234)", "塟龍興府壽陵"),
   c("location_name", 5, "năm Giáp Ngọ (1234)", "陵在星罡鄕，昭、裕、德三陵同", "hương Tinh Cương, phủ Long Hưng"),
   c("occupant:0", 5, "năm Giáp Ngọ (1234)", "秋八月二十八日，塟龍興府壽陵"),
   c("notes", 5, "năm Mậu Thân (1248)", "壽陵曰徽陵")],
  location_name="hương Tinh Cương, phủ Long Hưng",
  notes="Lăng của Trần Thừa. Năm Mậu Thân (1248) đổi gọi là Huy Lăng. Chiêu Lăng, Dụ Lăng, Đức Lăng cùng ở xứ này.")

# ── 1. Thái Tông ───────────────────────────────────────────────────
P(key="tran.thai-tong", full_name="Trần Thái Tông", gender="M", parents="u.thua--le-thi",
  nickname="Trần Cảnh; Trần Bồ",
  birth={"lunar_year": 1218, "lunar_month": 6, "lunar_day": 16},
  death={"lunar_year": 1277, "lunar_month": 4, "lunar_day": 1}, lifespan=60,
  burial_place="Chiêu Lăng",
  posthumous_name="Thống Thiên Ngự Cực Long Công Mậu Đức Hiển Hòa Hựu Thuận Thần Văn Thánh Vũ Nguyên Hiếu hoàng đế",
  reigns=[{"dynasty": "Trần", "ordinal": 1, "role": "emperor", "temple_name": "Thái Tông", "start_year": 1225, "end_year": 1258}],
  bio="Vua họ Trần, tên húy là Cảnh, trước húy là Bồ, con thứ của Trần Thừa, mẹ họ Lê. Làm Chi hậu chính triều Lý, năm Ất Dậu (1225) được Chiêu Hoàng nhường ngôi. Ở ngôi 33 năm, nhường ngôi 19 năm, thọ 60 tuổi, mất ở cung Vạn Thọ, táng Chiêu Lăng.",
  citations=[c("existence", 5, f"{TONG} — {TD}", "姓陳，諱煚，先諱蒲"),
             c("nickname", 5, f"{TONG} — {TD}", "姓陳，諱煚，先諱蒲", "Trần Cảnh; Trần Bồ"),
             c("parents", 5, f"{TONG} — {TD}", "帝乃承之次子也，母黎氏"),
             c("birth", 5, f"{TONG} — {TD}", "以李建嘉八年戊寅六月十六日誕生", "âm 1218-6-16"),
             c("death", 5, "năm Đinh Sửu (1277)", "夏四月，朔，上皇崩于萬壽宫", "âm 1277-4-1"),
             c("lifespan", 5, f"{TONG} — {TD}", "壽六十歲", "60"),
             c("burial_place", 5, f"{TONG} — {TD}", "崩于萬壽宫塟昭陵", "Chiêu Lăng"),
             c("posthumous_name", 5, "năm Đinh Sửu (1277)", "廟號太宗，謚曰綂天御極隆功荗德顯和佑順神文聖武元孝皇帝",
               "Thống Thiên Ngự Cực Long Công Mậu Đức Hiển Hòa Hựu Thuận Thần Văn Thánh Vũ Nguyên Hiếu hoàng đế"),
             c("reign:0", 5, f"{TONG} — {TD}", "乙酉冬十二月十二日戊寅受昭皇禅，即皇帝位，改元建中"),
             c("reign:0", 5, "năm Mậu Ngọ (1258)", "二月二十四日，帝傳位于皇太子晃，遜居北宫"),
             c("bio", 5, f"{TONG} — {TD}", "為李朝袛候正，受昭皇禅，在位三十三年，遜位十九年，壽六十歲，崩于萬壽宫塟昭陵")])
P(key="tran.chieu-thanh", full_name="Lý Chiêu Hoàng", gender="F",
  death={"lunar_year": 1278, "lunar_month": 3}, lifespan=61,
  titles=[{"title": "Hoàng hậu Chiêu Thánh", "from_year": 1226, "to_year": 1237}, {"title": "Công chúa", "from_year": 1237}],
  bio="Vua cuối triều Lý, năm Ất Dậu (1225) nhường ngôi cho Trần Cảnh. Năm Bính Tuất (1226) được lập làm hoàng hậu, đổi hiệu là Chiêu Thánh; năm Đinh Dậu (1237) bị giáng làm công chúa vì không có con. Sau lấy Lê Phụ Trần, sinh một trai một gái. Mất tháng 3 năm Mậu Dần (1278), thọ 61 tuổi.",
  citations=[c("existence", 5, f"{TONG} — {TD}", "受昭皇禅"),
             c("death", 5, "năm Mậu Dần (1278)", "三月，黎輔陳夫人昭聖公主李氏薨", "âm 1278-3"),
             c("lifespan", 5, "năm Mậu Dần (1278)", "至是年六十一薨", "61"),
             c("title:0", 5, "năm Bính Tuất (1226)", "冊昭皇為皇后，改昭聖"),
             c("title:1", 5, "năm Đinh Dậu (1237)", "降昭聖為公主。時昭聖無子"),
             c("bio", 5, "năm Mậu Dần (1278)", "昭聖下嫁輔陳二十餘年，生男上位侯琮、女應瑞公主珪")])
U("u.thai-tong--chieu-thanh", "tran.thai-tong", "tran.chieu-thanh", 1,
  [c("union", 5, "năm Bính Tuất (1226)", "春正月，冊昭皇為皇后，改昭聖")])
P(key="tran.thuan-thien", full_name="Thuận Thiên hoàng hậu Lý thị", gender="F",
  death={"lunar_year": 1248, "lunar_month": 6},
  posthumous_name="Hiển Từ Thuận Thiên hoàng thái hậu",
  titles=[{"title": "Hoàng hậu Thuận Thiên", "from_year": 1237}],
  bio="Công chúa Thuận Thiên họ Lý, vốn là vợ Hoài vương Trần Liễu (anh vua). Năm Đinh Dậu (1237), khi đang có mang ba tháng, được Thái Tông lấy làm hoàng hậu theo mưu của Trần Thủ Độ. Mẹ Trần Thánh Tông. Mất tháng 6 năm Mậu Thân (1248), truy tôn là Hiển Từ Thuận Thiên hoàng thái hậu.",
  citations=[c("existence", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻順天公主李氏為順天皇后"),
             c("death", 5, "năm Mậu Thân (1248)", "六月，順天皇后崩", "âm 1248-6"),
             c("posthumous_name", 5, "năm Mậu Thân (1248)", "追尊顯慈順天皇太后", "Hiển Từ Thuận Thiên hoàng thái hậu"),
             c("title:0", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻順天公主李氏為順天皇后"),
             c("bio", 5, "năm Đinh Dậu (1237)", "時昭聖無子，而順天懷娠國康三月，陳守度與天極公主密謀於帝曰")])
U("u.thai-tong--thuan-thien", "tran.thai-tong", "tran.thuan-thien", 2,
  [c("union", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻順天公主李氏為順天皇后，降昭聖為公主")])
G("lang.chieu-lang", "Chiêu Lăng", ["tran.thai-tong"],
  [c("existence", 5, "năm Đinh Sửu (1277)", "冬十月四日，塟昭陵"),
   c("location_name", 5, "năm Giáp Ngọ (1234)", "陵在星罡鄕，昭、裕、德三陵同", "hương Tinh Cương, phủ Long Hưng"),
   c("occupant:0", 5, "năm Đinh Sửu (1277)", "冬十月四日，塟昭陵，廟號太宗")],
  location_name="hương Tinh Cương, phủ Long Hưng")
links.append({"person": "tran.chieu-thanh", "other_clan": "ly", "other_person": "ly.chieu-hoang",
              "note": "Vua cuối triều Lý, hoàng hậu đầu tiên của Trần Thái Tông",
              "citations": [c("same_person", 5, f"{TONG} — {TD}", "受昭皇禅，即皇帝位")], "review": DRAFT})

# ── 2. Thánh Tông ──────────────────────────────────────────────────
TT2 = "Trần kỷ, Thánh Tông hoàng đế"
P(key="tran.thanh-tong", full_name="Trần Thánh Tông", gender="M", parents="u.thai-tong--thuan-thien",
  nickname="Trần Hoảng",
  birth={"lunar_year": 1240, "lunar_month": 9, "lunar_day": 25},
  death={"lunar_year": 1290, "lunar_month": 5, "lunar_day": 25}, lifespan=51,
  burial_place="Dụ Lăng",
  reigns=[{"dynasty": "Trần", "ordinal": 2, "role": "emperor", "temple_name": "Thánh Tông", "start_year": 1258, "end_year": 1278}],
  bio="Tên húy là Hoảng, con trưởng dòng đích của Thái Tông, mẹ là Hiển Từ Thuận Thiên hoàng thái hậu họ Lý. Sinh ngày 25 tháng 9 năm Canh Tý (1240), sớm được lập làm Hoàng thái tử. Năm Mậu Ngọ (1258) được Thái Tông nhường ngôi. Ở ngôi 21 năm, nhường ngôi 10 năm, thọ 51 tuổi, mất ở cung Nhân Thọ, táng Dụ Lăng.",
  citations=[c("existence", 5, f"{TT2} — {TD}", "諱晃，太宗適長子也"),
             c("nickname", 5, f"{TT2} — {TD}", "諱晃，太宗適長子也", "Trần Hoảng"),
             c("parents", 5, f"{TT2} — {TD}", "太宗適長子也，母顯慈順天皇太后李氏"),
             c("birth", 5, f"{TT2} — {TD}", "以天應正平九年庚子九月二十五日午時誕生", "âm 1240-9-25"),
             c("death", 5, "năm Canh Dần (1290)", "五月二十五日，上皇崩于仁壽宫", "âm 1290-5-25"),
             c("lifespan", 5, f"{TT2} — {TD}", "壽五十一歲", "51"),
             c("burial_place", 5, f"{TT2} — {TD}", "崩于仁壽宫，塟裕陵", "Dụ Lăng"),
             c("reign:0", 5, "năm Mậu Ngọ (1258)", "太子即皇帝位，改元紹隆元年"),
             c("reign:0", 5, "năm Mậu Dần (1278)", "冬十月二十二日，帝禅位于皇太子昑"),
             c("bio", 5, f"{TT2} — {TD}", "尋立為皇太子。太宗遜位，遂登大寶，在位二十一年，遜位十年，壽五十一歲，崩于仁壽宫，塟裕陵")])
P(key="tran.thien-cam", full_name="Nguyên Thánh Thiên Cảm hoàng thái hậu", gender="F",
  nickname="Thiều", death={"lunar_year": 1287, "lunar_month": 2},
  titles=[{"title": "Thiên Cảm phu nhân"}, {"title": "Hoàng hậu"}],
  bio="Tên là Thiều, con gái thứ năm của Yên Sinh vương. Được nạp làm Thiên Cảm phu nhân, rồi sách lập làm hoàng hậu. Mẹ Trần Nhân Tông. Mất tháng 2 năm Đinh Hợi (1287).",
  citations=[c("existence", 5, "năm Mậu Ngọ (1258)", "納安生王第五女韶為天感夫人，尋冊為后"),
             c("nickname", 5, "năm Mậu Ngọ (1258)", "納安生王第五女韶為天感夫人", "Thiều"),
             c("death", 5, "năm Đinh Hợi (1287)", "丁亥三年元至元二十四年春二月，元聖天感皇太后崩", "âm 1287-2"),
             c("title:0", 5, "năm Mậu Ngọ (1258)", "韶為天感夫人"),
             c("title:1", 5, "năm Mậu Ngọ (1258)", "尋冊為后"),
             c("bio", 5, "năm Mậu Ngọ (1258)", "納安生王第五女韶為天感夫人，尋冊為后")])
U("u.thanh-tong--thien-cam", "tran.thanh-tong", "tran.thien-cam", 1,
  [c("union", 5, "năm Mậu Ngọ (1258)", "納安生王第五女韶為天感夫人，尋冊為后")])
G("lang.du-lang", "Dụ Lăng", ["tran.thanh-tong"],
  [c("existence", 5, f"{TT2} — {TD}", "崩于仁壽宫，塟裕陵"),
   c("location_name", 5, "năm Giáp Ngọ (1234)", "陵在星罡鄕，昭、裕、德三陵同", "hương Tinh Cương, phủ Long Hưng"),
   c("occupant:0", 5, f"{TT2} — {TD}", "崩于仁壽宫，塟裕陵")],
  location_name="hương Tinh Cương, phủ Long Hưng")

# ── 3. Nhân Tông ───────────────────────────────────────────────────
NT = "Trần kỷ, Nhân Tông hoàng đế"
P(key="tran.nhan-tong", full_name="Trần Nhân Tông", gender="M", parents="u.thanh-tong--thien-cam",
  nickname="Trần Khâm",
  birth={"lunar_year": 1258, "lunar_month": 11, "lunar_day": 11},
  death={"lunar_year": 1308, "lunar_month": 11, "lunar_day": 3}, lifespan=51,
  burial_place="Đức Lăng",
  posthumous_name="Pháp Thiên Sùng Đạo Ứng Thế Hóa Dân Long Từ Hiển Huệ Thánh Văn Thần Vũ Nguyên Minh Duệ Hiếu hoàng đế",
  reigns=[{"dynasty": "Trần", "ordinal": 3, "role": "emperor", "temple_name": "Nhân Tông", "start_year": 1278, "end_year": 1293}],
  bio="Tên húy là Khâm, con trưởng của Thánh Tông, mẹ là Nguyên Thánh Thiên Cảm hoàng thái hậu. Sinh ngày 11 tháng 11 năm Mậu Ngọ (1258). Ở ngôi 14 năm, nhường ngôi 5 năm, xuất gia 8 năm, ở núi Yên Tử, tự hiệu Trúc Lâm đại sĩ. Thọ 51 tuổi, mất ở am Ngọa Vân núi Yên Tử, táng Đức Lăng.",
  citations=[c("existence", 5, f"{NT} — {TD}", "諱昑，聖宗長子，母元聖天感皇太后"),
             c("nickname", 5, f"{NT} — {TD}", "諱昑，聖宗長子", "Trần Khâm"),
             c("parents", 5, f"{NT} — {TD}", "聖宗長子，母元聖天感皇太后"),
             c("birth", 5, f"{NT} — {TD}", "以元豊八年戊午十一月十一日誕生", "âm 1258-11-11"),
             c("death", 6, "năm Mậu Thân (1308)", "三日，上皇崩于安子山卧雲庵", "âm 1308-11-3", note="Dòng ngay trước chép 冬十一月，朔 → ngày 3 tháng 11."),
             c("lifespan", 5, f"{NT} — {TD}", "壽五十一歲", "51"),
             c("burial_place", 5, f"{NT} — {TD}", "崩于安子山卧雲庵，㱕塟德陵", "Đức Lăng"),
             c("posthumous_name", 6, "năm Canh Tuất (1310)", "廟號仁宗，謚曰法天崇道應世化民隆慈顯惠聖文神武元明睿孝皇帝",
               "Pháp Thiên Sùng Đạo Ứng Thế Hóa Dân Long Từ Hiển Huệ Thánh Văn Thần Vũ Nguyên Minh Duệ Hiếu hoàng đế"),
             c("reign:0", 5, "năm Mậu Dần (1278)", "昑即皇帝位，稱孝皇"),
             c("reign:0", 5, "năm Quý Tỵ (1293)", "春三月九日，帝禪位于皇太子烇即皇帝位"),
             c("bio", 5, f"{NT} — {TD}", "在位十四年，遜位五年，出家八年，壽五十一歲，崩于安子山卧雲庵"),
             c("bio", 6, "năm Mậu Thân (1308)", "時上皇出家，居安子山之紫霄峯，自號竹林大士")])
P(key="tran.khiem-tu", full_name="Khâm Từ Bảo Thánh hoàng thái hậu", gender="F",
  death={"lunar_year": 1293, "lunar_month": 9, "lunar_day": 13},
  bio="Hoàng hậu của Nhân Tông, mẹ Trần Anh Tông. Mất ngày 13 tháng 9 năm Quý Tỵ (1293) ở bến Lỗ Giang, phủ Long Hưng.",
  citations=[c("existence", 6, f"Trần kỷ, Anh Tông hoàng đế — {TD}", "仁宗長子，母欽慈保聖皇太后也"),
             c("death", 5, "năm Quý Tỵ (1293)", "秋九月十三日，欽慈保聖皇太后崩于龍興府魯江", "âm 1293-9-13"),
             c("bio", 5, "năm Quý Tỵ (1293)", "欽慈保聖皇太后崩于龍興府魯江")])
U("u.nhan-tong--khiem-tu", "tran.nhan-tong", "tran.khiem-tu", 1,
  [c("union", 6, f"Trần kỷ, Anh Tông hoàng đế — {TD}", "仁宗長子，母欽慈保聖皇太后也")])
G("lang.duc-lang", "Đức Lăng", ["tran.nhan-tong"],
  [c("existence", 5, f"{NT} — {TD}", "㱕塟德陵"),
   c("location_name", 5, "năm Giáp Ngọ (1234)", "陵在星罡鄕，昭、裕、德三陵同", "hương Tinh Cương, phủ Long Hưng"),
   c("occupant:0", 6, "năm Canh Tuất (1310)", "奉引上皇梓宫塟龍興府㱕德陵，舍利藏卧雲庵寶㙮，廟號仁宗"),
   c("notes", 6, "năm Canh Tuất (1310)", "舍利藏卧雲庵寶㙮")],
  location_name="hương Tinh Cương, phủ Long Hưng",
  notes="Năm Canh Tuất (1310) rước linh cữu Thượng hoàng Nhân Tông về táng; xá lị để ở bảo tháp am Ngọa Vân.")

# ── 4. Anh Tông ────────────────────────────────────────────────────
AT = "Trần kỷ, Anh Tông hoàng đế"
P(key="tran.anh-tong", full_name="Trần Anh Tông", gender="M", parents="u.nhan-tong--khiem-tu",
  nickname="Trần Thuyên",
  death={"lunar_year": 1320, "lunar_month": 3, "lunar_day": 16}, lifespan=45,
  burial_place="Thái Lăng, núi Yên Sinh",
  posthumous_name="Hiển Văn Duệ Vũ Khâm Minh Nhân Hiếu hoàng đế",
  reigns=[{"dynasty": "Trần", "ordinal": 4, "role": "emperor", "temple_name": "Anh Tông", "start_year": 1293, "end_year": 1314}],
  bio="Tên là Thuyên, con trưởng của Nhân Tông, mẹ là Khâm Từ Bảo Thánh hoàng thái hậu. Năm Quý Tỵ (1293) được Nhân Tông nhường ngôi. Ở ngôi 21 năm, nhường ngôi 6 năm, thọ 45 tuổi, mất ở cung Trùng Quang phủ Thiên Trường, táng Thái Lăng.",
  citations=[c("existence", 6, f"{AT} — {TD}", "名烇，仁宗長子"),
             c("nickname", 6, f"{AT} — {TD}", "名烇，仁宗長子", "Trần Thuyên", note="Toàn thư chép 名 (tên), không phải 諱"),
             c("parents", 6, f"{AT} — {TD}", "仁宗長子，母欽慈保聖皇太后也"),
             c("death", 6, "năm Canh Thân (1320)", "庚申七年元延祐七年春三月十六日，上皇崩于天長府重光宫", "âm 1320-3-16"),
             c("lifespan", 6, f"{AT} — {TD}", "壽四十五歳", "45"),
             c("burial_place", 6, "năm Canh Thân (1320)", "上皇塟安生泰陵在安生山", "Thái Lăng, núi Yên Sinh"),
             c("posthumous_name", 6, "năm Canh Thân (1320)", "廟號英宗，謚曰顯文睿武欽明仁孝皇帝", "Hiển Văn Duệ Vũ Khâm Minh Nhân Hiếu hoàng đế"),
             c("reign:0", 5, "năm Quý Tỵ (1293)", "帝禪位于皇太子烇即皇帝位。改元興隆元年"),
             c("reign:0", 6, "năm Giáp Dần (1314)", "十八日，帝禪位于皇太子奣"),
             c("bio", 6, f"{AT} — {TD}", "在位二十一年，遜位六年，壽四十五歳，崩于天長府重光宫，塟泰陵")])
P(key="tran.thuan-thanh", full_name="Thuận Thánh Bảo Từ hoàng thái hậu Trần thị", gender="F",
  death={"lunar_year": 1330, "lunar_month": 7},
  bio="Con gái Hưng Nhượng đại vương Quốc Tảng. Hoàng hậu của Anh Tông, là đích mẫu của Minh Tông. Mất tháng 7 năm Canh Ngọ (1330) ở am Mộc Cảo, Yên Sinh.",
  citations=[c("existence", 6, f"Trần kỷ, Minh Tông hoàng đế — {TD}", "嫡母順聖保慈皇太后陳氏，興讓大王國顙之女也"),
             c("death", 7, "năm Canh Ngọ (1330)", "秋七月，順聖保慈皇太后崩于安生木杲庵", "âm 1330-7"),
             c("bio", 6, f"Trần kỷ, Minh Tông hoàng đế — {TD}", "嫡母順聖保慈皇太后陳氏，興讓大王國顙之女也"),
             c("bio", 7, "năm Canh Ngọ (1330)", "順聖保慈皇太后崩于安生木杲庵")])
U("u.anh-tong--thuan-thanh", "tran.anh-tong", "tran.thuan-thanh", 1,
  [c("union", 6, f"Trần kỷ, Minh Tông hoàng đế — {TD}", "嫡母順聖保慈皇太后陳氏")])
P(key="tran.chieu-hien", full_name="Chiêu Hiến hoàng thái hậu Trần thị", gender="F",
  bio="Con gái Bảo Nghĩa đại vương Bình Trọng. Mẹ đẻ của Trần Minh Tông.",
  citations=[c("existence", 6, f"Trần kỷ, Minh Tông hoàng đế — {TD}", "親生母昭憲皇太后陳氏，保義大王平仲之女也"),
             c("bio", 6, f"Trần kỷ, Minh Tông hoàng đế — {TD}", "親生母昭憲皇太后陳氏，保義大王平仲之女也")])
U("u.anh-tong--chieu-hien", "tran.anh-tong", "tran.chieu-hien", None,
  [c("union", 6, f"Trần kỷ, Minh Tông hoàng đế — {TD}", "親生母昭憲皇太后陳氏")])
G("lang.thai-lang", "Thái Lăng", ["tran.anh-tong"],
  [c("existence", 6, "năm Canh Thân (1320)", "十二月十二日，上皇塟安生泰陵在安生山"),
   c("location_name", 6, "năm Canh Thân (1320)", "上皇塟安生泰陵在安生山，穆、阜二陵同", "núi Yên Sinh"),
   c("occupant:0", 6, "năm Canh Thân (1320)", "上皇塟安生泰陵在安生山"),
   c("notes", 6, "năm Canh Thân (1320)", "穆、阜二陵同")],
  location_name="núi Yên Sinh",
  notes="Táng ngày 12 tháng 12 năm Canh Thân (1320). Mục Lăng, Phụ Lăng cùng ở núi này.")

# ── 5. Minh Tông ───────────────────────────────────────────────────
MT = "Trần kỷ, Minh Tông hoàng đế"
P(key="tran.minh-tong", full_name="Trần Minh Tông", gender="M", parents="u.anh-tong--chieu-hien",
  adoptive_parents=None, nickname="Trần Mạnh",
  death={"lunar_year": 1357, "lunar_month": 2, "lunar_day": 19}, lifespan=58,
  burial_place="Mục Lăng",
  posthumous_name="Chương Nghiêu Văn Triết hoàng đế",
  reigns=[{"dynasty": "Trần", "ordinal": 5, "role": "emperor", "temple_name": "Minh Tông", "start_year": 1314, "end_year": 1329}],
  bio="Tên húy là Mạnh, con thứ tư của Anh Tông. Đích mẫu là Thuận Thánh Bảo Từ hoàng thái hậu, mẹ đẻ là Chiêu Hiến hoàng thái hậu, đều họ Trần. Năm Giáp Dần (1314) được Anh Tông nhường ngôi. Ở ngôi 15 năm, nhường ngôi 28 năm, thọ 58 tuổi, mất ở cung Bảo Nguyên, táng Mục Lăng.",
  citations=[c("existence", 6, f"{MT} — {TD}", "諱奣，英宗弟四子"),
             c("nickname", 6, f"{MT} — {TD}", "諱奣，英宗弟四子", "Trần Mạnh"),
             c("parents", 6, f"{MT} — {TD}", "親生母昭憲皇太后陳氏"),
             c("death", 7, "năm Đinh Dậu (1357)", "丁酉十七年元至正十七年春二月十九日，上皇崩于保元宫", "âm 1357-2-19"),
             c("lifespan", 6, f"{MT} — {TD}", "壽五十八歲", "58"),
             c("burial_place", 6, f"{MT} — {TD}", "崩于葆元宫，塟穆陵", "Mục Lăng"),
             c("posthumous_name", 7, "năm Đinh Dậu (1357)", "廟號明宗，謚曰章堯文哲皇帝", "Chương Nghiêu Văn Triết hoàng đế"),
             c("reign:0", 6, "năm Giáp Dần (1314)", "奣即皇帝位，改元大慶元年"),
             c("reign:0", 6, "năm Kỷ Tỵ (1329)", "十五日，禪位。旺即皇帝位，改元開祐元年"),
             c("bio", 6, f"{MT} — {TD}", "在位十五年，遜位二十八年，壽五十八歲，崩于葆元宫，塟穆陵")])
P(key="tran.hien-tu", full_name="Hiến Từ Tuyên Thánh hoàng thái hậu", gender="F",
  bio="Hoàng hậu của Minh Tông, mẹ Trần Dụ Tông, là đích mẫu của Hiến Tông và Nghệ Tông.",
  citations=[c("existence", 7, f"Trần kỷ, Hiến Tông hoàng đế — {TD}", "嫡母憲慈宣聖皇太后"),
             c("bio", 7, f"Trần kỷ, Dụ Tông hoàng đế — {TD}", "明宗第十子，憲慈皇后所生也")])
U("u.minh-tong--hien-tu", "tran.minh-tong", "tran.hien-tu", 1,
  [c("union", 7, f"Trần kỷ, Dụ Tông hoàng đế — {TD}", "明宗第十子，憲慈皇后所生也")])
P(key="tran.minh-tu", full_name="Minh Từ hoàng thái phi Lê thị", gender="F",
  bio="Phi của Minh Tông, mẹ đẻ của Trần Hiến Tông.",
  citations=[c("existence", 7, f"Trần kỷ, Hiến Tông hoàng đế — {TD}", "親生母明慈皇太妃黎氏也"),
             c("bio", 7, f"Trần kỷ, Hiến Tông hoàng đế — {TD}", "親生母明慈皇太妃黎氏也")],
  review={"status": "draft", "note": "Kiểm: có phải cùng người với thứ phi Lê thị (mẹ Nghệ Tông) hoặc Đôn Từ (mẹ Duệ Tông) không — chưa gộp."})
U("u.minh-tong--minh-tu", "tran.minh-tong", "tran.minh-tu", None,
  [c("union", 7, f"Trần kỷ, Hiến Tông hoàng đế — {TD}", "明宗次子，嫡母憲慈宣聖皇太后，親生母明慈皇太妃黎氏也")])
P(key="tran.minh-tong.thu-phi-le", full_name="Thứ phi Lê thị", gender="F",
  bio="Thứ phi của Minh Tông, mẹ đẻ của Trần Nghệ Tông. Là con gái của người con gái Nguyễn Thánh Huấn lấy chồng họ Lê; cùng mẹ với Hiến Từ hoàng thái hậu.",
  citations=[c("existence", 7, f"Trần kỷ, Nghệ Tông hoàng đế — {TD}", "明宗次妃黎氏者也"),
             c("bio", 7, f"Trần kỷ, Nghệ Tông hoàng đế — {TD}", "親生母與憲慈同母，即阮聖訓女嫁黎氏之所生女，明宗次妃黎氏者也")],
  review={"status": "draft", "note": "Kiểm: có phải cùng người với Minh Từ hoàng thái phi Lê thị (mẹ Hiến Tông) hoặc Đôn Từ không — chưa gộp. Kiểm lại cách hiểu câu 與憲慈同母."})
U("u.minh-tong--thu-phi-le", "tran.minh-tong", "tran.minh-tong.thu-phi-le", None,
  [c("union", 7, f"Trần kỷ, Nghệ Tông hoàng đế — {TD}", "明宗次妃黎氏者也")])
P(key="tran.don-tu", full_name="Đôn Từ hoàng thái phi Lê thị", gender="F",
  death={"lunar_year": 1347, "lunar_month": 8},
  bio="Phi của Minh Tông, mẹ Trần Duệ Tông. Mất tháng 8 năm Đinh Hợi (1347).",
  citations=[c("existence", 7, f"Trần kỷ, Duệ Tông hoàng đế — {TD}", "母惇慈皇太妃"),
             c("death", 7, "năm Đinh Hợi (1347)", "秋八月，惇慈皇太后黎氏崩", "âm 1347-8"),
             c("bio", 7, f"Trần kỷ, Duệ Tông hoàng đế — {TD}", "明宗第十一子，藝宗弟也，母惇慈皇太妃")])
U("u.minh-tong--don-tu", "tran.minh-tong", "tran.don-tu", None,
  [c("union", 7, f"Trần kỷ, Duệ Tông hoàng đế — {TD}", "明宗第十一子，藝宗弟也，母惇慈皇太妃")])
G("lang.muc-lang", "Mục Lăng", ["tran.minh-tong"],
  [c("existence", 6, f"{MT} — {TD}", "崩于葆元宫，塟穆陵"),
   c("location_name", 6, "năm Canh Thân (1320)", "上皇塟安生泰陵在安生山，穆、阜二陵同", "núi Yên Sinh"),
   c("occupant:0", 6, f"{MT} — {TD}", "崩于葆元宫，塟穆陵")],
  location_name="núi Yên Sinh")

# ── 6–9. Các con của Minh Tông ─────────────────────────────────────
HT = "Trần kỷ, Hiến Tông hoàng đế"
P(key="tran.hien-tong", full_name="Trần Hiến Tông", gender="M", parents="u.minh-tong--minh-tu",
  nickname="Trần Vượng",
  death={"lunar_year": 1341, "lunar_month": 6, "lunar_day": 11}, lifespan=23,
  burial_place="Xương An lăng",
  reigns=[{"dynasty": "Trần", "ordinal": 6, "role": "emperor", "temple_name": "Hiến Tông", "start_year": 1329, "end_year": 1341}],
  bio="Tên húy là Vượng, con thứ của Minh Tông, đích mẫu là Hiến Từ Tuyên Thánh hoàng thái hậu, mẹ đẻ là Minh Từ hoàng thái phi họ Lê. Năm Kỷ Tỵ (1329) được Minh Tông nhường ngôi. Ở ngôi 13 năm, thọ 23 tuổi, mất ở chính tẩm, táng Xương An lăng.",
  citations=[c("existence", 7, f"{HT} — {TD}", "諱旺，明宗次子"),
             c("nickname", 7, f"{HT} — {TD}", "諱旺，明宗次子", "Trần Vượng"),
             c("parents", 7, f"{HT} — {TD}", "親生母明慈皇太妃黎氏也"),
             c("death", 7, "năm Tân Tỵ (1341)", "夏六月十一日，帝崩于正寝，權安殯于建昌宫，廟號憲宗", "âm 1341-6-11"),
             c("lifespan", 7, f"{HT} — {TD}", "在位十三年壽二十三", "23"),
             c("burial_place", 7, f"{HT} — {TD}", "崩塟昌安陵", "Xương An lăng"),
             c("reign:0", 6, "năm Kỷ Tỵ (1329)", "旺即皇帝位，改元開祐元年"),
             c("reign:0", 7, "năm Tân Tỵ (1341)", "夏六月十一日，帝崩于正寝"),
             c("bio", 7, f"{HT} — {TD}", "在位十三年壽二十三崩塟昌安陵")])

DT = "Trần kỷ, Dụ Tông hoàng đế"
P(key="tran.du-tong", full_name="Trần Dụ Tông", gender="M", parents="u.minh-tong--hien-tu",
  nickname="Trần Hạo",
  death={"lunar_year": 1369, "lunar_month": 5, "lunar_day": 25}, lifespan=34,
  burial_place="Phụ Lăng, núi Yên Sinh",
  reigns=[{"dynasty": "Trần", "ordinal": 7, "role": "emperor", "temple_name": "Dụ Tông", "start_year": 1341, "end_year": 1369}],
  bio="Tên húy là Hạo, con thứ mười của Minh Tông, do Hiến Từ hoàng hậu sinh ra. Năm Tân Tỵ (1341) lên ngôi sau khi Hiến Tông mất. Ở ngôi 28 năm, thọ 34 tuổi, táng Phụ Lăng. Mất không có con nối, để chiếu đón Dương Nhật Lễ vào nối ngôi.",
  citations=[c("existence", 7, f"{DT} — {TD}", "諱暭，明宗第十子"),
             c("nickname", 7, f"{DT} — {TD}", "諱暭，明宗第十子", "Trần Hạo"),
             c("parents", 7, f"{DT} — {TD}", "明宗第十子，憲慈皇后所生也"),
             c("death", 7, "năm Kỷ Dậu (1369)", "二十五日，帝崩于正寝，廟號裕宗", "âm 1369-5-25"),
             c("lifespan", 7, f"{DT} — {TD}", "壽三十四而崩", "34"),
             c("burial_place", 7, f"{DT} — {TD}", "壽三十四而崩，塟阜陵", "Phụ Lăng, núi Yên Sinh"),
             c("burial_place", 6, "năm Canh Thân (1320)", "穆、阜二陵同", "Phụ Lăng, núi Yên Sinh"),
             c("reign:0", 7, "năm Tân Tỵ (1341)", "秋八月二十一日，上皇迎皇子暭即皇帝位，改元紹豊元年"),
             c("reign:0", 7, "năm Kỷ Dậu (1369)", "二十五日，帝崩于正寝"),
             c("bio", 7, f"{DT} — {TD}", "在位二十八年，壽三十四而崩，塟阜陵"),
             c("bio", 7, "năm Kỷ Dậu (1369)", "臨崩之日，以無嗣，詔迎日禮入繼統")])

NG = "Trần kỷ, Nghệ Tông hoàng đế"
P(key="tran.nghe-tong", full_name="Trần Nghệ Tông", gender="M", parents="u.minh-tong--thu-phi-le",
  nickname="Trần Phủ",
  death={"lunar_year": 1394, "lunar_month": 12, "lunar_day": 15}, lifespan=74,
  burial_place="Nguyên Lăng, Yên Sinh",
  posthumous_name="Quang Nghiêu Anh Triết hoàng đế",
  reigns=[{"dynasty": "Trần", "ordinal": 8, "role": "emperor", "temple_name": "Nghệ Tông", "start_year": 1370, "end_year": 1372}],
  bio="Tên húy là Phủ, con thứ ba của Minh Tông, đích mẫu là Hiến Từ Tuyên Thánh hoàng thái hậu, mẹ đẻ là thứ phi họ Lê. Dẹp loạn Dương Nhật Lễ, năm Canh Tuất (1370) lên ngôi. Ở ngôi 3 năm, nhường ngôi 27 năm, thọ 74 tuổi, táng Nguyên Lăng ở Yên Sinh.",
  citations=[c("existence", 7, f"{NG} — {TD}", "諱暊，明宗第三子也"),
             c("nickname", 7, f"{NG} — {TD}", "諱暊，明宗第三子也", "Trần Phủ"),
             c("parents", 7, f"{NG} — {TD}", "明宗次妃黎氏者也"),
             c("death", 8, "năm Giáp Tuất (1394)", "十二月十五日，上皇崩塟安生原陵", "âm 1394-12-15"),
             c("lifespan", 7, f"{NG} — {TD}", "在位三年，遜位二十七年，壽七十四", "74"),
             c("burial_place", 8, "năm Giáp Tuất (1394)", "上皇崩塟安生原陵", "Nguyên Lăng, Yên Sinh"),
             c("posthumous_name", 8, "năm Giáp Tuất (1394)", "號藝宗，謚曰光堯英哲皇帝", "Quang Nghiêu Anh Triết hoàng đế"),
             c("reign:0", 7, "năm Canh Tuất (1370)", "十五日，即皇帝位，改元大赦，稱義皇"),
             c("reign:0", 7, "năm Nhâm Tý (1372)", "十一月九日，帝禪位于皇太子曔"),
             c("bio", 7, f"{NG} — {TD}", "帝削平内難，光復洪圖")])

DU = "Trần kỷ, Duệ Tông hoàng đế"
P(key="tran.due-tong", full_name="Trần Duệ Tông", gender="M", parents="u.minh-tong--don-tu",
  nickname="Trần Kính",
  birth={"lunar_year": 1337, "lunar_month": 6, "lunar_day": 2},
  death={"lunar_year": 1377, "lunar_month": 1}, lifespan=41,
  burial_place="Hy Lăng (táng chiêu hồn)",
  reigns=[{"dynasty": "Trần", "ordinal": 9, "role": "emperor", "temple_name": "Duệ Tông", "start_year": 1372, "end_year": 1377}],
  bio="Tên húy là Kính, con thứ mười một của Minh Tông, em Nghệ Tông, mẹ là Đôn Từ hoàng thái phi. Sinh ngày 2 tháng 6 năm Đinh Sửu (1337). Có công giúp Nghệ Tông dẹp loạn nên được nhường ngôi năm Nhâm Tý (1372). Tháng Giêng năm Đinh Tỵ (1377) thân chinh Chiêm Thành, tử trận ở thành Đồ Bàn. Ở ngôi 4 năm, thọ 41 tuổi, táng chiêu hồn ở Hy Lăng.",
  citations=[c("existence", 7, f"{DU} — {TD}", "諱曔，明宗第十一子，藝宗弟也"),
             c("nickname", 7, f"{DU} — {TD}", "諱曔，明宗第十一子", "Trần Kính"),
             c("parents", 7, f"{DU} — {TD}", "母惇慈皇太妃"),
             c("birth", 7, f"{DU} — {TD}", "以開祐九年丁丑六月二日誕生", "âm 1337-6-2"),
             c("death", 7, "năm Đinh Tỵ (1377)", "賊乘勢突出截之，巳時官軍大潰，帝陷于陣崩", "âm 1377-1",
               note="Mạch văn: tháng Giêng, ngày 24 tiến quân rồi tử trận; chỉ ghi năm + tháng."),
             c("lifespan", 7, f"{DU} — {TD}", "在位四年，壽四十一", "41"),
             c("burial_place", 7, "năm Đinh Tỵ (1377)", "招魂，塟熙陵，廟號睿宗", "Hy Lăng (táng chiêu hồn)"),
             c("reign:0", 7, "năm Nhâm Tý (1372)", "曔即皇帝位，大赦，稱欽皇"),
             c("reign:0", 7, "năm Đinh Tỵ (1377)", "帝陷于陣崩"),
             c("bio", 7, f"{DU} — {TD}", "藝宗避乱時，師徒軍噐皆帝之力，故以位遜之"),
             c("bio", 7, "năm Đinh Tỵ (1377)", "大軍至占城尸耐混港口石橋次倚忙洞，蓬峩立栅闍槃城外"),
             c("bio", 7, "năm Đinh Tỵ (1377)", "招魂，塟熙陵")])
P(key="tran.gia-tu", full_name="Gia Từ hoàng hậu Lê thị", gender="F",
  death={"lunar_year": 1381, "lunar_month": 10},
  bio="Hoàng hậu của Duệ Tông, em họ của Lê Quý Ly, mẹ Phế Đế. Duệ Tông đi đánh phương Nam không về, bà cắt tóc làm ni. Mất tháng 10 năm Tân Dậu (1381) ở am phía tây chùa Chiêu Khánh, hương Long Đàm.",
  citations=[c("existence", 8, f"Trần kỷ, Phế Đế — {TD}", "睿宗長子，母嘉慈皇后黎氏"),
             c("death", 8, "năm Tân Dậu (1381)", "嘉慈皇后崩于龍潭鄉昭慶寺", "âm 1381-10"),
             c("bio", 8, "năm Mậu Thìn (1388)", "睿宗后黎氏，靈德之母，黎季犛之從妹也。睿宗南征不返，后遂削髮為尼"),
             c("bio", 8, "năm Tân Dậu (1381)", "嘉慈皇后崩于龍潭鄉昭慶寺")])
U("u.due-tong--gia-tu", "tran.due-tong", "tran.gia-tu", 1,
  [c("union", 8, "năm Mậu Thìn (1388)", "睿宗后黎氏，靈德之母")])

# ── 10. Phế Đế ─────────────────────────────────────────────────────
PD = "Trần kỷ, Phế Đế"
P(key="tran.phe-de", full_name="Trần Phế Đế", gender="M", parents="u.due-tong--gia-tu",
  nickname="Trần Hiện",
  birth={"lunar_year": 1361, "lunar_month": 3, "lunar_day": 6},
  death={"lunar_year": 1388}, lifespan=28,
  burial_place="Lăng ở núi An Bài",
  titles=[{"title": "Linh Đức đại vương", "from_year": 1388}],
  reigns=[{"dynasty": "Trần", "ordinal": 10, "role": "emperor", "start_year": 1377, "end_year": 1388}],
  bio="Tên húy là Hiện, con trưởng của Duệ Tông, mẹ là Gia Từ hoàng hậu họ Lê. Sinh ngày 6 tháng 3 năm Tân Sửu (1361). Duệ Tông mất ở phương Nam, Nghệ Tông lập lên ngôi. Năm Mậu Thìn (1388) bị Nghệ Tông giáng làm Linh Đức đại vương rồi bị thắt cổ chết. Ở ngôi 12 năm, thọ 28 tuổi, táng ở núi An Bài.",
  citations=[c("existence", 8, f"{PD} — {TD}", "諱晛，睿宗長子"),
             c("nickname", 8, f"{PD} — {TD}", "諱晛，睿宗長子", "Trần Hiện"),
             c("parents", 8, f"{PD} — {TD}", "睿宗長子，母嘉慈皇后黎氏"),
             c("birth", 8, f"{PD} — {TD}", "以大治四年辛丑三月六日誕生", "âm 1361-3-6"),
             c("death", 8, "năm Mậu Thìn (1388)", "有頃，扶下太陽府縊之", "âm 1388",
               note="Tiêu đề năm trên văn bản Wikisource chép 戊戌, nhưng cùng dòng ghi 昌符十二年 / 明洪武二十一年 = 1388 (Mậu Thìn) — kiểm lại bản in."),
             c("lifespan", 8, f"{PD} — {TD}", "在位十二年，壽二十八", "28"),
             c("burial_place", 8, f"{PD} — {TD}", "壽二十八，葬安排山", "Lăng ở núi An Bài"),
             c("title:0", 8, "năm Mậu Thìn (1388)", "可降為灵德大王"),
             c("reign:0", 7, "năm Đinh Tỵ (1377)", "夏五月十三日，上皇以帝當國難崩，立帝長子建德大王暊為嗣，即皇帝位",
               note="Nguyên văn chép tên 暊 ở đây; tiểu dẫn Phế Đế chép húy 晛 — kiểm lại."),
             c("reign:0", 8, "năm Mậu Thìn (1388)", "二十七日，上皇立少子昭定王顒為皇帝"),
             c("bio", 8, f"{PD} — {TD}", "及睿宗南征而崩，藝宗立之。後降為靈德王，尋令縊殺之。在位十二年，壽二十八，葬安排山")])

# ── 11. Thuận Tông ─────────────────────────────────────────────────
TU = "Trần kỷ, Thuận Tông hoàng đế"
U("u.nghe-tong--khuyet", "tran.nghe-tong")
P(key="tran.thuan-tong", full_name="Trần Thuận Tông", gender="M", parents="u.nghe-tong--khuyet",
  nickname="Trần Ngung",
  death={"lunar_year": 1399}, lifespan=22,
  burial_place="An Sinh lăng",
  reigns=[{"dynasty": "Trần", "ordinal": 11, "role": "emperor", "temple_name": "Thuận Tông", "start_year": 1388, "end_year": 1398}],
  bio="Tên húy là Ngung, con út của Nghệ Tông. Năm Mậu Thìn (1388) được Nghệ Tông lập làm vua. Ở ngôi hơn 9 năm, chính sự ở trong tay quyền thần. Năm Mậu Dần (1398) bị Lê Quý Ly ép nhường ngôi, năm Kỷ Mão (1399) bị ép xuất gia rồi bị giết, thọ 22 tuổi.",
  citations=[c("existence", 8, f"{TU} — {TD}", "諱顒，藝宗季子也"),
             c("nickname", 8, f"{TU} — {TD}", "諱顒，藝宗季子也", "Trần Ngung"),
             c("parents", 8, f"{TU} — {TD}", "藝宗季子也"),
             c("death", 8, "năm Kỷ Mão (1399)", "至是令軍騎衛上將軍范可永縊之。塟安生陵，廟號順宗", "âm 1399"),
             c("lifespan", 8, f"{TU} — {TD}", "出家歲餘，季犛殺之，壽二十二", "22"),
             c("burial_place", 8, "năm Kỷ Mão (1399)", "塟安生陵，廟號順宗", "An Sinh lăng"),
             c("reign:0", 8, "năm Mậu Thìn (1388)", "顒即位改元光泰元年，大赦，稱元皇"),
             c("reign:0", 8, "năm Mậu Dần (1398)", "黎季犛逼帝禪位于皇太子𤇼"),
             c("bio", 8, f"{TU} — {TD}", "在位九年有奇，出家歲餘，季犛殺之，壽二十二"),
             c("bio", 8, "năm Kỷ Mão (1399)", "季犛逼令帝出家，奉道教居淡水村玉清觀")])
P(key="tran.thanh-ngau", full_name="Thánh Ngẫu hoàng hậu", gender="F",
  bio="Con gái trưởng của Lê Quý Ly. Tháng Giêng năm Kỷ Tỵ (1389) được lập làm hoàng hậu của Thuận Tông.",
  titles=[{"title": "Hoàng hậu", "from_year": 1389}],
  citations=[c("existence", 8, "năm Kỷ Tỵ (1389)", "立季犛長女聖偶為皇后"),
             c("title:0", 8, "năm Kỷ Tỵ (1389)", "立季犛長女聖偶為皇后，號所居曰皇元殿"),
             c("bio", 8, "năm Kỷ Tỵ (1389)", "己巳光泰二年明洪武二十二年春正月，立季犛長女聖偶為皇后")])
U("u.thuan-tong--thanh-ngau", "tran.thuan-tong", "tran.thanh-ngau", 1,
  [c("union", 8, "năm Kỷ Tỵ (1389)", "立季犛長女聖偶為皇后")])
links.append({"person": "tran.thanh-ngau", "other_clan": "ho", "other_person": "ho.thanh-ngau",
              "note": "Con gái trưởng Lê (Hồ) Quý Ly, hoàng hậu của Trần Thuận Tông",
              "citations": [c("same_person", 8, "năm Kỷ Tỵ (1389)", "立季犛長女聖偶為皇后")], "review": DRAFT})

# ── 12. Thiếu Đế ───────────────────────────────────────────────────
TD12 = "Trần kỷ, Thiếu Đế"
U("u.thuan-tong--khuyet", "tran.thuan-tong")
P(key="tran.thieu-de", full_name="Trần Thiếu Đế", gender="M", parents="u.thuan-tong--khuyet",
  nickname="Trần Án",
  titles=[{"title": "Bảo Ninh đại vương", "from_year": 1400}],
  reigns=[{"dynasty": "Trần", "ordinal": 12, "role": "emperor", "start_year": 1398, "end_year": 1400}],
  bio="Tên là Án, con Thuận Tông. Năm Mậu Dần (1398) Lê Quý Ly ép Thuận Tông nhường ngôi cho; khi ấy mới ba tuổi. Ở ngôi 2 năm; Quý Ly cướp ngôi, phế làm Bảo Ninh đại vương. Nhà Trần mất từ đây.",
  citations=[c("existence", 8, f"{TD12} — {TD}", "名𤇼，順宗子也，在位二年"),
             c("nickname", 8, f"{TD12} — {TD}", "名𤇼，順宗子也", "Trần Án", note="Toàn thư chép 名 (tên)"),
             c("parents", 8, f"{TD12} — {TD}", "名𤇼，順宗子也"),
             c("title:0", 8, f"{TD12} — {TD}", "季犛篡位，廢為保寕大王"),
             c("reign:0", 8, "năm Mậu Dần (1398)", "皇太子𤇼即位於葆清宫，改元建新元年"),
             c("reign:0", 8, "năm Canh Thìn (1400)", "庚辰三年是歲陳亡"),
             c("bio", 8, "năm Mậu Dần (1398)", "時太子生甫三歲，受禪不能拜"),
             c("bio", 8, f"{TD12} — {TD}", "在位二年。季犛篡位，廢為保寕大王")])

# Lăng của các vua đời sau (có trong tiểu dẫn / chính văn)
for key, name, who, vol, where, quote, loc in [
    ("lang.xuong-an", "Xương An lăng", "tran.hien-tong", 7, f"{HT} — {TD}", "崩塟昌安陵", None),
    ("lang.phu-lang", "Phụ Lăng", "tran.du-tong", 7, f"{DT} — {TD}", "壽三十四而崩，塟阜陵", "núi Yên Sinh"),
    ("lang.nguyen-lang", "Nguyên Lăng", "tran.nghe-tong", 8, "năm Giáp Tuất (1394)", "上皇崩塟安生原陵", "Yên Sinh"),
    ("lang.hy-lang", "Hy Lăng", "tran.due-tong", 7, "năm Đinh Tỵ (1377)", "招魂，塟熙陵", None),
    ("lang.an-sinh", "An Sinh lăng", "tran.thuan-tong", 8, "năm Kỷ Mão (1399)", "塟安生陵，廟號順宗", None),
]:
    cites = [c("existence", vol, where, quote), c("occupant:0", vol, where, quote)]
    if key == "lang.phu-lang":
        cites.append(c("location_name", 6, "năm Canh Thân (1320)", "上皇塟安生泰陵在安生山，穆、阜二陵同", "núi Yên Sinh"))
    if key == "lang.nguyen-lang":
        cites.append(c("location_name", 8, "năm Giáp Tuất (1394)", "上皇崩塟安生原陵", "Yên Sinh"))
    G(key, name, [who], cites, location_name=loc)
G("lang.an-bai", "Lăng ở núi An Bài", ["tran.phe-de"],
  [c("existence", 8, f"{PD} — {TD}", "葬安排山"), c("occupant:0", 8, "năm Kỷ Tỵ (1389)", "二月，塟靈德大王于安排"),
   c("location_name", 8, f"{PD} — {TD}", "葬安排山", "núi An Bài")],
  location_name="núi An Bài")

heritage = []
exec(open(__file__.replace("gen_tran.py", "gen_tran_ext.py"), encoding="utf8").read())

data = {
    "clan": {"key": "tran", "name": "Nhà Trần (1225–1400)", "category": "royal",
             "description": "Gia phả các đời vua nhà Trần theo Đại Việt sử ký toàn thư. Mỗi dữ kiện có trích dẫn nguyên văn; xem dòng \"Theo:\" cuối tiểu sử."},
    "persons": persons,
    "unions": unions,
    "resting_places": graves,
    "heritage": heritage,
    "events": [],
    "same_person_links": links,
}
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(persons)} người, {len(unions)} hôn nhân, {len(graves)} lăng, {len(links)} thông gia")
