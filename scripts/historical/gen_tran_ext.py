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

# ── Tiểu sử đầy đủ (xuất thân → lên ngôi → việc nước → nhường ngôi / mất → sử thần) ──
CAN_N = "Giáp Ất Bính Đinh Mậu Kỷ Canh Tân Nhâm Quý".split()
CHI_N = "Tý Sửu Dần Mão Thìn Tỵ Ngọ Mùi Thân Dậu Tuất Hợi".split()


def yl(y):
    return f"năm {CAN_N[(y - 4) % 10]} {CHI_N[(y - 4) % 12]} ({y})"


def bc(vol, y, quote, src="TT"):
    """Trích dẫn cho tiểu sử: nguyên văn + vị trí (quyển, năm)."""
    where = "Bản kỷ" if src == "TT" else "Chính biên"
    return {"field": "bio", "source": src, "locator": f"{where} Q.{vol}, {yl(y)}", "quote": quote}


def bd(vol, reign, quote):
    """Trích dẫn lời tiểu dẫn đầu kỷ mỗi vua (sử thần đánh giá)."""
    return {"field": "bio", "source": "TT", "locator": f"Bản kỷ Q.{vol}, Trần kỷ, {reign} — tiểu dẫn", "quote": quote}


def bio(key, text, *cites):
    p = BY[key]
    p["bio"] = " ".join(text.split())
    p["citations"] = [x for x in p["citations"] if x["field"] != "bio"] + list(cites)


bio("tran.thai-tong", """Vua họ Trần, tên húy là Cảnh, trước húy là Bồ, con thứ của Trần Thừa, mẹ họ Lê; sinh ngày 16 tháng 6
năm Mậu Dần (1218). Làm Chi hậu chính triều Lý; ngày 12 tháng 12 năm Ất Dậu (1225) được Chiêu Hoàng nhường ngôi, đặt
niên hiệu Kiến Trung, mở đầu nhà Trần. Những năm đầu, việc nước phần nhiều do Trần Thủ Độ sắp đặt: sai đem quân dẹp
Nguyễn Nộn, Đoàn Thượng; theo Toàn thư, Thủ Độ giết Lý Huệ Tông ở chùa Chân Giáo (1226) và diệt hết tôn thất nhà Lý
(1232). Về chế độ, vua định luật lệnh (1226), soạn Quốc triều thông chế (1230), chia cả nước làm 12 lộ (1242), đắp đê
Đỉnh Nhĩ ngăn lũ (1248), lập Quốc học viện và Giảng võ đường (1253). Năm Đinh Dậu (1237), theo mưu Thủ Độ, vua lấy
Thuận Thiên, vợ của anh là Trần Liễu đang có mang ba tháng, làm hoàng hậu. Tháng 12 năm Đinh Tỵ (1257), tướng Nguyên
là Ngột Lương Hợp Thai đánh vào Bình Lệ Nguyên; vua thân đốc chiến, rồi cùng Thái tử đánh tan quân Nguyên ở Đông Bộ Đầu.
Ngày 24 tháng 2 năm Mậu Ngọ (1258), vua nhường ngôi cho Thái tử Hoảng, lui ở cung Bắc làm Thượng hoàng; cùng năm sai
Lê Phụ Trần sang Nguyên, định lệ ba năm một lần cống. Mất ngày mồng 1 tháng 4 năm Đinh Sửu (1277), thọ 60 tuổi.
Sử thần Ngô Sĩ Liên khen vua khoan nhân đại độ, có độ lượng bậc đế vương, nhưng chê việc trong buồng the nhiều điều đáng thẹn.""",
    bc(5, 1226, "遣陳守度領軍討阮嫩、段尚及諸蛮"), bc(5, 1226, "定律令條例"), bc(5, 1226, "陳守度弑李惠宗於真教襌寺"),
    bc(5, 1230, "考前代諸例，定為國朝通制"), bc(5, 1232, "陳守度盡殺李氏宗室"),
    bc(5, 1237, "納兄懷王柳妻順天公主李氏為順天皇后"), bc(5, 1242, "定天下為十二路"),
    bc(5, 1248, "令諸路築堤防水，名曰鼎耳"), bc(5, 1253, "立國學院，塑孔子、周公、亞聖"), bc(5, 1253, "立講武堂"),
    bc(5, 1257, "帝自將督戰，前冒矢石"), bc(5, 1257, "進軍東步頭逆戰，大破之"),
    bc(5, 1258, "帝傳位于皇太子晃，遜居北宫"), bc(5, 1258, "卒定三年一貢為常例"),
    bd(5, "Thái Tông hoàng đế", "帝寬仁大度，有帝王之量"), bd(5, "Thái Tông hoàng đế", "皆陳守度所為，閨門多慙德矣"))

bio("tran.thanh-tong", """Tên húy là Hoảng, con trưởng dòng đích của Thái Tông, mẹ là Hiển Từ Thuận Thiên hoàng thái hậu họ Lý;
sinh giờ Ngọ ngày 25 tháng 9 năm Canh Tý (1240), sớm được lập làm Hoàng thái tử. Ngày 24 tháng 2 năm Mậu Ngọ (1258) nhận
ngôi của Thái Tông, đặt niên hiệu Thiệu Long, tôn cha làm Thượng hoàng. Trong 21 năm ở ngôi, vua cho các vương hầu,
công chúa chiêu tập dân phiêu tán lập điền trang (1266); định ngọc điệp, lệ phong ấm cho hoàng tộc, gọi là "kim chi ngọc
diệp", và dùng nho sinh có văn tài vào quán các, tỉnh, viện (1267). Năm Nhâm Thân (1272) Hàn lâm học sĩ kiêm Quốc sử
viện giám tu Lê Văn Hưu vâng chiếu soạn xong bộ Đại Việt sử ký 30 quyển, từ Triệu Vũ đế đến Lý Chiêu Hoàng, dâng lên,
được khen thưởng; cùng năm vua xuống chiếu tìm người học rộng kinh sách làm Quốc tử giám tư nghiệp. Đối ngoại: năm
Tân Dậu (1261) nhà Nguyên sai sứ đưa thư sang dụ; năm Tân Mùi (1271) sứ Nguyên dụ vào chầu, vua lấy cớ có bệnh không
đi; năm Bính Tý (1276), sau khi diệt Tống, vua Nguyên đòi sáu việc như điều dân, giúp binh, vua đều không theo. Năm
Giáp Tuất (1274) lập hoàng tử Khâm làm Thái tử, cưới con gái cả Hưng Đạo vương làm Thái tử phi. Ngày 22 tháng 10 năm
Mậu Dần (1278) vua nhường ngôi cho Thái tử, làm Thượng hoàng. Mất ngày 25 tháng 5 năm Canh Dần (1290) ở cung Nhân Thọ,
thọ 51 tuổi. Sử thần khen vua trung hiếu nhân thứ, tôn người hiền, trọng đạo, nhưng cho việc ham mê thiền học
không phải đường lối trị nước của bậc đế vương.""",
    bc(5, 1261, "元遣禮步郎中孟甲、員外郎李文俊齎書來諭"), bc(5, 1266, "召集漂散無産人為奴婢，開墾荒閑田，立為田庄"),
    bc(5, 1267, "定皇宗王侯公主正派玉牒封蔭，號金枝玉葉"), bc(5, 1267, "選用儒生能文者充館閣省院"),
    bc(5, 1271, "帝辝以疾，不行"), bc(5, 1272, "奉勑編成《大越史記》，自趙武帝至李昭皇，凣三十卷上進"),
    bc(5, 1272, "詔求賢良明經者為國子監司業"), bc(5, 1274, "納興道王長女為太子妃"),
    bc(5, 1276, "遣合散兒海牙來諭以調民、助兵等六事"), bc(5, 1278, "帝禅位于皇太子昑"),
    bc(5, 1290, "五月二十五日，上皇崩于仁壽宫"),
    bd(5, "Thánh Tông hoàng đế", "帝忠孝仁恕，尊賢重道"), bd(5, "Thánh Tông hoàng đế", "然優游三昧，探頤一乘"))

