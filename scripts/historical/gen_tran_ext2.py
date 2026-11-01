# ── PHẦN MỞ RỘNG 2: công thần / tôn thất nổi tiếng chưa có trong khung (Toàn thư, nguyên văn chữ Hán) ──
# Được exec trong gen_tran.py sau gen_tran_ext.py (dùng chung P, U, c, DRAFT, BY).

def _p(key, name, gender, cites, bio, **kw):
    # gen_tran_ext.py gán lại tên P (đường dẫn Commons) nên không gọi P() ở đây.
    persons.append(dict(key=key, full_name=name, gender=gender, bio=bio, citations=cites, review=DRAFT, **kw))
    BY[key] = persons[-1]


_p("tran.thu-do.cha", "Cha của Trần Thủ Độ (anh/em của Trần Lý, sử không chép tên)", "M",
   [c("existence", 5, "Thái Tông hoàng đế — tiểu dẫn", "有從叔陳守度為殿前指揮使"),
    c("parents", 5, "Thái Tông hoàng đế — tiểu dẫn", "生翕，翕生李"),
    c("bio", 5, "Thái Tông hoàng đế — tiểu dẫn", "有從叔陳守度為殿前指揮使")],
   "Người đứng giữa trong gia phả: Toàn thư chép Thủ Độ là chú họ (從叔) của Thái Tông, nghĩa là cha ông là anh hoặc em của Trần Lý (cùng là con Trần Hấp). Sử không ghi tên nên đây chỉ là chỗ giữ cho đúng thế thứ.",
   parents="u.hap")
U("u.thu-do.cha", "tran.thu-do.cha")
_p("tran.thu-do", "Trần Thủ Độ", "M",
   [c("existence", 5, "Thái Tông hoàng đế — tiểu dẫn", "有從叔陳守度為殿前指揮使"),
    c("bio", 5, "Thái Tông hoàng đế — tiểu dẫn", "然䂓畫國事，皆陳守度所為"),
    c("death", 5, "năm Giáp Tý (1264)", "太師陳守度卒。年七十一", "âm 1264-1"),
    c("lifespan", 5, "năm Giáp Tý (1264)", "太師陳守度卒。年七十一", "71"),
    c("title:0", 5, "năm Bính Tuất (1226)", "封陳守度為太師綂國，行軍務征討事"),
    c("title:1", 5, "năm Giáp Tý (1264)", "贈尚父太師忠武大王"),
    c("parents", 5, "Thái Tông hoàng đế — tiểu dẫn", "有從叔陳守度為殿前指揮使")],
   "Chú họ của Thái Tông, giữ chức Điện tiền chỉ huy sứ dưới triều Lý, là người sắp đặt việc nhà Trần nhận ngôi từ Lý Chiêu Hoàng. Năm Bính Tuất (1226) được phong Thái sư Thống quốc, nắm việc quân quốc. Toàn thư chép rằng việc nước đều do ông trù hoạch. Mất tháng giêng năm Giáp Tý (1264), thọ 71 tuổi, được truy tặng Thượng phụ Thái sư Trung Vũ đại vương.",
   parents="u.thu-do.cha", death={"lunar_year": 1264, "lunar_month": 1}, lifespan=71,
   titles=[{"title": "Thái sư Thống quốc", "from_year": 1226}, {"title": "Thượng phụ Thái sư Trung Vũ đại vương (truy tặng)"}])
_p("tran.linh-tu", "Linh Từ quốc mẫu Trần thị", "F",
   [c("existence", 5, "năm Kỷ Mùi (1259)", "陳守度夫人靈慈國母陳氏薨"),
    c("death", 5, "năm Kỷ Mùi (1259)", "陳守度夫人靈慈國母陳氏薨", "âm 1259-1"),
    c("title:0", 5, "năm Kỷ Mùi (1259)", "靈慈國母"),
    c("bio", 5, "năm Kỷ Mùi (1259)", "陳氏稱國母者，本前吳夫人號，即后也")],
   "Vợ Trần Thủ Độ, họ Trần, trước đó từng là hoàng hậu của Lý Huệ Tông. Thái Tông không nỡ gọi là công chúa nên phong là Quốc mẫu. Mất tháng giêng năm Kỷ Mùi (1259).",
   death={"lunar_year": 1259, "lunar_month": 1}, titles=[{"title": "Linh Từ quốc mẫu"}])
