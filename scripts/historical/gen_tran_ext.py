# ── PHẦN MỞ RỘNG: nguồn thứ hai (Cương mục, Việt sử lược) + các nhánh + di sản ──
# Được exec trong gen_tran.py (dùng chung P, U, G, c, DRAFT, persons, unions, graves).

def cm(field, vol, where, quote, value=None, note=None):
    d = {"field": field, "source": "CM", "locator": f"Chính biên Q.{vol}, {where}", "quote": quote}
    if value is not None:
        d["value"] = value
    if note:
        d["note"] = note
    return d


def vsl(field, quote, note=None):
    d = {"field": field, "source": "VSL", "locator": "Phụ lục Trần triều kỷ niên (附陳朝紀年)", "quote": quote}
    if note:
        d["note"] = note
    return d


BY = {p["key"]: p for p in persons}
GBY = {g["key"]: g for g in graves}


def add(key, *cites, **fields):
    p = BY[key]
    p["citations"].extend(cites)
    p.update(fields)


def gadd(key, *cites, occupants=None):
    g = GBY[key]
    g["citations"].extend(cites)
    if occupants:
        g["occupants"].extend(occupants)


def eras(key, *items):
    BY[key]["reigns"][0]["era_names"] = [{"name": n, "from_year": y} for n, y in items]


# Trần Thừa + vợ
add("tran.thua",
    cm("death", 6, "năm Giáp Ngọ (1234)", "三年宋端平元年春正月，上皇崩", "âm 1234-1"),
    cm("lifespan", 6, "năm Giáp Ngọ (1234)", "廟號徽宗，壽五十一", "51"),
    cm("posthumous_name", 6, "năm Giáp Ngọ (1234)", "諡曰開運立極弘仁應道純眞至德神武聖文垂裕至孝皇帝",
       "Khai Vận Lập Cực Hoằng Nhân Ứng Đạo Thuần Chân Chí Đức Thần Vũ Thánh Văn Thùy Dụ Chí Hiếu hoàng đế",
       note="Cương mục chép 弘仁, Toàn thư chép 弘人 — cùng âm Hoằng Nhân."))
add("tran.thua.le-thi",
    c("existence", 5, "năm Canh Dần (1230)", "九月，國聖皇太后崩，追尊順慈皇太后"),
    c("death", 5, "năm Canh Dần (1230)", "九月，國聖皇太后崩，追尊順慈皇太后", "âm 1230-9"),
    cm("death", 6, "năm Canh Dần (1230)", "秋九月，國聖皇太后黎氏崩", "âm 1230-9",
       note="Cương mục ghi rõ họ Lê → chính là Lê thị, mẹ Thái Tông."),
    c("posthumous_name", 5, "năm Canh Dần (1230)", "追尊順慈皇太后", "Thuận Từ hoàng thái hậu"),
    cm("posthumous_name", 10, "năm Quý Sửu (1373)", "陳太祖后諡順慈", "Thuận Từ hoàng thái hậu"),
    c("title:0", 5, "năm Canh Dần (1230)", "國聖皇太后崩"),
    death={"lunar_year": 1230, "lunar_month": 9},
    posthumous_name="Thuận Từ hoàng thái hậu",
    titles=[{"title": "Quốc Thánh hoàng thái hậu"}],
    bio="Vợ Trần Thừa, mẹ Trần Thái Tông, họ Lê. Khi con làm vua được tôn là Quốc Thánh hoàng thái hậu. Mất tháng 9 năm Canh Dần (1230), truy tôn là Thuận Từ hoàng thái hậu.")
BY["tran.thua.le-thi"]["citations"].append(cm("bio", 6, "năm Canh Dần (1230)", "秋九月，國聖皇太后黎氏崩"))

# Thái Tông
add("tran.thai-tong",
    cm("death", 7, "năm Đinh Sửu (1277)", "夏四月，上皇崩", "âm 1277-4"),
    cm("posthumous_name", 7, "năm Đinh Sửu (1277)", "諡曰統天御極隆功茂德顯和佑順神文聖武元孝皇帝，廟號太宗",
       "Thống Thiên Ngự Cực Long Công Mậu Đức Hiển Hòa Hựu Thuận Thần Văn Thánh Vũ Nguyên Hiếu hoàng đế"),
    cm("reign:0", 6, "năm Mậu Ngọ (1258)", "二月，帝禪位於皇太子晃"),
    vsl("reign:0", "乙酉建中元年 凡七年"), vsl("reign:0", "天應政平元年壬辰 凡十九年"), vsl("reign:0", "元豐元年辛亥 凡七年"))
eras("tran.thai-tong", ("Kiến Trung", 1225), ("Thiên Ứng Chính Bình", 1232), ("Nguyên Phong", 1251))
for k in ("u.thai-tong--chieu-thanh",):
    next(u for u in unions if u["key"] == k)["citations"].append(cm("union", 6, "năm Bính Tuất (1226)", "春正月，冊李昭皇爲昭聖皇后"))