bio("tran.nhan-tong", """Tên húy là Khâm, con trưởng của Thánh Tông, mẹ là Nguyên Thánh Thiên Cảm hoàng thái hậu; sinh ngày 11
tháng 11 năm Mậu Ngọ (1258), được cha mẹ gọi là Kim Tiên đồng tử. Ngày 22 tháng 10 năm Mậu Dần (1278) nhận ngôi của Thánh
Tông, tôn cha làm Thượng hoàng, về sau đặt niên hiệu Thiệu Bảo, Trùng Hưng. Việc nổi bật nhất thời vua là ba lần kháng
chiến chống Nguyên. Năm Nhâm Ngọ (1282) vua họp vương hầu, trăm quan ở Bình Than bàn kế đánh giữ; năm 1283 phong Hưng Đạo
vương Trần Quốc Tuấn làm Quốc công, tiết chế thống lĩnh các quân; năm 1284 Thượng hoàng triệu các bô lão họp ở thềm
điện Diên Hồng hỏi kế, ai nấy đều đáp: đánh. Năm Ất Dậu (1285) hai vua phải lánh vào Thanh Hóa; Thượng tướng Thái sư Trần
Quang Khải cùng các tướng đánh bại quân Nguyên ở Chương Dương, tháng 6 hai vua trở về kinh sư, tháng 9 đổi niên hiệu
Trùng Hưng. Năm Đinh Hợi (1287) quân Nguyên lại kéo sang; tháng 3 năm Mậu Tý (1288) Hưng Đạo vương cắm cọc ở sông Bạch
Đằng, nhử đánh, phá tan thủy quân Nguyên, hai vua về kinh. Năm Kỷ Sửu (1289) xét công đánh Nguyên, phong Hưng Đạo vương
làm Đại vương; khi tìm thấy cả hòm thư xin hàng của các quan, Thượng hoàng cho đốt đi để yên lòng người. Hai năm đói kém
(1290–1291), vua xuống chiếu phát thóc nhà nước cứu dân, miễn thuế thân. Ngày 9 tháng 3 năm Quý Tỵ (1293) nhường ngôi cho
Thái tử Thuyên, làm Thượng hoàng; năm Kỷ Hợi (1299) lại xuất gia, vào núi Yên Tử tu hành, tự hiệu Trúc Lâm đại sĩ. Năm
Tân Sửu (1301) Thượng hoàng đi chơi sang Chiêm Thành, năm Bính Ngọ (1306) gả công chúa Huyền Trân cho chúa Chiêm là Chế
Mân. Ngày mồng 3 tháng 11 năm Mậu Thân (1308) vua mất ở am Ngọa Vân núi Yên Tử, thọ 51 tuổi. Sử thần khen vua nhân từ
hòa dịch, vững lòng dân, làm hưng thịnh cơ nghiệp, là bậc vua hiền của nhà Trần, nhưng tiếc việc để tâm vào kinh Phật.""",
    bd(5, "Nhân Tông hoàng đế", "命曰金仙童子"),
    bc(5, 1282, "冬十月，帝幸平灘，駐蹕陳舍灣，會王侯百官，議攻守之策"),
    bc(5, 1283, "進封興道王國峻為國公，節制統領天下諸軍"), bc(5, 1284, "上皇召天下父老，會于延洪堦，賜食問計"),
    bc(5, 1285, "率諸路民兵敗賊于京城、章陽等處"), bc(5, 1285, "二帝駕回京師"), bc(5, 1285, "九月，改元重興元年"),
    bc(5, 1288, "元軍會白藤江，迎張文虎等粮船，不遇。興道王擊敗之"), bc(5, 1288, "二帝車駕還京師"),
    bc(5, 1289, "定平元之功。進封興道王為大王"), bc(5, 1289, "獲降表一篋。上皇命焚之，以安反側"),
    bc(5, 1290, "詔發官粟賑給貧民，免人丁税"), bc(5, 1293, "帝禪位于皇太子烇即皇帝位"),
    bc(6, 1299, "上皇自天長府復出家，入安子山苦行"), bc(6, 1301, "上皇遊方幸占城"),
    bc(6, 1306, "下嫁玄珍公主于占城主制旻"), bc(6, 1308, "自號竹林大士"),
    bd(5, "Nhân Tông hoàng đế", "帝仁慈和易，固結民心，重興事業"))