U("u.thu-do--linh-tu", "tran.thu-do", "tran.linh-tu",
   cites=[c("union", 5, "năm Kỷ Mùi (1259)", "陳守度夫人靈慈國母陳氏薨")])

_p("tran.huyen-tran", "Huyền Trân công chúa", "F",
   [c("existence", 6, "năm Bính Ngọ (1306)", "下嫁玄珍公主于占城主制旻"),
    c("title:0", 6, "năm Bính Ngọ (1306)", "下嫁玄珍公主于占城主制旻"),
    c("bio", 6, "năm Bính Ngọ (1306)", "下嫁玄珍公主于占城主制旻"),
    cm("parents", 8, "năm Bính Ngọ (1306)", "初，上皇遊方如占城，約與婚"),
    c("bio", 6, "năm Mậu Thân (1308)", "玄珍公主自占城回")],
   "Công chúa nhà Trần. Tháng 6 năm Bính Ngọ (1306) được gả cho vua Chiêm Thành là Chế Mân, theo lời hứa của Thượng hoàng khi qua Chiêm Thành. Chế Mân mất, tháng 8 năm Mậu Thân (1308) công chúa được đón về nước.",
   parents="u.nhan-tong--khuyet", titles=[{"title": "Huyền Trân công chúa"}])
U("u.nhan-tong--khuyet", "tran.nhan-tong")



# ── Ảnh (Wikimedia Commons; ảnh người là tượng thờ / tranh vẽ sau này, không phải chân dung thật) ──
# photo() và hằng C (tiền tố upload) do gen_tran_ext.py định nghĩa; P đã bị gán lại thành URL Commons.
BY["tran.anh-tong"]["photo"] = photo(
    "5/5d/Portrait_of_Emperor_Tr%E1%BA%A7n_Anh_T%C3%B4ng.png", "Portrait_of_Emperor_Tr%E1%BA%A7n_Anh_T%C3%B4ng.png",
    "Không rõ tác giả (tranh Trúc Lâm đại sĩ xuất sơn đồ, 1363)", "Public domain", "later_depiction", "1363",
    "Hình Trần Anh Tông trong tranh Trúc Lâm đại sĩ xuất sơn đồ (vẽ sau khi ông mất)")
BY["tran.minh-tong"]["photo"] = photo(
    "b/bd/CDVTranMinhTongjpg1333297930.jpg", "CDVTranMinhTongjpg1333297930.jpg",
    "Đất Việt", "CC BY-SA 4.0", "later_depiction", "2018", "Tượng vua Trần Minh Tông")
BY["tran.du-tong"]["photo"] = photo(
    "b/bd/Statue_of_emperor_Tr%E1%BA%A7n_D%E1%BB%A5_T%C3%B4ng.jpg", "Statue_of_emperor_Tr%E1%BA%A7n_D%E1%BB%A5_T%C3%B4ng.jpg",
    "閒鹤", "Public domain", "later_depiction", "2013", "Mộc tượng Trần Dụ Tông ở chùa Gệt")
BY["tran.nghe-tong"]["photo"] = photo(
    "f/f0/Tr%E1%BA%A7n_Ngh%E1%BB%87_T%C3%B4ng.png", "Tr%E1%BA%A7n_Ngh%E1%BB%87_T%C3%B4ng.png",
    "Mice09090", "CC BY-SA 4.0", "later_depiction", "2020", "Tượng vua Trần Nghệ Tông")
BY["tran.huyen-tran"]["photo"] = photo(
    "f/fe/HuyenTran.jpg", "HuyenTran.jpg",
    "Lưu Ly", "Public domain", "later_depiction", "2008", "Tượng thờ Huyền Trân công chúa")