# Thánh Tông — Cương mục bổ sung thụy hiệu (Toàn thư không chép)
add("tran.thanh-tong",
    cm("death", 8, "năm Canh Dần (1290)", "夏五月，上皇崩", "âm 1290-5"),
    cm("posthumous_name", 8, "năm Canh Dần (1290)", "諡曰玄功盛德仁明文武宣孝皇帝，廟號聖宗",
       "Huyền Công Thịnh Đức Nhân Minh Văn Vũ Tuyên Hiếu hoàng đế"),
    cm("reign:0", 6, "năm Mậu Ngọ (1258)", "太子卽位，尊帝爲顯堯聖壽太上皇帝"),
    cm("reign:0", 7, "năm Mậu Dần (1278)", "冬十月，帝禪位于太子昑"),
    vsl("reign:0", "紹隆元年戊午 凡十五年"), vsl("reign:0", "寳符元年癸酉 凡六年"),
    posthumous_name="Huyền Công Thịnh Đức Nhân Minh Văn Vũ Tuyên Hiếu hoàng đế")
eras("tran.thanh-tong", ("Thiệu Long", 1258), ("Bảo Phù", 1273))
add("tran.thien-cam", cm("death", 8, "năm Đinh Hợi (1287)", "三年元至元二十四年春二月，元聖天感皇太后陳氏崩", "âm 1287-2"))

# Nhân Tông
add("tran.nhan-tong",
    cm("reign:0", 7, "năm Mậu Dần (1278)", "太子卽位，稱孝皇"),
    cm("reign:0", 8, "năm Quý Tỵ (1293)", "春三月，帝禪位于太子烇"),
    vsl("reign:0", "紹寳元年己夘 凡六年"), vsl("reign:0", "重興元年乙酉 凡八年"))
eras("tran.nhan-tong", ("Thiệu Bảo", 1279), ("Trùng Hưng", 1285))
add("tran.khiem-tu", cm("death", 8, "năm Quý Tỵ (1293)", "秋九月，欽慈保聖皇太后陳氏崩", "âm 1293-9"))

# Anh Tông
add("tran.anh-tong",
    cm("death", 9, "năm Canh Thân (1320)", "七年元延祐七年春三月，上皇崩", "âm 1320-3"),
    cm("posthumous_name", 9, "năm Canh Thân (1320)", "遂崩于重光宮，諡顯文睿武欽明仁孝皇帝，廟號英宗",
       "Hiển Văn Duệ Vũ Khâm Minh Nhân Hiếu hoàng đế"),
    cm("reign:0", 8, "năm Quý Tỵ (1293)", "太子旣卽位，稱英皇"),
    cm("reign:0", 9, "năm Giáp Dần (1314)", "詔禪位於太子奣"),
    vsl("reign:0", "興隆元年癸巳 凡二十一年"))
eras("tran.anh-tong", ("Hưng Long", 1293))
add("tran.thuan-thanh",
    cm("death", 9, "năm Canh Ngọ (1330)", "秋七月，順聖保慈皇太后陳氏崩", "âm 1330-7"),
    c("parents", 6, "Trần kỷ, Minh Tông hoàng đế — tiểu dẫn", "嫡母順聖保慈皇太后陳氏，興讓大王國顙之女也"),
    cm("parents", 9, "năm Kỷ Dậu (1309)", "后，興讓王國顙女也"),
    cm("burial_place", 9, "năm Nhâm Thân (1332)", "春二月，合葬順聖保慈皇太后于泰陵", "Thái Lăng (hợp táng)"),
    parents="u.quoc-tang--khuyet", burial_place="Thái Lăng (hợp táng)")
gadd("lang.thai-lang", cm("occupant:1", 9, "năm Nhâm Thân (1332)", "春二月，合葬順聖保慈皇太后于泰陵"),
     cm("existence", 9, "năm Canh Thân (1320)", "十二月，葬泰陵"), occupants=["tran.thuan-thanh"])

# Minh Tông
add("tran.minh-tong",
    cm("death", 10, "năm Đinh Dậu (1357)", "十七年元至正十七年春二月，上皇崩", "âm 1357-2"),
    cm("posthumous_name", 10, "năm Đinh Dậu (1357)", "崩于葆元宮，諡章堯文哲皇帝，廟號明宗", "Chương Nghiêu Văn Triết hoàng đế"),
    cm("reign:0", 9, "năm Giáp Dần (1314)", "太子旣卽位，稱寧皇"),
    cm("reign:0", 9, "năm Kỷ Tỵ (1329)", "立子旺爲皇太子，詔禪位"),
    vsl("reign:0", "大慶元年甲寅 凡十年"), vsl("reign:0", "開泰元年甲子 凡五年"))
eras("tran.minh-tong", ("Đại Khánh", 1314), ("Khai Thái", 1324))

# Hiến Tông — dị bản tên lăng
add("tran.hien-tong",
    cm("death", 9, "năm Tân Tỵ (1341)", "夏六月，帝崩，廟號憲宗，在位十三年，壽二十三", "âm 1341-6"),
    cm("lifespan", 9, "năm Tân Tỵ (1341)", "廟號憲宗，在位十三年，壽二十三", "23"),
    cm("burial_place", 9, "năm Giáp Thân (1344)", "註：安陵，在建昌府", "An lăng",
       note="Toàn thư chép 昌安陵 (Xương An lăng), Cương mục chép 安陵 (An lăng) — dị bản."),
    cm("reign:0", 9, "năm Kỷ Tỵ (1329)", "太子旣卽位，稱哲皇"),
    vsl("reign:0", "開祐元年己巳 凡十二年"))