bio("tran.anh-tong", """Tên là Thuyên, con trưởng của Nhân Tông, mẹ là Khâm Từ Bảo Thánh hoàng thái hậu. Ngày 9 tháng 3 năm Quý
Tỵ (1293) nhận ngôi của Nhân Tông, đặt niên hiệu Hưng Long, tôn cha làm Thượng hoàng. Ở ngôi 21 năm, thời vua yên ổn,
chế độ văn vật dần thịnh. Trong nước: duyệt định dân binh các xã, cho đời đời làm lính (1297); mở khoa thi chọn nhân tài,
lấy Mạc Đĩnh Chi đỗ trạng nguyên (1304), định thi sĩ nhân theo bảy khoa (1304). Biên giới: Ai Lao quấy phá Đà Giang, Phạm
Ngũ Lão đánh tan, lấy lại đất cũ (1297), năm sau đem quân đánh Ai Lao. Với Chiêm Thành: năm Ất Tỵ (1305) vua Chiêm sai sứ
xin làm lễ hỏi, năm 1306 gả công chúa Huyền Trân cho Chế Mân, năm Đinh Mùi (1307) đổi hai châu Ô, Lý thành Thuận Châu, Hóa
Châu; sau Chế Chí phản trắc, tháng 12 năm Tân Hợi (1311) vua thân chinh, tháng 5 năm Nhâm Tý (1312) bắt được Chế Chí
đem về, phong em là Chế Đà A Bà Niêm làm Á hầu, trấn giữ đất ấy. Ngày 18 tháng 3 năm Giáp Dần (1314) vua nhường ngôi cho
Thái tử Mạnh. Mất ngày 16 tháng 3 năm Canh Thân (1320) ở cung Trùng Quang phủ Thiên Trường, thọ 45 tuổi, táng Thái Lăng.
Sử thần khen vua khéo nối giữ cơ nghiệp, đời yên thịnh, là bậc vua giỏi của nhà Trần, nhưng chê việc họp sư ở núi Yên Tử,
tốn sức dân dựng gác Anh Vân.""",
    bc(6, 1295, "上皇回京師，出家居武林行宫"), bc(6, 1297, "閲定天下各社民兵"),
    bc(6, 1297, "哀牢侵撞龍江，范五老擊破之，復其故地"), bc(6, 1298, "冬十月，伐哀牢。元降將張顯陣前戰死"), bc(6, 1304, "賜狀元莫挺之"),
    bc(6, 1304, "詔試天下士人用七科"), bc(6, 1305, "占城遣制蒲苔及部黨百餘人奉表進金銀奇香異物，求定聘禮"),
    bc(6, 1306, "下嫁玄珍公主于占城主制旻"), bc(6, 1307, "改烏、里二州為順州、化州"), bc(6, 1311, "帝親征占城"),
    bc(6, 1312, "誘獲占城主制至以歸，封其弟制陀阿婆粘為亞候，鎮其地"), bc(6, 1314, "帝禪位于皇太子奣"),
    bc(6, 1320, "上皇崩于天長府重光宫"),
    bd(6, "Anh Tông hoàng đế", "帝善繼善承，所以時臻康泰，治底休明"), bd(6, "Anh Tông hoàng đế", "聚沙門於安子之山，勞民力於英雲之閣"))

bio("tran.minh-tong", """Tên húy là Mạnh, con thứ tư của Anh Tông; đích mẫu là Thuận Thánh Bảo Từ hoàng thái hậu, mẹ đẻ là Chiêu
Hiến hoàng thái hậu, đều họ Trần. Năm Giáp Dần (1314) được Anh Tông nhường ngôi, đặt niên hiệu Đại Khánh. Việc nước:
duyệt định quan văn và hộ khẩu (1316), sai Nhân Huệ vương Trần Khánh Dư đến Diễn Châu định sổ binh dân; năm Mậu Ngọ (1318)
sai Huệ Vũ đại vương Quốc Chẩn đánh Chiêm Thành, Phạm Ngũ Lão đánh vào sau lưng, quân giặc thua chạy, bắt được nhiều;
ra lệ xử người kiện tranh ruộng đất (1320); vua ngự Thái học (1323); đặt Liêm phóng sứ các lộ (1325). Năm Bính Dần
(1326) Huệ Túc vương đánh Chiêm Thành không có công. Tháng 3 năm Mậu Thìn (1328), vua giết Quốc phụ Thượng tể Quốc Chẩn.
Ngày 7 tháng 2 năm Kỷ Tỵ (1329) lập con là Vượng làm Thái tử, ngày 15 truyền ngôi, làm Thượng hoàng. Về sau, năm Giáp
Tuất (1334) Thượng hoàng đi tuần Nghệ An, thân chinh Ai Lao, quân giặc nghe tiếng bỏ chạy; năm Ất Hợi (1335) lại thân chinh
Ai Lao nhưng bại trận, Đoàn Nhữ Hài chết đuối. Mất ngày 19 tháng 2 năm Đinh Dậu (1357) ở cung Bảo Nguyên, thọ 58 tuổi,
táng Mục Lăng. Sử thần khen vua văn minh, sửa sang việc nước, đối nội yên, đối ngoại phủ yên, kỷ cương đầy đủ, chỉ tiếc
không biết gian thần Trần Khắc Chung, để đến nỗi Quốc Chẩn phải chết.""",
    bc(6, 1316, "閲定文官及戶口"), bc(6, 1318, "遣惠武大王國瑱征占城"),
    bc(6, 1318, "管天武軍范五老縱兵擊其後，賊敗走，擒獲甚眾"), bc(6, 1320, "詔凣爭田土，勘問不是以物而強爭者反坐"),
    bc(6, 1323, "帝幸太學"), bc(6, 1325, "置諸路廉訪司"), bc(6, 1326, "惠肅王伐占城，無功而還"),
    bc(6, 1328, "殺國父上宰國瑱"), bc(6, 1329, "禪位。旺即皇帝位，改元開祐元年"),
    bc(7, 1334, "上皇廵守乂安道，親征哀牢"), bc(7, 1335, "上皇親征哀牢敗績"), bc(7, 1357, "上皇崩于保元宫，廟號明宗"),
    bd(6, "Minh Tông hoàng đế", "帝文明飾治，敷賁前功"), bd(6, "Minh Tông hoàng đế", "惜其不辨克終之奸，致國瑱之死"))

bio("tran.hien-tong", """Tên húy là Vượng, con thứ của Minh Tông; đích mẫu là Hiến Từ Tuyên Thánh hoàng thái hậu, mẹ đẻ là Minh Từ
hoàng thái phi họ Lê. Năm Kỷ Tỵ (1329) được Minh Tông nhường ngôi, đặt niên hiệu Khai Hựu, tôn cha làm Thái thượng
hoàng. Vua lên ngôi khi còn trẻ, việc nước phần nhiều do Thượng hoàng quyết định. Trong triều: Trung thư tỉnh thêm chức
tả hữu chính ngôn, tham nghị (1334); sai Hưng Hiếu vương dẹp man Ngưu Hống, phá trại Trịnh Kỳ, chém tù trưởng (1337); Nguyễn
Trung Ngạn làm An phủ sứ Nghệ An, kiêm giám tu Quốc sử, dâng kế lập kho chứa thóc thuế để cứu dân đói, được cho các lộ
làm theo (1337); đổi lịch Thụ Thời làm lịch Hiệp Kỷ (1339). Mất ngày 11 tháng 6 năm Tân Tỵ (1341), ở ngôi 13 năm, thọ 23
tuổi, không có con nối, táng Xương An lăng. Sử thần cho là vua thiên tư sáng suốt, giữ yên thời bình, tiếc rằng tuổi thọ
không dài, chưa thấy được việc làm.""",
    bc(7, 1334, "中書增置左右正言參議"), bc(7, 1337, "命興孝王討平牛吼蠻"), bc(7, 1337, "建議立漕倉貯田租以賑饑民"),
    bc(7, 1339, "改授時曆為協紀曆"), bc(7, 1341, "夏六月十一日，帝崩于正寝"),
    bc(9, 1341, "至是，帝崩，無嗣，上皇以昱疎狂，弗堪重托", "CM"),
    bd(7, "Hiến Tông hoàng đế", "帝天資英睿，運撫升平，然享年不永，未見其所行，惜哉"))

bio("tran.du-tong", """Tên húy là Hạo, con thứ mười của Minh Tông, do Hiến Từ hoàng hậu sinh ra. Ngày 21 tháng 8 năm Tân Tỵ (1341),
mới sáu tuổi, được Thượng hoàng cho lên ngôi, đặt niên hiệu Thiệu Phong; con trưởng là Cung Túc vương Dục không được
lập vì tính sơ cuồng. Thời Thiệu Phong (1341–1358) việc nước ổn: vua sai Trương Hán Siêu, Nguyễn Trung Ngạn biên định
Hoàng triều đại điển, khắc in ban hành (1341); đặt Khu mật viện nắm cấm quân (1342); lập 20 đô phong đoàn để bắt trộm cướp
(1344); thi Thái học sinh bằng phép viết kinh nghĩa không nhìn đề (1345). Từ niên hiệu Đại Trị (1358), vua ăn chơi vô độ,
đúc tiền Đại Trị thông bảo (1360); giặc cướp nổi nhiều nơi, nhà Trần suy dần. Năm Mậu Thân (1368) Trần Thế Hưng đánh
Chiêm Thành, trúng phục binh ở Chiêm Động, quân vỡ, Thế Hưng bị bắt. Vua mất ngày 25 tháng 5 năm Kỷ Dậu (1369) ở chính
tẩm, thọ 34 tuổi, không có con, để chiếu đón Dương Nhật Lễ vào nối ngôi; táng Phụ Lăng. Sử thần cho là vua thiên tư
thông minh, học vấn cao, võ bị văn tu, bốn phương quy phục, nhưng sau thời Đại Trị ăn chơi vô độ, cơ nghiệp nhà Trần từ đó suy.""",
    bc(7, 1341, "年甫六歲，不立長子恭肃王昱者，踈狂也"), bc(7, 1341, "命張漢超、阮忠彦編定皇朝大典考撰，刊書頒行"),
    bc(7, 1342, "至是置樞密以領之"), bc(7, 1344, "置諸路鋒團二十都，遂捕盗刧"), bc(7, 1345, "試太學生。試法用暗寫古文經義"),
    bc(7, 1360, "鑄大治通寶"), bc(7, 1368, "占人伏兵盗發，我軍大潰。世興為賊所擒"),
    bc(7, 1369, "臨崩之日，以無嗣，詔迎日禮入繼統"),
    bd(7, "Dụ Tông hoàng đế", "紹豊之時，政事畢擧"), bd(7, "Dụ Tông hoàng đế", "陳家基業由此而衰"))

bio("tran.nghe-tong", """Tên húy là Phủ, con thứ ba của Minh Tông; đích mẫu là Hiến Từ Tuyên Thánh hoàng thái hậu, mẹ đẻ là thứ phi
họ Lê. Năm Kỷ Dậu (1369) Dụ Tông mất không con, Hiến Từ thái hậu sai người đón Dương Nhật Lễ lên ngôi; Nhật Lễ ăn chơi,
giết thái hoàng thái hậu (tháng 12 năm ấy). Tháng 10 năm Canh Tuất (1370) Phủ lánh ra Đà Giang, cùng em là Cung Tuyên vương
Kính và công chúa Thiên Ninh khởi quân; ngày 13 tháng 11 về đến phủ Kiến Hưng, hạ lệnh phế Nhật Lễ làm Hôn Đức công, ngày
15 lên ngôi, đặt niên hiệu Thiệu Khánh. Năm Tân Hợi (1371) quân Chiêm Thành theo cửa biển Đại An đánh thẳng vào kinh sư, vào
thành đốt cung điện, bắt phụ nữ rồi rút; cùng năm vua lập em là Kính làm Hoàng thái tử và cho ngoại thích Lê Quý Ly làm Khu
mật viện đại sứ. Tháng 11 năm Nhâm Tý (1372) vua nhường ngôi cho Thái tử, làm Thượng hoàng. Thượng hoàng ngày càng tin dùng
Quý Ly: năm Đinh Mão (1387) cho làm Đồng bình chương sự, ban gươm và cờ đề "văn võ toàn tài, quân thần đồng đức"; năm Mậu Thìn
(1388) lại lập con út là Ngung làm vua. Mất ngày 15 tháng 12 năm Giáp Tuất (1394), thọ 74 tuổi, táng Nguyên Lăng ở Yên Sinh.
Sử thần khen vua dẹp nạn trong nước, khôi phục cơ đồ, nhưng cho là cung kính tiết kiệm có thừa mà cương quyết thiếu, để giặc
ngoài xâm phạm kinh kỳ, kẻ gian trong dòm ngó ngôi báu, đến nỗi xã tắc mất.""",
    bc(7, 1369, "憲慈皇太后使人迎故恭肅大王昱庶子日禮即位"), bc(7, 1369, "日禮弑憲慈宣聖太皇太后于宫中"),
    bc(7, 1370, "下令廢日禮為昏德公"), bc(7, 1370, "十五日，即皇帝位，改元大赦，稱義皇"),
    bc(7, 1371, "占城入㓂，由大安海門直犯京師"), bc(7, 1371, "賊亂入城，焚毀宫殿"),
    bc(7, 1371, "以外戚黎季犛為樞密院大使"), bc(7, 1372, "十一月九日，帝禪位于皇太子曔"),
    bc(8, 1387, "以黎季犛同平章事，賜釼一把，旗一隻"), bc(8, 1388, "二十七日，上皇立少子昭定王顒為皇帝"),
    bc(8, 1394, "十二月十五日，上皇崩塟安生原陵"),
    bd(7, "Nghệ Tông hoàng đế", "帝削平内難，光復洪圖"), bd(7, "Nghệ Tông hoàng đế", "然恭儉有餘，而剛斷不足"))