eras("tran.hien-tong", ("Khai Hựu", 1329))
gadd("lang.xuong-an", cm("existence", 9, "năm Giáp Thân (1344)", "吳士連曰：天子七月而葬，憲宗至是始葬四年矣",
                         note="Cương mục chép tên lăng là 安陵 (An lăng)."))
GBY["lang.xuong-an"]["notes"] = "Toàn thư gọi là Xương An lăng, Cương mục gọi là An lăng. Theo Cương mục, năm Giáp Thân (1344) mới táng, bốn năm sau khi Hiến Tông mất."
GBY["lang.xuong-an"]["citations"].append(cm("notes", 9, "năm Giáp Thân (1344)", "憲宗至是始葬四年矣"))
GBY["lang.xuong-an"]["location_name"] = "phủ Kiến Xương"
GBY["lang.xuong-an"]["citations"].append(cm("location_name", 9, "năm Giáp Thân (1344)", "註：安陵，在建昌府", "phủ Kiến Xương",
                                            note="Lời chú của sử thần triều Nguyễn (thế kỷ 19)."))

# Dụ Tông
add("tran.du-tong",
    cm("death", 10, "năm Kỷ Dậu (1369)", "及帝崩，無嗣，遺詔日禮繼統", "âm 1369"),
    cm("reign:0", 9, "năm Tân Tỵ (1341)", "秋八月，皇弟皥卽位"),
    vsl("reign:0", "紹豐元年辛巳 凡五年"), vsl("reign:0", "大治元年戊戌 凡十一年",
        note="Việt sử lược ghi Thiệu Phong 'phàm 5 năm' nhưng Đại Trị mới bắt đầu năm Mậu Tuất (1358) — số năm chưa khớp, kiểm lại."))
eras("tran.du-tong", ("Thiệu Phong", 1341), ("Đại Trị", 1358))
gadd("lang.phu-lang", cm("existence", 10, "năm Kỷ Dậu (1369)", "冬十一月，葬阜陵"))

# Nghệ Tông — dị bản tháng mất
add("tran.nghe-tong",
    cm("death", 11, "năm Giáp Tuất (1394)", "十一月，上皇崩，葬原陵，諡光堯英哲皇帝，廟號藝宗", "âm 1394-11",
       note="Toàn thư chép ngày 15 tháng 12; Cương mục chép tháng 11 và chú 崩葬同在一月 — dị bản."),
    cm("posthumous_name", 11, "năm Giáp Tuất (1394)", "諡光堯英哲皇帝，廟號藝宗", "Quang Nghiêu Anh Triết hoàng đế"),
    cm("reign:0", 10, "năm Canh Tuất (1370)", "卽位改元，大赦，稱義皇"),
    cm("reign:0", 10, "năm Nhâm Tý (1372)", "十一月，帝禪位于太子曔"),
    vsl("reign:0", "紹慶元年庚戌 凡三年", note="Việt sử lược gọi Nghệ Tông là 太王."))
eras("tran.nghe-tong", ("Thiệu Khánh", 1370))
gadd("lang.nguyen-lang", cm("existence", 11, "năm Giáp Tuất (1394)", "十一月，上皇崩，葬原陵"))

# Duệ Tông, Gia Từ, Phế Đế, Thuận Tông, Thiếu Đế
add("tran.due-tong",
    cm("death", 10, "năm Đinh Tỵ (1377)", "明洪武十年春正月，進攻闍槃城，敗績，帝崩于軍", "âm 1377-1"),
    cm("reign:0", 10, "năm Nhâm Tý (1372)", "太子卽位，稱欽皇"),
    vsl("reign:0", "隆慶元年癸丑 凡三年"))
eras("tran.due-tong", ("Long Khánh", 1373))
add("tran.gia-tu", cm("death", 10, "năm Tân Dậu (1381)", "冬十月，嘉慈皇后黎氏崩", "âm 1381-10"))
add("tran.phe-de", cm("reign:0", 10, "năm Đinh Tỵ (1377)", "夏五月，皇子晛卽位"),
    vsl("reign:0", "昌符元年丁巳", note="Việt sử lược gọi Phế Đế là 今王 (vua đương thời) — sách soạn dưới triều này."))
eras("tran.phe-de", ("Xương Phù", 1377))
add("tran.thuan-tong", cm("reign:0", 11, "năm Mậu Thìn (1388)", "旣卽位，稱元皇是爲順宗"),
    cm("reign:0", 11, "năm Mậu Dần (1398)", "季犛逼帝禪位于皇太子"))
eras("tran.thuan-tong", ("Quang Thái", 1388))
add("tran.thieu-de", cm("reign:0", 11, "năm Mậu Dần (1398)", "太子卽位，尊欽聖皇后爲皇太后，季犛自稱大王攝政"))
eras("tran.thieu-de", ("Kiến Tân", 1398))