bio("tran.due-tong", """Tên húy là Kính, con thứ mười một của Minh Tông, em Nghệ Tông, mẹ là Đôn Từ hoàng thái phi; sinh ngày 2 tháng
6 năm Đinh Sửu (1337). Khi Nghệ Tông tránh loạn, quân lính khí giới đều nhờ sức vua nên được nhường ngôi: ngày 9 tháng 11
năm Nhâm Tý (1372) lên ngôi, xưng Khâm hoàng, đặt niên hiệu Long Khánh. Năm Quý Sửu (1373) sửa quân ngũ, đóng thuyền để
chuẩn bị đánh Chiêm, tháng 12 xuống chiếu thân chinh; năm Ất Mão (1375) cho Khu mật đại sứ Lê Quý Ly tham mưu quân sự.
Năm Bính Thìn (1376) Chiêm Thành đánh Hóa Châu; Ngự sử trung tán Lê Tích dâng sớ can, nói binh là đồ hung khí, không nên
tự mình dấy binh, nhưng tháng 12 vua vẫn thân chinh, đem 12 vạn quân từ kinh sư. Ngày 23 tháng Giêng năm Đinh Tỵ (1377)
đến cửa Thi Nại, vua tin lời trá hàng của vua Chiêm là Chế Bồng Nga, tiến quân vào thành Đồ Bàn, trúng phục binh, quân vỡ,
vua chết trận, thọ 41 tuổi; Quý Ly coi việc quân lương, nghe tin vua băng, tự bỏ về trước. Thượng hoàng làm lễ chiêu hồn,
táng Hy Lăng. Sử thần cho vua cương ngạnh tự ý, cự lời can, khinh địch, tai họa đến thân, không phải là bất hạnh.""",
    bd(7, "Duệ Tông hoàng đế", "藝宗避乱時，師徒軍噐皆帝之力，故以位遜之"),
    bc(7, 1372, "曔即皇帝位，大赦，稱欽皇"), bc(7, 1373, "定補軍伍，修造舟船，以僃征占之役"), bc(7, 1373, "詔親征占城"),
    bc(7, 1375, "以樞密大使黎季犛參謀軍事"), bc(7, 1376, "五月，占城冦化州"), bc(7, 1376, "夫兵者凶噐也，不可躬自起戎"),
    bc(7, 1376, "帝親征占城，領軍十二萬發京師"), bc(7, 1377, "賊乘勢突出截之，巳時官軍大潰，帝陷于陣崩"),
    bc(7, 1377, "黎季犛督粮軍，聞帝崩，先自迯歸"), bd(7, "Duệ Tông hoàng đế", "帝剛愎自用，拒諫輕敵，殃及其身，非不幸也"))

bio("tran.phe-de", """Tên húy là Hiện, con trưởng của Duệ Tông, mẹ là Gia Từ hoàng hậu họ Lê; sinh ngày 6 tháng 3 năm Tân Sửu (1361).
Duệ Tông chết ở phương Nam, Nghệ Tông lập lên ngôi (tháng 5 năm Đinh Tỵ, 1377), đặt niên hiệu Xương Phù; quyền hành ở cả
trong tay Thượng hoàng và quyền thần. Trong 12 năm ở ngôi, Chiêm Thành liên tiếp quấy phá: năm Mậu Ngọ (1378) quân Chiêm
vào Nghệ An, đánh vào Đại Hoàng giang, quân ta tự vỡ, giặc tiến đến kinh sư cướp bóc rồi rút; năm Canh Thân (1380) Lê Quý
Ly cầm quân đánh, Chế Bồng Nga thua chạy; năm 1382 Chiêm lại vào Thanh Hóa; tháng 6 năm Quý Hợi (1383) Chế Bồng Nga đóng
quân ở Khổng Mục, kinh sư chấn động. Quý Ly nhờ chiến công mà ngày càng nắm quân quyền. Năm Mậu Thìn (1388) Thượng hoàng
nghe lời gièm, giáng vua làm Linh Đức đại vương rồi sai thắt cổ chết, thọ 28 tuổi, táng ở núi An Bài. Sử thần cho vua
hôn nhu, không làm được việc gì, uy quyền ngày dồn về kẻ dưới, xã tắc nghiêng nguy, thân mình cũng không giữ nổi.""",
    bc(7, 1377, "夏五月十三日，上皇以帝當國難崩，立帝長子建德大王暊為嗣，即皇帝位"),
    bc(8, 1378, "帝命行遣杜子平禦之，官軍自潰，贼遂遂犯京師，擄掠而還"), bc(8, 1380, "占主制蓬莪戰敗遁歸"),
    bc(8, 1382, "占城入寇清化，命季犛領軍禦之"), bc(8, 1383, "屯孔目册，京師震駭"), bc(8, 1388, "扶下太陽府縊之"),
    bd(8, "Phế Đế", "帝昏懦不能有為，威權日歸於下，社稷傾危，身不能保"))

bio("tran.thuan-tong", """Tên húy là Ngung, con út của Nghệ Tông. Ngày 27 tháng 11 năm Mậu Thìn (1388) Thượng hoàng lập lên ngôi, đặt
niên hiệu Quang Thái, xưng Nguyên hoàng; tháng Giêng năm Kỷ Tỵ (1389) lập con gái cả của Lê Quý Ly là Thánh Ngẫu làm hoàng
hậu. Vua ở ngôi hơn chín năm, quyền ở cả trong tay quyền thần. Năm 1389 Chiêm Thành lại đánh Thanh Hóa, Quý Ly đem quân
chống; ngày 23 tháng Giêng năm Canh Ngọ (1390) đô tướng Trần Khát Chân đại phá quân Chiêm ở Hải Triều, bắt vua Chiêm là
Chế Bồng Nga, hạ lệnh bắn súng loạt, Chế Bồng Nga trúng đạn chết trên thuyền. Sau đó Quý Ly giết tôn thất họ Trần (1395),
dời đô về An Tôn (1397). Tháng 3 năm Mậu Dần (1398) Quý Ly bức vua nhường ngôi cho Thái tử Án, ép vua đi tu ở đạo quán Ngọc
Thanh thôn Đạm Thủy; năm Kỷ Mão (1399) sai Phạm Khả Vĩnh thắt cổ vua, thọ 22 tuổi, táng An Sinh lăng. Cùng năm Thái bảo
Trần Khát Chân và Thượng tướng Trần Hãn cùng mưu giết Quý Ly nhưng không thành, đều bị giết. Sử thần cho vua chỉ ôm ngôi
báu hão, chính sự ở tay quyền thần, họa đến thân mà không biết.""",
    bc(8, 1388, "顒即位改元光泰元年，大赦，稱元皇"), bc(8, 1389, "立季犛長女聖偶為皇后"),
    bc(8, 1389, "占人㓂清化，犯古無，命季犛將兵禦之"), bc(8, 1390, "都將陳渴真大敗占城于海潮。獲其主制蓬莪"),
    bc(8, 1390, "渴真令火銃齊發，着蓬莪貫於船板而死"), bc(8, 1395, "季犛殺宗室撫軍司元淵、恭正王師賢庶子元胤"),
    bc(8, 1397, "季犛徙安孫，弑元君而夷宗黨"), bc(8, 1398, "黎季犛逼帝禪位于皇太子"),
    bc(8, 1399, "季犛逼令帝出家，奉道教居淡水村玉清觀"), bc(8, 1399, "令軍騎衛上將軍范可永縊之"),
    bc(8, 1399, "太保陳沆、上將軍陳渴真等謀誅季犛不克，死之"),
    bd(8, "Thuận Tông hoàng đế", "帝徒擁虚噐，政在權臣，禍及身而不覺"))

bio("tran.thieu-de", """Tên là Án, con của Thuận Tông. Tháng 3 năm Mậu Dần (1398), Lê Quý Ly ép Thuận Tông nhường ngôi cho Thái tử; khi ấy
Thái tử mới ba tuổi, nhận ngôi không biết lạy. Vua lên ngôi ở cung Bảo Thanh, đặt niên hiệu Kiến Tân; Quý Ly tự xưng
Đại vương nhiếp chính, mọi việc ở trong tay ông. Ở ngôi hai năm; năm Canh Thìn (1400) Quý Ly cướp ngôi, đổi quốc hiệu
là Đại Ngu, phế vua làm Bảo Ninh đại vương; Toàn thư chép "nhà Trần mất" từ năm ấy.""",
    bc(8, 1398, "時太子生甫三歲，受禪不能拜"), bc(8, 1398, "皇太子𤇼即位於葆清宫，改元建新元年，大赦"),
    bc(11, 1398, "太子卽位，尊欽聖皇后爲皇太后，季犛自稱大王攝政", "CM"), bc(8, 1400, "是歲陳亡"),
    bd(8, "Thiếu Đế", "季犛篡位，廢為保寕大王"),
    {"field": "bio", "source": "TT", "locator": "Bản kỷ Q.8, Trần kỷ, phụ Hồ Quý Ly — tiểu dẫn", "quote": "遂移陳祚，國號大虞，復姓胡"})

# ── Các nhánh: bổ sung sự nghiệp ──
bio("tran.quoc-tuan", """Con Yên Sinh vương Trần Liễu, tước Hưng Đạo vương. Năm Tân Hợi (1251) lấy công chúa Thiên Thành. Năm Quý Mùi
(1283) được phong Quốc công, tiết chế thống lĩnh các quân; năm 1284 điều vương hầu và các quân duyệt binh lớn ở Đông Bộ
Đầu. Năm 1285 bàn xin Thượng tướng Thái sư Quang Khải chống quân Toa Đô ở Nghệ An. Tháng 3 năm Mậu Tý (1288) cắm cọc ở sông
Bạch Đằng, nhân nước triều lên nhử giặc rồi đánh thua, thủy quân Nguyên mắc cạn tan vỡ; năm Kỷ Sửu (1289) xét công
dẹp Nguyên, được tiến phong Đại vương. Ông soạn sách binh pháp, viết hịch dụ các tỳ tướng. Khi ông nằm bệnh, Nhân
Tông ngự đến nhà hỏi kế nếu giặc phương Bắc xâm phạm. Mất ngày 20 tháng 8 năm Canh Tý (1300) ở dinh Vạn Kiếp, được tặng Thái
sư Thượng phụ Thượng quốc công Nhân Vũ Hưng Đạo đại vương.""",
    bc(5, 1283, "進封興道王國峻為國公，節制統領天下諸軍"), bc(5, 1284, "興道王調王侯諸軍，大閲於東步頭"),
    bc(5, 1285, "興道王議請上相太師光啟禦唆都元帥軍于乂安"),
    bc(5, 1288, "元軍會白藤江，迎張文虎等粮船，不遇。興道王擊敗之"), bc(5, 1289, "定平元之功。進封興道王為大王"),
    bc(6, 1300, "國峻嘗撰兵家妙理要畧書"), bc(6, 1300, "興道大王卧病。帝幸其第問曰"),
    bc(6, 1300, "秋八月二十日，興道大王國峻卒於萬劫第，贈太師尚父上國公仁武興道大王"))
BY["tran.quoc-tuan"]["citations"] = [x for x in BY["tran.quoc-tuan"]["citations"]]  # (giữ nguyên các trích dẫn khác)

bio("tran.quang-khai", """Hoàng tử thứ ba của Thái Tông, em cùng mẹ với Thánh Tông, sinh năm Tân Sửu (1241). Năm Mậu Ngọ (1258) được phong
Chiêu Minh đại vương; năm Tân Mùi (1271) làm Tướng quốc Thái úy, tổng quản việc thiên hạ; năm Nhâm Ngọ (1282) làm Thượng
tướng Thái sư. Trong cuộc kháng chiến chống Nguyên, ông cùng các tướng đem dân binh các lộ đánh tan giặc ở kinh thành và
Chương Dương (1285), có thơ rằng: "Đoạt sáo Chương Dương độ, cầm Hồ Hàm Tử quan, thái bình tu trí lực, vạn cổ thử giang sơn".
Mất ngày mồng 3 tháng 7 năm Giáp Ngọ (1294), thọ 54 tuổi.""",
    bc(5, 1271, "拜昭明大王光啓為相國太尉，總天下事"), bc(5, 1282, "以太尉光啓為上相太師"),
    bc(5, 1285, "率諸路民兵敗賊于京城、章陽等處"), bc(5, 1285, "奪矟章陽度，擒胡鹹子關，太平須致力，萬古此江山"),
    bc(6, 1294, "秋七月三日，上相太師昭明大王光啓卒，年五十四"))