# Lăng: Cương mục xác nhận
gadd("lang.tho-lang", cm("existence", 6, "năm Giáp Ngọ (1234)", "秋八月，葬壽陵"))
gadd("lang.chieu-lang", cm("existence", 7, "năm Đinh Sửu (1277)", "冬十月，葬昭陵"))
gadd("lang.du-lang", cm("existence", 8, "năm Canh Dần (1290)", "十二月，葬裕陵"))
gadd("lang.duc-lang", cm("existence", 9, "năm Canh Tuất (1310)", "十八年元至大三年秋九月，葬德陵"))
gadd("lang.muc-lang", cm("existence", 10, "năm Đinh Dậu (1357)", "冬十一月，葬穆陵"))

# ── Các nhánh ngoài trục vua ──────────────────────────────────────
TD5 = "Trần kỷ, Thái Tông hoàng đế"
U("u.thua--khuyet", "tran.thua")
P(key="tran.lieu", full_name="Trần Liễu", gender="M", parents="u.thua--khuyet",
  death={"lunar_year": 1251, "lunar_month": 4}, lifespan=41,
  titles=[{"title": "Hoài vương"}, {"title": "Yên Sinh vương", "from_year": 1237}, {"title": "Đại vương", "from_year": 1251}],
  bio="Anh của Thái Tông. Năm Đinh Dậu (1237) vợ là công chúa Thuận Thiên bị lấy làm hoàng hậu, Liễu họp quân làm loạn ở sông Cái, rồi được giảng hoà, phong đất làm thang mộc ấp, hiệu Yên Sinh vương. Mất tháng 4 năm Tân Hợi (1251), thọ 41 tuổi, gia phong Đại vương.",
  citations=[c("existence", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻順天公主李氏為順天皇后"),
             c("parents", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻順天公主李氏",
               note="Là anh (兄) của Thái Tông → con Trần Thừa; sử không chép mẹ."),
             cm("parents", 6, "năm Mậu Tý (1228)", "秋八月，以兄柳爲太尉"),
             c("death", 5, "năm Tân Hợi (1251)", "夏四月，安生王柳卒，年四十一，加大王", "âm 1251-4"),
             c("lifespan", 5, "năm Tân Hợi (1251)", "安生王柳卒，年四十一", "41"),
             c("title:0", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻"),
             c("title:1", 5, "năm Đinh Dậu (1237)", "為柳湯沐邑，因封其地號安生王"),
             c("title:2", 5, "năm Tân Hợi (1251)", "年四十一，加大王"),
             c("bio", 5, "năm Đinh Dậu (1237)", "柳於是聚眾，下大江作亂"),
             c("bio", 5, "năm Đinh Dậu (1237)", "以安阜、安養、安生、安興、安邦之地為柳湯沐邑")])
U("u.lieu--thuan-thien", "tran.lieu", "tran.thuan-thien", 1,
  [c("union", 5, "năm Đinh Dậu (1237)", "納兄懷王柳妻順天公主李氏為順天皇后")])
U("u.lieu--khuyet", "tran.lieu")
add("tran.thien-cam", c("parents", 5, "năm Mậu Ngọ (1258)", "納安生王第五女韶為天感夫人"),
    parents="u.lieu--khuyet")

P(key="tran.quoc-khang", full_name="Trần Quốc Khang", gender="M",
  parents="u.lieu--thuan-thien", adoptive_parents="u.thai-tong--thuan-thien",
  titles=[{"title": "Tĩnh Quốc đại vương"}],
  bio="Con của Thuận Thiên. Khi Thái Tông lấy Thuận Thiên làm hoàng hậu năm Đinh Dậu (1237), bà đã có mang Quốc Khang ba tháng; Quốc Khang được kể là con trưởng của Thái Tông, anh của Thánh Tông. Sau phong Tĩnh Quốc đại vương.",
  citations=[c("existence", 5, "năm Tân Sửu (1241)", "國康其長兄也，後並封大王"),
             c("parents", 5, "năm Đinh Dậu (1237)", "時昭聖無子，而順天懷娠國康三月",
               note="Mẹ đang có mang khi về với Thái Tông → cha đẻ là Trần Liễu."),
             cm("parents", 6, "năm Canh Tý (1240)", "李氏懷娠，帝納之，生子，是爲國康"),
             c("adoptive_parents", 5, "năm Tân Sửu (1241)", "國康其長兄也"),
             cm("adoptive_parents", 7, "năm Tân Dậu (1261)", "帝兄國康年長，以常才不用"),
             c("title:0", 5, "năm Quý Mùi (1283)", "靖國大王國康進金龜"),
             c("bio", 5, "năm Đinh Dậu (1237)", "而順天懷娠國康三月，陳守度與天極公主密謀於帝曰：「宜冒取之，以賴其後。」")])

P(key="tran.quoc-tuan", full_name="Trần Quốc Tuấn", gender="M", parents="u.lieu--khuyet",
  death={"lunar_year": 1300, "lunar_month": 8, "lunar_day": 20},
  titles=[{"title": "Hưng Đạo đại vương"}, {"title": "Thái sư Thượng phụ Thượng quốc công Nhân Vũ Hưng Đạo đại vương (truy tặng)", "from_year": 1300}],
  bio="Con Yên Sinh vương Trần Liễu, tước Hưng Đạo đại vương. Từng soạn sách binh pháp và viết hịch khuyên dụ các tướng. Mất ngày 20 tháng 8 năm Canh Tý (1300) ở dinh Vạn Kiếp, được tặng Thái sư Thượng phụ Thượng quốc công Nhân Vũ Hưng Đạo đại vương.",
  citations=[c("existence", 6, "năm Canh Tý (1300)", "國峻安生王子"),
             c("parents", 6, "năm Canh Tý (1300)", "國峻安生王子"),
             c("parents", 5, "năm Ất Dậu (1285)", "又有安生王夙釁，多猜疑"),
             c("death", 6, "năm Canh Tý (1300)", "秋八月二十日，興道大王國峻卒於萬劫第", "âm 1300-8-20"),
             c("title:0", 6, "năm Canh Tý (1300)", "興道大王國峻卒於萬劫第"),
             c("title:1", 6, "năm Canh Tý (1300)", "贈太師尚父上國公仁武興道大王"),
             c("bio", 6, "năm Canh Tý (1300)", "國峻嘗撰兵家妙理要畧書，以援諸裨將，諭之以檄云"),
             c("bio", 6, "năm Canh Tý (1300)", "秋八月二十日，興道大王國峻卒於萬劫第，贈太師尚父上國公仁武興道大王")])
P(key="tran.thien-thanh", full_name="Thiên Thành công chúa", gender="F",
  death={"lunar_year": 1288, "lunar_month": 9},
  titles=[{"title": "Nguyên Từ quốc mẫu"}],
  bio="Công chúa Thiên Thành, vốn được gả cho Trung Thành vương; Trần Quốc Tuấn lẻn vào nơi công chúa ở, vua bất đắc dĩ phải gả cho Quốc Tuấn (năm 1251). Hiệu Nguyên Từ quốc mẫu. Mất tháng 9 năm Mậu Tý (1288).",
  citations=[c("existence", 5, "năm Tân Hợi (1251)", "以天城長公主嫁忠誠王"),
             c("death", 5, "năm Mậu Tý (1288)", "秋九月，興道王夫人元慈國母陳氏薨即天城公主", "âm 1288-9"),
             c("title:0", 5, "năm Mậu Tý (1288)", "興道王夫人元慈國母陳氏薨"),
             c("bio", 5, "năm Tân Hợi (1251)", "國峻欲求配而無由，夜間乃潜入天城公主所居通之"),
             c("bio", 5, "năm Tân Hợi (1251)", "帝不得已，以天城公主下嫁國峻")])
U("u.quoc-tuan--thien-thanh", "tran.quoc-tuan", "tran.thien-thanh", 1,
  [c("union", 5, "năm Tân Hợi (1251)", "帝不得已，以天城公主下嫁國峻"),
   cm("union", 6, "năm Tân Hợi (1251)", "以天城長公主嫁忠誠王，復歸于國峻")])
U("u.quoc-tuan--khuyet", "tran.quoc-tuan")
P(key="tran.quoc-tang", full_name="Trần Quốc Tảng", gender="M", parents="u.quoc-tuan--khuyet",
  titles=[{"title": "Hưng Nhượng đại vương"}],
  bio="Con thứ của Hưng Đạo đại vương Trần Quốc Tuấn, tước Hưng Nhượng đại vương. Con gái là Thuận Thánh Bảo Từ hoàng thái hậu, hoàng hậu của Anh Tông.",
  citations=[c("existence", 6, "năm Canh Tý (1300)", "又一日，以問次子興讓王國顙"),
             c("parents", 6, "năm Canh Tý (1300)", "國峻内深然之。又一日，以問次子興讓王國顙"),
             c("title:0", 6, "Trần kỷ, Minh Tông hoàng đế — tiểu dẫn", "興讓大王國顙之女也"),
             c("bio", 6, "Trần kỷ, Minh Tông hoàng đế — tiểu dẫn", "嫡母順聖保慈皇太后陳氏，興讓大王國顙之女也")])
U("u.quoc-tang--khuyet", "tran.quoc-tang")
P(key="tran.quoc-nghien", full_name="Trần Quốc Nghiễn", gender="M", parents="u.quoc-tuan--khuyet",
  nickname="Nghiễn",
  titles=[{"title": "Hưng Vũ vương"}],
  bio="Con Hưng Đạo đại vương Trần Quốc Tuấn, tước Hưng Vũ vương, lấy công chúa Thiên Thụy, có chiến công.",
  citations=[c("existence", 5, "năm Nhâm Ngọ (1282)", "時興武王巘以國峻之子尚天瑞公主，且有戦功"),
             c("parents", 5, "năm Nhâm Ngọ (1282)", "興武王巘以國峻之子"),
             c("nickname", 5, "năm Nhâm Ngọ (1282)", "時興武王巘以國峻之子", "Nghiễn",
               note="Sử chỉ chép tên 巘; tên đầy đủ 'Trần Quốc Nghiễn' theo cách gọi thông dụng — người duyệt kiểm."),
             c("title:0", 5, "năm Nhâm Ngọ (1282)", "時興武王巘以國峻之子"),
             c("bio", 5, "năm Nhâm Ngọ (1282)", "時興武王巘以國峻之子尚天瑞公主，且有戦功")],
  review={"status": "draft", "note": "Họ tên đầy đủ suy từ cách gọi thông dụng; sử chỉ chép 巘."})

P(key="tran.quang-khai", full_name="Trần Quang Khải", gender="M", parents="u.thai-tong--thuan-thien",
  birth={"lunar_year": 1241}, death={"lunar_year": 1294, "lunar_month": 7, "lunar_day": 3}, lifespan=54,
  titles=[{"title": "Chiêu Minh đại vương", "from_year": 1258}, {"title": "Thượng tướng Thái sư"}],
  bio="Hoàng tử thứ ba của Thái Tông, em cùng mẹ với Thánh Tông. Năm Mậu Ngọ (1258) được phong Chiêu Minh đại vương, sau làm Thượng tướng Thái sư. Mất ngày 3 tháng 7 năm Giáp Ngọ (1294), thọ 54 tuổi.",
  citations=[c("existence", 5, "năm Tân Sửu (1241)", "皇第三子光啓生，太子晃同母弟也"),
             c("parents", 5, "năm Tân Sửu (1241)", "皇第三子光啓生，太子晃同母弟也"),
             c("birth", 5, "năm Tân Sửu (1241)", "皇第三子光啓生", "âm 1241"),
             c("death", 6, "năm Giáp Ngọ (1294)", "秋七月三日，上相太師昭明大王光啓卒，年五十四", "âm 1294-7-3"),
             c("lifespan", 6, "năm Giáp Ngọ (1294)", "昭明大王光啓卒，年五十四", "54"),
             c("title:0", 5, "năm Mậu Ngọ (1258)", "封弟光啓為昭明大王"),
             cm("title:0", 6, "năm Mậu Ngọ (1258)", "冬十一月，封弟光啓爲昭明大王"),
             c("title:1", 6, "năm Giáp Ngọ (1294)", "上相太師昭明大王光啓卒"),
             c("bio", 5, "năm Tân Sửu (1241)", "皇第三子光啓生，太子晃同母弟也")])
U("u.thai-tong--khuyet", "tran.thai-tong")
P(key="tran.nhat-duat", full_name="Trần Nhật Duật", gender="M", parents="u.thai-tong--khuyet",
  birth={"lunar_year": 1255}, death={"lunar_year": 1330}, lifespan=77,
  titles=[{"title": "Chiêu Văn vương", "from_year": 1267}, {"title": "Tá Thánh Thái sư Chiêu Văn đại vương"}],
  bio="Hoàng tử thứ sáu của Thái Tông, sinh năm Ất Mão (1255). Năm Đinh Mão (1267) được phong Chiêu Văn vương, sau làm Tá Thánh Thái sư. Ưa giao du với người nước ngoài. Mất năm Canh Ngọ (1330), thọ 77 tuổi.",
  citations=[c("existence", 5, "năm Ất Mão (1255)", "皇第六子日燏生"),
             c("parents", 5, "năm Ất Mão (1255)", "皇第六子日燏生"),
             c("birth", 5, "năm Ất Mão (1255)", "皇第六子日燏生", "âm 1255",
               note="Bản số chép tiêu đề năm này là 丁卯 (errata — đúng là 乙卯, Bảo Hựu 3 nhà Tống = 1255)."),
             c("death", 7, "năm Canh Ngọ (1330)", "佐聖太師昭文大王日燏卒，年七十七", "âm 1330",
               note="Tuổi thọ 77 lệch 1 năm so với năm sinh 1255 — kiểm lại."),
             c("lifespan", 7, "năm Canh Ngọ (1330)", "昭文大王日燏卒，年七十七", "77"),
             c("title:0", 5, "năm Đinh Mão (1267)", "封弟日燏為昭文王"),
             c("title:1", 7, "năm Canh Ngọ (1330)", "佐聖太師昭文大王日燏卒"),
             c("bio", 7, "năm Canh Ngọ (1330)", "日燏好與外國人遊"),
             c("bio", 5, "năm Đinh Mão (1267)", "封弟日燏為昭文王")])
U("u.thanh-tong--khuyet", "tran.thanh-tong")
P(key="tran.ich-tac", full_name="Trần Ích Tắc", gender="M", parents="u.thanh-tong--khuyet",
  titles=[{"title": "Chiêu Quốc vương", "from_year": 1267}],
  bio="Con thứ của Thánh Tông, thông minh hiếu học, thông kinh sử lục nghệ, văn chương hơn đời. Năm Đinh Mão (1267) được phong Chiêu Quốc vương.",
  citations=[c("existence", 5, "năm Đinh Mão (1267)", "益稷上皇次子，聰明好學，通經史六藝，文章冠世"),
             c("parents", 5, "năm Đinh Mão (1267)", "益稷上皇次子"),
             cm("parents", 7, "năm Đinh Mão (1267)", "益稷，上皇次子"),
             c("title:0", 5, "năm Đinh Mão (1267)", "五月，封弟益稷為昭國王"),
             cm("title:0", 7, "năm Đinh Mão (1267)", "五月，封弟益稷爲昭國王"),
             c("bio", 5, "năm Đinh Mão (1267)", "益稷上皇次子，聰明好學，通經史六藝，文章冠世")])

# ── Di sản từ chính sử ─────────────────────────────────────────────
heritage.extend([
  {"key": "ds.hich-tuong-si", "category": "artifact", "title": "Hịch tướng sĩ",
   "summary": "Bài hịch Hưng Đạo đại vương Trần Quốc Tuấn viết để khuyên dụ các tướng, Toàn thư và Cương mục đều chép.",
   "body": "Hưng Đạo đại vương Trần Quốc Tuấn từng soạn sách binh pháp để dạy các tướng, và viết bài hịch khuyên dụ họ. Bài hịch mở đầu bằng gương Kỷ Tín chết thay cho Hán Cao đế, Do Vu lấy lưng đỡ giáo che cho Sở Chiêu vương, rồi trách các tướng không lấy việc rửa nhục làm lo, khuyên họ chăm học binh thư. Toàn thư chép bài hịch trong mục năm Canh Tý (1300), nhân việc Hưng Đạo vương mất.",
   "people": [{"person": "tran.quoc-tuan", "role_note": "tác giả"}],
   "citations": [c("existence", 6, "năm Canh Tý (1300)", "國峻嘗撰兵家妙理要畧書，以援諸裨將，諭之以檄云"),
                 cm("existence", 8, "năm Canh Tý (1300)", "親撰兵家妙理要略，檄授諸裨將"),
                 c("body", 6, "năm Canh Tý (1300)", "余常聞之，紀信以身代死而脫高帝，由于以背受戈而蔽昭王"),
                 cm("body", 8, "năm Canh Tý (1300)", "汝等旣恬然不以雪恥爲念，而又不敎士卒"),
                 c("person:0", 6, "năm Canh Tý (1300)", "國峻嘗撰兵家妙理要畧書")],
   "review": DRAFT},
  {"key": "ds.binh-thu", "category": "artifact", "title": "Binh thư yếu lược và Vạn Kiếp tông bí truyền thư",
   "summary": "Hai bộ sách binh pháp của Hưng Đạo đại vương Trần Quốc Tuấn.",
   "body": "Trong bài hịch, Hưng Đạo đại vương nói đã chọn lọc binh pháp các nhà làm thành một sách gọi là Binh thư yếu lược, dặn các tướng chăm học. Ông lại gom binh pháp các nhà làm thành đồ hình Bát quái cửu cung, gọi là Vạn Kiếp tông bí truyền thư; Nhân Huệ vương Trần Khánh Dư viết bài tựa.",
   "people": [{"person": "tran.quoc-tuan", "role_note": "tác giả"}],
   "citations": [c("existence", 6, "năm Canh Tý (1300)", "為一書名曰《兵書要略》"),
                 c("body", 6, "năm Canh Tý (1300)", "今余歷選諸家兵法，為一書名曰《兵書要略》"),
                 c("body", 6, "năm Canh Tý (1300)", "又集諸家兵法，為八卦九宫圖，名曰《萬刧宗秘傳書》"),
                 cm("body", 8, "năm Canh Tý (1300)", "名曰萬刧宗秘傳書，仁惠王慶餘序之"),
                 c("person:0", 6, "năm Canh Tý (1300)", "今余歷選諸家兵法")],
   "review": DRAFT},
  {"key": "ds.dien-hong", "category": "story", "title": "Hội nghị Diên Hồng (1284)",
   "summary": "Thượng hoàng Thánh Tông mời các bô lão trong nước họp ở thềm điện Diên Hồng hỏi kế đánh quân Nguyên.",
   "body": "Năm Giáp Thân (1284), khi quân Nguyên sắp sang, Thượng hoàng Thánh Tông mời các bô lão trong nước họp ở thềm điện Diên Hồng, ban yến và hỏi kế. Các bô lão đều nói: đánh; muôn người cùng một lời, như từ một miệng nói ra.",
   "people": [{"person": "tran.thanh-tong", "role_note": "Thượng hoàng triệu tập"}],
   "citations": [c("existence", 5, "năm Giáp Thân (1284)", "上皇召天下父老，會于延洪堦，賜食問計"),
                 cm("existence", 7, "năm Giáp Thân (1284)", "帝召天下耆老于延洪殿階，賜食問計",
                    note="Cương mục chép 帝 (vua), Toàn thư chép 上皇 (Thượng hoàng)."),
                 c("body", 5, "năm Giáp Thân (1284)", "皆曰戰，萬人同辝，如出一口"),
                 c("person:0", 5, "năm Giáp Thân (1284)", "上皇召天下父老")],
   "review": DRAFT},
  {"key": "ds.binh-than", "category": "story", "title": "Hội nghị Bình Than (1282)",
   "summary": "Nhân Tông họp vương hầu, trăm quan ở Bình Than bàn kế đánh giữ trước cuộc kháng chiến chống Nguyên.",
   "body": "Tháng 10 năm Nhâm Ngọ (1282), Nhân Tông ngự đến Bình Than, đóng ở vịnh Trần Xá, họp các vương hầu và trăm quan bàn kế đánh giữ, chia nhau giữ các nơi hiểm yếu. Trong dịp này Nhân Huệ vương Trần Khánh Dư được cử làm Phó đô tướng quân.",
   "people": [{"person": "tran.nhan-tong", "role_note": "chủ trì"}],
   "citations": [c("existence", 5, "năm Nhâm Ngọ (1282)", "冬十月，帝幸平灘，駐蹕陳舍灣，會王侯百官，議攻守之策"),
                 cm("existence", 7, "năm Nhâm Ngọ (1282)", "帝乃命駕幸平灘，會王侯百官議攻守之策"),
                 c("body", 5, "năm Nhâm Ngọ (1282)", "議攻守之策，及分守要害。以仁惠王陳慶餘為副都將軍"),
                 c("person:0", 5, "năm Nhâm Ngọ (1282)", "冬十月，帝幸平灘")],
   "review": DRAFT},
])

# ── Ảnh (Wikimedia Commons) ────────────────────────────────────────
# Chỉ ảnh mà trang Commons mô tả rõ đúng người / đúng lăng. Thời Trần không còn
# chân dung thật → ảnh người là tượng thờ (ghi rõ "không phải chân dung thật").
BY = {p["key"]: p for p in persons}  # dựng lại: đã thêm các nhánh ở trên
GBY = {g["key"]: g for g in graves}
C = "https://upload.wikimedia.org/wikipedia/commons/"
P = "https://commons.wikimedia.org/wiki/File:"


def photo(path, page, author, license, kind, year=None, caption=None):
    d = {"url": C + path, "source_page": P + page, "author": author, "license": license, "kind": kind}
    if year:
        d["year"] = year
    if caption:
        d["caption"] = caption
    return d


BY["tran.nhan-tong"]["photo"] = photo(
    "d/d2/T%C6%B0%E1%BB%A3ng_Gi%C3%A1c_Ho%C3%A0ng_Tr%E1%BA%A7n_Nh%C3%A2n_T%C3%B4ng.jpg",
    "T%C6%B0%E1%BB%A3ng_Gi%C3%A1c_Ho%C3%A0ng_Tr%E1%BA%A7n_Nh%C3%A2n_T%C3%B4ng.jpg",
    "Bùi Thụy Đào Nguyên", "CC BY-SA 3.0", "later_depiction", "2010")
BY["tran.quoc-tuan"]["photo"] = photo(
    "e/e8/T%C6%B0%E1%BB%A3ng_%C4%91%E1%BB%93ng_Tr%E1%BA%A7n_H%C6%B0ng_%C4%90%E1%BA%A1o_t%E1%BA%A1i_%C4%91%E1%BB%81n_Ki%E1%BA%BFp_B%E1%BA%A1c.jpg",
    "T%C6%B0%E1%BB%A3ng_%C4%91%E1%BB%93ng_Tr%E1%BA%A7n_H%C6%B0ng_%C4%90%E1%BA%A1o_t%E1%BA%A1i_%C4%91%E1%BB%81n_Ki%E1%BA%BFp_B%E1%BA%A1c.jpg",
    "Khangoii", "CC BY-SA 4.0", "later_depiction")
BY["tran.thien-thanh"]["photo"] = photo(
    "5/51/T%C6%B0%E1%BB%A3ng_%C4%91%E1%BB%93ng_Nguy%C3%AAn_T%E1%BB%AB_qu%E1%BB%91c_m%E1%BA%ABu_t%E1%BA%A1i_%C4%90%E1%BB%81n_Ki%E1%BA%BFp_B%E1%BA%A1c.jpg",
    "T%C6%B0%E1%BB%A3ng_%C4%91%E1%BB%93ng_Nguy%C3%AAn_T%E1%BB%AB_qu%E1%BB%91c_m%E1%BA%ABu_t%E1%BA%A1i_%C4%90%E1%BB%81n_Ki%E1%BA%BFp_B%E1%BA%A1c.jpg",
    "Khangoii", "CC BY-SA 4.0", "later_depiction")

for key, path, page, caption in [
    ("lang.chieu-lang", "e/ee/L%C4%83ng_Tr%E1%BA%A7n_Th%C3%A1i_T%C3%B4ng.jpg", "L%C4%83ng_Tr%E1%BA%A7n_Th%C3%A1i_T%C3%B4ng.jpg",
     "Lăng Trần Thái Tông ở Long Hưng, Thái Bình (theo mô tả ảnh trên Wikimedia Commons)"),
    ("lang.du-lang", "0/0d/L%C4%83ng_Tr%E1%BA%A7n_Th%C3%A1nh_T%C3%B4ng.jpg", "L%C4%83ng_Tr%E1%BA%A7n_Th%C3%A1nh_T%C3%B4ng.jpg",
     "Lăng Trần Thánh Tông ở xã Tiến Đức, huyện Hưng Hà, Thái Bình (theo mô tả ảnh trên Wikimedia Commons)"),
    ("lang.duc-lang", "2/29/L%C4%83ng_Tr%E1%BA%A7n_Nh%C3%A2n_T%C3%B4ng.jpg", "L%C4%83ng_Tr%E1%BA%A7n_Nh%C3%A2n_T%C3%B4ng.jpg",
     "Lăng Trần Nhân Tông ở Long Hưng, Thái Bình (theo mô tả ảnh trên Wikimedia Commons)"),
]:
    GBY[key]["photos"] = [photo(path, page, "Pvloc90", "CC BY-SA 3.0", "photograph", "2011", caption)]