p = BY["tran.nhat-duat"]
p["bio"] = " ".join("""Hoàng tử thứ sáu của Thái Tông, sinh năm Ất Mão (1255). Năm Đinh Mão (1267) được phong Chiêu Văn vương, sau
làm Tá Thánh Thái sư. Năm Canh Thìn (1280) tù trưởng Trịnh Giác Mật ở đạo Đà Giang làm phản, vua sai ông đến dụ, Giác Mật
xin hàng. Ông ưa giao du với người nước ngoài. Mất năm Canh Ngọ (1330), thọ 77 tuổi.""".split())
p["citations"] = [x for x in p["citations"] if x["field"] != "bio"] + [
    bc(5, 1280, "沱江道鄭角密叛，命昭文王日燏諭行之"), bc(5, 1267, "封弟日燏為昭文王"),
    bc(7, 1330, "日燏好與外國人遊")]

# ── Hiệu chỉnh sau khi rà soát từng câu tiểu sử với nguyên văn ──
def fix(key, old, new):
    p = BY[key]
    assert old in p["bio"], (key, old[:60])
    p["bio"] = p["bio"].replace(old, new, 1)


def more(key, *cites):
    BY[key]["citations"].extend(cites)


fix("tran.thai-tong", "Sử thần Ngô Sĩ Liên khen vua", "Sử thần khen vua")
more("tran.thai-tong", bc(5, 1237, "時昭聖無子，而順天懷娠國康三月，陳守度與天極公主密謀於帝曰"),
     bc(5, 1258, "遣黎輔陳、周博覽如元"), bd(5, "Thái Tông hoàng đế", "為李朝袛候正，受昭皇禅，在位三十三年"))

fix("tran.thanh-tong", "công chúa chiêu tập dân phiêu tán lập điền trang (1266)",
    "công chúa chiêu tập dân phiêu tán không có sản nghiệp (làm nô tì) khai khẩn ruộng hoang, lập điền trang (1266)")
more("tran.thanh-tong", bd(5, "Thánh Tông hoàng đế", "午時誕生，尋立為皇太子"),
     bc(5, 1272, "翰林院學士兼國史院監脩黎文休奉勑編成《大越史記》，自趙武帝至李昭皇，凣三十卷上進"))
BY["tran.thanh-tong"]["citations"] = [x for x in BY["tran.thanh-tong"]["citations"]
                                      if x["quote"] != "奉勑編成《大越史記》，自趙武帝至李昭皇，凣三十卷上進"]

fix("tran.nhan-tong", "được cha mẹ gọi là Kim Tiên đồng tử", "được hai cung lấy làm lạ, gọi là Kim Tiên đồng tử")
more("tran.nhan-tong", bc(5, 1285, "二帝捨舟而從步至水注，取舟出南趙江"), bc(5, 1285, "逾大旁海，幸清化"),
     bc(5, 1288, "先是，王已植樁於白藤，覆叢草其上"), bc(5, 1288, "水落，賊船盡膠"),
     bc(5, 1291, "歲又大饑，途多餓死"), bd(5, "Nhân Tông hoàng đế", "然游心釋典"))

fix("tran.anh-tong", "Ai Lao quấy phá Đà Giang, Phạm Ngũ Lão đánh tan", "Ai Lao xâm lấn, Phạm Ngũ Lão đánh tan")
fix("tran.anh-tong", "bắt được Chế Chí đem về", "dụ bắt được Chế Chí đem về")
BY["tran.anh-tong"]["citations"] = [x for x in BY["tran.anh-tong"]["citations"] if x["quote"] != "閲定天下各社民兵"]
more("tran.anh-tong", bc(6, 1297, "閲定天下各社民兵，使世為兵"))

more("tran.minh-tong", bc(6, 1316, "命仁惠大王慶餘徃演州定兵民籍"), bc(6, 1329, "春二月七日，冊東宫太子旺為皇太子"),
     bc(7, 1334, "哀牢望風而遁"), bc(7, 1335, "段汝諧溺死"), bd(6, "Minh Tông hoàng đế", "内寧外撫，紀綱畢張"))

fix("tran.hien-tong", "việc nước phần nhiều do Thượng hoàng quyết định.", "Thượng hoàng vẫn nắm việc lớn, như thân chinh Ai Lao (1334, 1335).")
more("tran.hien-tong", bc(7, 1337, "入鄭旗寨，大破之，斬其酋車焚"), bc(7, 1337, "以阮忠彦為乂安安撫使兼國史院監修國史"),
     bc(7, 1334, "上皇廵守乂安道，親征哀牢"), bc(7, 1335, "上皇親征哀牢敗績"))

fix("tran.du-tong", "Thời Thiệu Phong (1341–1358) việc nước ổn: vua sai", "Thời Thiệu Phong (1341–1358) mọi việc nước được chấn chỉnh: vua sai")
fix("tran.du-tong", "lập 20 đô phong đoàn để bắt trộm cướp (1344); thi Thái học sinh bằng phép viết kinh nghĩa không nhìn đề (1345). Từ niên hiệu Đại Trị (1358), vua ăn chơi vô độ, đúc tiền Đại Trị thông bảo (1360); giặc cướp nổi nhiều nơi, nhà Trần suy dần.",
    "khi Ngô Bệ tụ họp ở núi An Phụ làm giặc, lập 20 đô phong đoàn để bắt trộm cướp (1344); thi Thái học sinh theo phép viết ám tả cổ văn kinh nghĩa (1345); năm 1351 lại có giặc ở Thái Nguyên, Lạng Sơn. Từ niên hiệu Đại Trị (1358), vua hoang dâm vô độ, đúc tiền Đại Trị thông bảo (1360), cơ nghiệp nhà Trần từ đó suy.")
fix("tran.du-tong", "nhưng sau thời Đại Trị ăn chơi vô độ", "nhưng sau thời Đại Trị hoang dâm vô độ")
more("tran.du-tong", bc(7, 1344, "茶鄕人吳陛聚眾於安阜山為盗"), bc(7, 1351, "太原諒山人聚為盗，相攻擊"),
     bd(7, "Dụ Tông hoàng đế", "大治之後，荒𨒣無度"))

fix("tran.nghe-tong", "Nhật Lễ ăn chơi, giết thái hoàng thái hậu (tháng 12 năm ấy).",
    "Nhật Lễ ngồi ngôi, uống rượu chơi bời, muốn đổi lại họ Dương, và giết thái hoàng thái hậu (tháng 12 năm ấy).")
fix("tran.nghe-tong", "Phủ lánh ra Đà Giang, cùng em là Cung Tuyên vương Kính và công chúa Thiên Ninh khởi quân;",
    "Phủ lánh ra trấn Đà Giang, cùng em là Cung Tuyên vương Kính, công chúa Thiên Ninh và Chương Túc quốc thượng hầu Nguyên Đán khởi quân;")
fix("tran.nghe-tong", "Mất ngày 15 tháng 12 năm Giáp Tuất (1394), thọ 74 tuổi",
    "Mất ngày 15 tháng 12 năm Giáp Tuất (1394) theo Toàn thư (Cương mục chép tháng 11), thọ 74 tuổi")
more("tran.nghe-tong", bc(7, 1370, "日禮僣位，縱酒淫逸，日事宴遊"), bc(7, 1370, "出避沱江鎮即嘉興，潜約其弟恭宣王曔"),
     bc(7, 1371, "立弟恭宣大王曔為皇太子"), bc(8, 1387, "題曰：「文武全才，君臣同德」"),
     bd(7, "Nghệ Tông hoàng đế", "外冦侵犯京畿，内姦覬覦神噐"))

fix("tran.due-tong", "đến cửa Thi Nại, vua tin lời trá hàng của vua Chiêm là Chế Bồng Nga, tiến quân vào thành Đồ Bàn,",
    "đến cửa Thi Nại; Chế Bồng Nga cho tiểu thần trá hàng, nói đã bỏ thành trống, vua tiến quân vào thành Đồ Bàn,")
more("tran.due-tong", bc(7, 1377, "遣小臣牧婆摩詐降，言蓬峩已遁，但留空城，宜速進兵"), bc(7, 1377, "招魂，塟熙陵"))

fix("tran.phe-de", "đặt niên hiệu Xương Phù; quyền hành ở cả trong tay Thượng hoàng và quyền thần. Trong 12 năm", "đặt niên hiệu Xương Phù. Trong 12 năm")
fix("tran.phe-de", "Quý Ly nhờ chiến công mà ngày càng nắm quân quyền.", "Quý Ly dần nắm quyền chỉ huy quân đội.")
fix("tran.phe-de", "Thượng hoàng nghe lời gièm, giáng vua", "Thượng hoàng rốt cuộc nghe lời gièm của Quý Ly, giáng vua")
more("tran.phe-de", bc(8, 1380, "惟季犛專領元戎，行海西都統制"), bc(8, 1388, "終納季犛之譛"))

fix("tran.thuan-tong", "Ngày 27 tháng 11 năm Mậu Thìn (1388) Thượng hoàng lập lên ngôi", "Ngày 27 năm Mậu Thìn (1388), sau khi Phế Đế bị giáng, Thượng hoàng lập lên ngôi")
fix("tran.thuan-tong", "đại phá quân Chiêm ở Hải Triều, bắt vua Chiêm là Chế Bồng Nga, hạ lệnh bắn súng loạt, Chế Bồng Nga trúng đạn chết trên thuyền. Sau đó Quý Ly giết tôn thất họ Trần (1395),",
    "đại phá quân Chiêm ở Hải Triều: có tiểu thần Chiêm sợ bị giết chạy sang chỉ thuyền của vua Chiêm, Khát Chân cho bắn súng loạt, Chế Bồng Nga trúng đạn chết trên thuyền. Sau đó Quý Ly giết tôn thất Nguyên Uyên, Nguyên Dận (1395),")
fix("tran.thuan-tong", "Tháng 3 năm Mậu Dần (1398) Quý Ly bức vua nhường ngôi cho Thái tử Án, ép vua đi tu ở đạo quán Ngọc Thanh thôn Đạm Thủy; năm Kỷ Mão (1399) sai Phạm Khả Vĩnh thắt cổ vua, thọ 22 tuổi, táng An Sinh lăng. Cùng năm Thái bảo Trần Khát Chân và Thượng tướng Trần Hãn cùng mưu giết Quý Ly nhưng không thành, đều bị giết.",
    "Tháng 3 năm Mậu Dần (1398) Quý Ly bức vua nhường ngôi cho Thái tử Án; tháng 4 năm Kỷ Mão (1399) ép vua xuất gia, theo đạo giáo ở đạo quán Ngọc Thanh thôn Đạm Thủy, rồi sai Thượng tướng Phạm Khả Vĩnh thắt cổ vua, thọ 22 tuổi, táng An Sinh lăng. Cùng năm Thái bảo và Thượng tướng Trần Khát Chân mưu giết Quý Ly nhưng không thành, đều chết.")
more("tran.thuan-tong", bc(8, 1390, "來奔軍营，指綠漆船告曰：「此國王船也。」"))

fix("tran.nhat-duat", "tù trưởng Trịnh Giác Mật ở đạo Đà Giang làm phản, vua sai ông đến dụ, Giác Mật xin hàng.",
    "Trịnh Giác Mật ở đạo Đà Giang làm phản, vua sai ông đến dụ, Giác Mật sai người đến doanh xin hàng.")
more("tran.nhat-duat", bc(5, 1280, "鄭角密使人詣營，致款曰"))

# ── Chia đoạn cho dễ đọc (app hiển thị xuống dòng đúng như lưu) ──
def para(key, *anchors):
    p = BY[key]
    for a in anchors:
        assert a in p["bio"], (key, a)
        p["bio"] = p["bio"].replace(" " + a, "\n\n" + a, 1)


para("tran.thai-tong", "Những năm đầu,", "Tháng 12 năm Đinh Tỵ (1257)", "Mất ngày", "Sử thần")
para("tran.thanh-tong", "Trong 21 năm", "Đối ngoại:", "Mất ngày", "Sử thần")
para("tran.nhan-tong", "Việc nổi bật nhất", "Năm Đinh Hợi (1287)", "Ngày 9 tháng 3 năm Quý Tỵ (1293)", "Ngày mồng 3 tháng 11", "Sử thần")
para("tran.anh-tong", "Ở ngôi 21 năm", "Với Chiêm Thành:", "Ngày 18 tháng 3 năm Giáp Dần", "Sử thần")
para("tran.minh-tong", "Việc nước:", "Ngày 7 tháng 2 năm Kỷ Tỵ", "Mất ngày", "Sử thần")
para("tran.hien-tong", "Trong triều:", "Mất ngày", "Sử thần")
para("tran.du-tong", "Thời Thiệu Phong", "Vua mất ngày", "Sử thần")
para("tran.nghe-tong", "Năm Kỷ Dậu (1369)", "Năm Tân Hợi (1371)", "Tháng 11 năm Nhâm Tý (1372)", "Mất ngày 15 tháng 12", "Sử thần")
para("tran.due-tong", "Năm Quý Sửu (1373)", "Ngày 23 tháng Giêng", "Sử thần")
para("tran.phe-de", "Trong 12 năm ở ngôi", "Năm Mậu Thìn (1388)", "Sử thần")
para("tran.thuan-tong", "Năm 1389 Chiêm", "Tháng 3 năm Mậu Dần (1398)", "Sử thần")
