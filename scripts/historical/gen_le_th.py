# ── Hậu Lê, giai đoạn LÊ TRUNG HƯNG (1533–1675, Toàn thư Q.16–19). Được exec trong gen_le.py (dùng chung P, U, G, H, c, reign, T…). ──
# Nối với Lê sơ qua Chiêu Tông (cha của Trang Tông) và qua Lê Khoáng (ông nội Thái Tổ = tổ nhánh Lê Trừ → Anh Tông).
# Toàn thư chỉ chép đến Gia Tông (1675); các đời sau (Hy Tông… Chiêu Thống) chưa có nguồn đã tải.

TT = {k: f"Trung hưng, {v} — {TD}" for k, v in {
    12: "Trang Tông", 13: "Trung Tông", 14: "Anh Tông", 15: "Thế Tông", 16: "Kính Tông", 17: "Thần Tông",
    18: "Chân Tông", 19: "Huyền Tông", 20: "Gia Tông"}.items()}

# ── Nhánh Lê Trừ → Anh Tông ────────────────────────────────────────
LIN = "初，太祖第二兄除，贈藍國公，今尊封弘裕王。除生康贈葵國公，今尊封顯功王。康生壽今尊封光業王。壽生維紹今尊封莊簡王。維紹生維絖今尊封孝宗仁皇帝。維絖娶東山縣布衛郷人，生帝"
P(key="le.tru", full_name="Lê Trừ", gender="M", parents="u.khoang--trinh-thi", titles=[{"title": "Lam quốc công (truy tặng)"}, {"title": "Hoằng Dụ vương (truy phong)"}],
  bio="Anh thứ hai của Lê Thái Tổ, con Lê Khoáng. Được truy tặng Lam quốc công; sau này nhà Lê trung hưng tôn phong Hoằng Dụ vương. Đây là tổ nhánh của Lê Anh Tông (trung hưng).",
  citations=[c("existence", 16, f"{TT[14]}", LIN), c("parents", 16, f"{TT[14]}", "初，太祖第二兄除，贈藍國公，今尊封弘裕王"),
             c("title:0", 16, f"{TT[14]}", "贈藍國公，今尊封弘裕王"), c("title:1", 16, f"{TT[14]}", "贈藍國公，今尊封弘裕王"),
             c("bio", 16, f"{TT[14]}", "初，太祖第二兄除，贈藍國公，今尊封弘裕王")])
U("u.tru", "le.tru")
P(key="le.khang", full_name="Lê Khang", gender="M", parents="u.tru", titles=[{"title": "Quỳ quốc công (truy tặng)"}, {"title": "Hiển Công vương (truy phong)"}],
  bio="Con Lê Trừ, cháu nội Lê Khoáng. Được truy tặng Quỳ quốc công, tôn phong Hiển Công vương (trung hưng).",
  citations=[c("existence", 16, f"{TT[14]}", "除生康贈葵國公，今尊封顯功王"), c("parents", 16, f"{TT[14]}", "除生康贈葵國公，今尊封顯功王"),
             c("title:0", 16, f"{TT[14]}", "除生康贈葵國公，今尊封顯功王"), c("title:1", 16, f"{TT[14]}", "除生康贈葵國公，今尊封顯功王"),
             c("bio", 16, f"{TT[14]}", "除生康贈葵國公，今尊封顯功王")])
U("u.khang", "le.khang")
P(key="le.tho", full_name="Lê Thọ", gender="M", parents="u.khang", titles=[{"title": "Quang Nghiệp vương (truy phong)"}],
  bio="Con Lê Khang. Được tôn phong Quang Nghiệp vương (trung hưng).",
  citations=[c("existence", 16, f"{TT[14]}", "康生壽今尊封光業王"), c("parents", 16, f"{TT[14]}", "康生壽今尊封光業王"),
             c("title:0", 16, f"{TT[14]}", "康生壽今尊封光業王"), c("bio", 16, f"{TT[14]}", "康生壽今尊封光業王")])
U("u.tho", "le.tho")
P(key="le.duy-thieu", full_name="Lê Duy Thiệu", gender="M", parents="u.tho", titles=[{"title": "Trang Giản vương (truy phong)"}],
  bio="Con Lê Thọ. Được tôn phong Trang Giản vương (trung hưng).",
  citations=[c("existence", 16, f"{TT[14]}", "壽生維紹今尊封莊簡王"), c("parents", 16, f"{TT[14]}", "壽生維紹今尊封莊簡王"),
             c("title:0", 16, f"{TT[14]}", "壽生維紹今尊封莊簡王"), c("bio", 16, f"{TT[14]}", "壽生維紹今尊封莊簡王")])
U("u.duy-thieu", "le.duy-thieu")
P(key="le.duy-quang", full_name="Lê Duy Quang", gender="M", parents="u.duy-thieu", titles=[{"title": "Hiếu Tông Nhân hoàng đế (truy tôn)"}],
  bio="Con Lê Duy Thiệu, cha của Lê Anh Tông (trung hưng). Lấy một phụ nữ làng Bố Vệ, huyện Đông Sơn (sử không ghi tên); sau được truy tôn Hiếu Tông Nhân hoàng đế.",
  citations=[c("existence", 16, f"{TT[14]}", "維紹生維絖今尊封孝宗仁皇帝"), c("parents", 16, f"{TT[14]}", "維紹生維絖今尊封孝宗仁皇帝"),
             c("title:0", 16, f"{TT[14]}", "維紹生維絖今尊封孝宗仁皇帝"),
             c("bio", 16, f"{TT[14]}", "維絖娶東山縣布衛郷人，生帝")])
U("u.duy-quang", "le.duy-quang")

# ── 12. Trang Tông ─────────────────────────────────────────────────
P(key="le.chieu-tong.pham-thi", full_name="Phạm Ngọc Quỳnh", gender="F",
  bio="Vợ Lê Chiêu Tông, mẹ Lê Trang Tông, người làng Cao Trĩ, huyện Thụy Nguyên.",
  citations=[c("existence", 16, f"{TT[12]}", "母范氏諱玉瓊，瑞源縣高峙册人"), c("bio", 16, f"{TT[12]}", "母范氏諱玉瓊，瑞源縣高峙册人")])
U("u.chieu-tong--pham-thi", "le.chieu-tong", "le.chieu-tong.pham-thi", 1, [c("union", 16, f"{TT[12]}", "帝乃昭宗之子，聖宗之玄孫，母范氏諱玉瓊")])
P(key="le.trang-tong", full_name="Lê Trang Tông", gender="M", parents="u.chieu-tong--pham-thi", nickname="Lê Ninh",
  death={"lunar_year": 1548, "lunar_month": 1, "lunar_day": 29}, lifespan=34,
  posthumous_name="Dụ hoàng đế",
  reigns=reign(12, "Trang Tông", 1533, 1548, [("Nguyên Hòa", 1533)]),
  bio="Con của Lê Chiêu Tông, chắt đời thứ tư của Lê Thánh Tông, tên húy Ninh. Khi Mạc Đăng Dung cướp ngôi, ông lánh ở Thanh Hóa; thái sư Hưng quốc công Nguyễn Kim cho người tìm, đón sang nước Ai Lao tôn lập. Tháng giêng năm Quý Tỵ (1533) lên ngôi ở Ai Lao, niên hiệu Nguyên Hòa, mở đầu thời Lê trung hưng; kết giao với chúa Ai Lao để lấy binh lương, dùng tướng giỏi. Ở ngôi 16 năm, mất ngày 29 tháng giêng năm Mậu Thân (1548), thọ 34 tuổi, thụy Dụ hoàng đế, miếu hiệu Trang Tông.",
  citations=[c("existence", 16, f"{TT[12]}", "諱寧，又諱㫬，在位十六年，壽三十四歳"),
             c("nickname", 16, f"{TT[12]}", "諱寧，又諱㫬，在位十六年，壽三十四歳", "Lê Ninh"),
             c("parents", 16, f"{TT[12]}", "帝乃昭宗之子，聖宗之玄孫，母范氏諱玉瓊，瑞源縣高峙册人"),
             c("lifespan", 16, f"{TT[12]}", "諱寧，又諱㫬，在位十六年，壽三十四歳", "34"),
             c("death", 16, "năm Mậu Thân (1548)", "春，正月二十九日，帝崩，太子暄立", "âm 1548-1-29"),
             c("posthumous_name", 16, "năm Mậu Thân (1548)", "上大行皇帝尊號，曰裕皇帝，廟號莊宗", "Dụ hoàng đế"),
             c("reign:0", 16, "năm Quý Tỵ (1533)", "春，正月，帝即位於哀牢，建元元和"),
             c("reign:0", 16, "năm Mậu Thân (1548)", "春，正月二十九日，帝崩，太子暄立"),
             c("bio", 16, f"{TT[12]}", "時莫登庸篡潜，帝避居清華，太師興國公阮淦，使人訪求，迎至哀牢國尊立之")])

# ── 13. Trung Tông ─────────────────────────────────────────────────
U("u.trang-tong--khuyet", "le.trang-tong")
P(key="le.trung-tong", full_name="Lê Trung Tông", gender="M", parents="u.trang-tong--khuyet", nickname="Lê Huyên",
  death={"lunar_year": 1556, "lunar_month": 1, "lunar_day": 24}, lifespan=22, posthumous_name="Vũ hoàng đế",
  reigns=reign(13, "Trung Tông", 1548, 1556, [("Thuận Bình", 1549)]),
  bio="Con trưởng của Lê Trang Tông, tên húy Huyên, lên ngôi năm 1548, niên hiệu Thuận Bình (1549). Toàn thư khen vua giao việc cho người trung mưu, dẹp loạn tiếm ngôi, có tài đế vương, nhưng sống không lâu, đất nước chưa lấy lại hết. Mất ngày 24 tháng giêng năm Bính Thìn (1556) không có con, thọ 22 tuổi, thụy Vũ hoàng đế, miếu hiệu Trung Tông.",
  citations=[c("existence", 16, f"{TT[13]}", "諱暄，莊宗長子，在位八年，壽二十二歳"),
             c("nickname", 16, f"{TT[13]}", "諱暄，莊宗長子，在位八年，壽二十二歳", "Lê Huyên"),
             c("parents", 16, f"{TT[13]}", "諱暄，莊宗長子，在位八年，壽二十二歳"),
             c("lifespan", 16, f"{TT[13]}", "諱暄，莊宗長子，在位八年，壽二十二歳", "22"),
             c("death", 16, "năm Bính Thìn (1556)", "春，正月二十四日，帝崩，無嗣", "âm 1556-1-24"),
             c("posthumous_name", 16, "năm Bính Thìn (1556)", "上大行皇帝尊號，曰武皇帝，廟號中宗", "Vũ hoàng đế"),
             c("reign:0", 16, "năm Mậu Thân (1548)", "春，正月二十九日，帝崩，太子暄立，以明年爲順平元年"),
             c("reign:0", 16, "năm Bính Thìn (1556)", "春，正月二十四日，帝崩，無嗣"),
             c("bio", 16, f"{TT[13]}", "帝委任忠謀，剿誅潜篡，可謂有帝王之略")])

# ── 14. Anh Tông (nhánh Lê Trừ) ────────────────────────────────────
P(key="le.anh-tong-th", full_name="Lê Anh Tông (trung hưng)", gender="M", parents="u.duy-quang", nickname="Lê Duy Bang",
  death={"lunar_year": 1573, "lunar_month": 1, "lunar_day": 22}, lifespan=42, posthumous_name="Tuấn hoàng đế",
  reigns=reign(14, "Anh Tông", 1556, 1573, [("Thiên Hựu", 1557), ("Chính Trị", 1558), ("Hồng Phúc", 1572)]),
  bio="Tên húy Duy Bang, chắt đời thứ năm của Lê Trừ (anh thứ hai của Lê Thái Tổ); cha là Duy Quang (truy tôn Hiếu Tông Nhân hoàng đế), mẹ người làng Bố Vệ, Đông Sơn. Khi Trung Tông mất không con, thái sư Lượng quốc công Trịnh Kiểm cùng các đại thần đón lập (1556). Ở ngôi 16 năm, tin lời gièm, chạy ra ngoài; chết ngày 22 tháng giêng năm Quý Dậu (1573) ở Lôi Dương, thọ 42 tuổi, thụy Tuấn hoàng đế, miếu hiệu Anh Tông.",
  citations=[c("existence", 16, f"{TT[14]}", "諱維邦，在位十六年，壽四十二歳"),
             c("nickname", 16, f"{TT[14]}", "諱維邦，在位十六年，壽四十二歳", "Lê Duy Bang"),
             c("parents", 16, f"{TT[14]}", "維絖娶東山縣布衛郷人，生帝"),
             c("lifespan", 16, f"{TT[14]}", "諱維邦，在位十六年，壽四十二歳", "42"),
             c("death", 17, "năm Quý Dậu (1573)", "二十二日，還至雷陽。是日帝崩", "âm 1573-1-22"),
             c("posthumous_name", 17, "năm Quý Dậu (1573)", "上尊號曰英宗峻皇帝", "Tuấn hoàng đế"),
             c("reign:0", 16, f"{TT[14]}", "時中宗崩，無嗣，太師諒國公鄭檢及大臣迎立之"),
             c("reign:0", 17, "năm Quý Dậu (1573)", "二十二日，還至雷陽。是日帝崩"),
             c("bio", 16, f"{TT[14]}", "帝以帝室之冑，賴勳臣尊立，圖復中興，眞天命有歸矣")])

# ── 15. Thế Tông ───────────────────────────────────────────────────
U("u.anh-tong-th--khuyet", "le.anh-tong-th")
P(key="le.the-tong", full_name="Lê Thế Tông", gender="M", parents="u.anh-tong-th--khuyet", nickname="Lê Duy Đàm",
  birth={"lunar_year": 1567, "lunar_month": 11}, death={"lunar_year": 1599, "lunar_month": 8, "lunar_day": 24}, lifespan=33,
  reigns=reign(15, "Thế Tông", 1573, 1599, [("Gia Thái", 1573), ("Quang Hưng", 1578)]),
  bio="Con thứ năm của Lê Anh Tông, tên húy Duy Đàm, sinh tháng 11 năm Chính Trị thứ 10 (Đinh Mão, 1567) ở xã Quảng Thi, huyện Thụy Nguyên. Năm Quý Dậu (1573), tả tướng Trịnh Tùng cùng các quan tôn hoàng tử lên ngôi, niên hiệu Gia Thái (1573), rồi Quang Hưng (1578). Ở ngôi 27 năm, Toàn thư khen vua trẻ tuổi mà giao việc cho công thần, dẹp xong kẻ phản loạn, thu lại cơ đồ cũ. Mất ngày 24 tháng 8 năm Kỷ Hợi (1599), thọ 33 tuổi.",
  citations=[c("existence", 17, f"{T[10] if False else 'Trung hưng, Thế Tông — ' + TD}", "諱維潭，英宗第五子，在位二十七年，壽三十三歳"),
             c("nickname", 17, "Trung hưng, Thế Tông — tiểu dẫn", "諱維潭，英宗第五子，在位二十七年，壽三十三歳", "Lê Duy Đàm"),
             c("parents", 17, "Trung hưng, Thế Tông — tiểu dẫn", "諱維潭，英宗第五子，在位二十七年，壽三十三歳"),
             c("birth", 17, "Trung hưng, Thế Tông — tiểu dẫn", "帝以正治十年十一月日誕生", "âm 1567-11",
               note="Toàn thư chỉ ghi tháng 11 năm Chính Trị 10 (Đinh Mão); ngày để trống."),
             c("lifespan", 17, "Trung hưng, Thế Tông — tiểu dẫn", "諱維潭，英宗第五子，在位二十七年，壽三十三歳", "33"),
             c("death", 17, "năm Kỷ Hợi (1599)", "二十四日，丑時，帝崩", "âm 1599-8-24"),
             c("reign:0", 17, "năm Quý Dậu (1573)", "左相鄭松曁文武臣僚等共尊皇子卽皇帝位，改元大赦"),
             c("reign:0", 17, "năm Kỷ Hợi (1599)", "二十四日，丑時，帝崩"),
             c("bio", 17, "Trung hưng, Thế Tông — tiểu dẫn", "帝以幼冲之年，信任勲臣，故能削平僭叛，光復舊物，身致太平")])

# ── 16. Kính Tông ──────────────────────────────────────────────────
U("u.the-tong--khuyet", "le.the-tong")
P(key="le.kinh-tong", full_name="Lê Kính Tông", gender="M", parents="u.the-tong--khuyet", nickname="Lê Duy Tân",
  death={"lunar_year": 1619, "lunar_month": 5, "lunar_day": 12}, lifespan=32, burial_place="Hoa Loan lăng",
  posthumous_name="Huệ hoàng đế",
  reigns=reign(16, "Kính Tông", 1599, 1619, [("Thận Đức", 1600), ("Hoằng Định", 1601)]),
  bio="Con thứ của Lê Thế Tông, tên húy Duy Tân, được bình an vương Trịnh Tùng lập sau khi anh (thái tử) bị cho là tính không thông minh, lên ngôi ngày 27 tháng 8 năm Kỷ Hợi (1599), niên hiệu Thận Đức (1600) rồi Hoằng Định (1601). Ở ngôi 20 năm, vua dung mạo hùng vĩ, giữ nghiệp yên ổn nhưng nghe lời tà mưu. Ngày 12 tháng 5 năm Kỷ Mùi (1619) bị ép thắt cổ chết, thọ 32 tuổi, thụy Huệ hoàng đế, miếu hiệu Kính Tông, táng Hoa Loan lăng.",
  citations=[c("existence", 18, "Trung hưng, Kính Tông — tiểu dẫn", "諱維新，世宗次子也，在位二十年，壽三十二崩，葬華巒陵"),
             c("nickname", 18, "Trung hưng, Kính Tông — tiểu dẫn", "諱維新，世宗次子也，在位二十年", "Lê Duy Tân"),
             c("parents", 18, "Trung hưng, Kính Tông — tiểu dẫn", "諱維新，世宗次子也，在位二十年，壽三十二崩，葬華巒陵"),
             c("lifespan", 18, "Trung hưng, Kính Tông — tiểu dẫn", "諱維新，世宗次子也，在位二十年，壽三十二崩，葬華巒陵", "32"),
             c("death", 18, "năm Kỷ Mùi (1619)", "五月十二日，遂逼絞帝，崩後追尊爲惠皇帝，廟號敬宗", "âm 1619-5-12"),
             c("burial_place", 18, "Trung hưng, Kính Tông — tiểu dẫn", "壽三十二崩，葬華巒陵", "Hoa Loan lăng"),
             c("posthumous_name", 18, "năm Kỷ Mùi (1619)", "崩後追尊爲惠皇帝，廟號敬宗", "Huệ hoàng đế"),
             c("reign:0", 17, "năm Kỷ Hợi (1599)", "乃奉次子維新立之，以本月二十七日卽位于行在，大赦改元"),
             c("reign:0", 18, "năm Kỷ Mùi (1619)", "五月十二日，遂逼絞帝，崩後追尊爲惠皇帝，廟號敬宗"),
             c("bio", 18, "Trung hưng, Kính Tông — tiểu dẫn", "帝容貌雄偉，繼體守成，而天下晏然，然偏聽邪謀，致有不祥之事")])
G("lang.hoa-loan", "Hoa Loan lăng", ["le.kinh-tong"],
  [c("existence", 18, "Trung hưng, Kính Tông — tiểu dẫn", "壽三十二崩，葬華巒陵"), c("occupant:0", 18, "Trung hưng, Kính Tông — tiểu dẫn", "壽三十二崩，葬華巒陵")],
  notes="Lăng Lê Kính Tông; Toàn thư chỉ ghi tên lăng.")
P(key="le.kinh-tong.trinh-thi", full_name="Trịnh Ngọc Trinh", gender="F", titles=[{"title": "Đoan Từ hoàng thái hậu"}],
  bio="Con gái thứ hai của Trịnh Tùng (thượng phụ bình an vương), vợ Lê Kính Tông, mẹ Lê Thần Tông, sinh ngày 19 tháng 11 năm Hoằng Định 8 (1607)? Sử chép ngày này liền sau tên bà; con lên ngôi tôn là Đoan Từ hoàng thái hậu.",
  citations=[c("existence", 18, "Trung hưng, Thần Tông — tiểu dẫn", "其母端慈皇太后鄭氏玉楨，乃尙父平安王之次女也"),
             c("title:0", 18, "Trung hưng, Thần Tông — tiểu dẫn", "其母端慈皇太后鄭氏玉楨"),
             c("bio", 18, "Trung hưng, Thần Tông — tiểu dẫn", "其母端慈皇太后鄭氏玉楨，乃尙父平安王之次女也")])
U("u.kinh-tong--trinh-thi", "le.kinh-tong", "le.kinh-tong.trinh-thi", 1, [c("union", 18, "Trung hưng, Thần Tông — tiểu dẫn", "敬宗長子也")])

# ── 17. Thần Tông (hai lần ở ngôi) ─────────────────────────────────
P(key="le.than-tong-th", full_name="Lê Thần Tông (trung hưng)", gender="M", parents="u.kinh-tong--trinh-thi", nickname="Lê Duy Kỳ",
  birth={"lunar_year": 1607, "lunar_month": 11, "lunar_day": 19}, death={"lunar_year": 1662}, lifespan=56, burial_place="Quần Ngọc lăng",
  reigns=[{"dynasty": "Lê", "ordinal": 17, "role": "emperor", "temple_name": "Thần Tông", "start_year": 1619, "end_year": 1643,
           "era_names": [{"name": "Vĩnh Tộ", "from_year": 1619}, {"name": "Đức Long", "from_year": 1629}, {"name": "Dương Hòa", "from_year": 1635}]},
          {"dynasty": "Lê", "ordinal": 17, "role": "emperor", "temple_name": "Thần Tông", "start_year": 1649, "end_year": 1662,
           "era_names": [{"name": "Thịnh Đức", "from_year": 1653}, {"name": "Vĩnh Thọ", "from_year": 1658}, {"name": "Vạn Khánh", "from_year": 1662}]}],
  bio="Con trưởng của Lê Kính Tông, tên húy Duy Kỳ, mẹ là con gái thứ hai Trịnh Tùng, sinh ngày 19 tháng 11 năm Hoằng Định 8 (Đinh Mùi, 1607). Kính Tông bị giết, Trịnh Tùng lập vua (tháng 6 năm Kỷ Mùi 1619), niên hiệu Vĩnh Tộ, Đức Long, Dương Hòa. Năm Quý Mùi (1643) nhường ngôi cho con là Chân Tông, làm thái thượng hoàng; năm 1649 Chân Tông mất không con, ông lên ngôi lần hai (niên hiệu Thịnh Đức, Vĩnh Thọ, Vạn Khánh). Ở ngôi tổng cộng 25 + 13 năm; Toàn thư khen vua thông minh, đọc rộng, nhưng chê cung đình không phép tắc, tin Phật. Mất năm Nhâm Dần (1662), thọ 56 tuổi, táng Quần Ngọc lăng, miếu hiệu Thần Tông.",
  citations=[c("existence", 18, "Trung hưng, Thần Tông — tiểu dẫn", "上，諱維祺，敬宗長子也，在位二十五年，遜位六年，復位十三年，壽五十六歳而崩，葬群玉陵"),
             c("nickname", 18, "Trung hưng, Thần Tông — tiểu dẫn", "上，諱維祺，敬宗長子也", "Lê Duy Kỳ"),
             c("parents", 18, "Trung hưng, Thần Tông — tiểu dẫn", "其母端慈皇太后鄭氏玉楨，乃尙父平安王之次女也"),
             c("birth", 18, "Trung hưng, Thần Tông — tiểu dẫn", "以弘定八年丁未十一月十九日誕生", "âm 1607-11-19"),
             c("lifespan", 18, "Trung hưng, Thần Tông — tiểu dẫn", "壽五十六歳而崩，葬群玉陵", "56"),
             c("death", 18, "năm Nhâm Dần (1662)", "二十二日，帝崩", "âm 1662", note="Toàn thư ghi ngày 22 sau tháng 9 (Vạn Khánh nguyên niên); tháng không rõ."),
             c("burial_place", 18, "Trung hưng, Thần Tông — tiểu dẫn", "壽五十六歳而崩，葬群玉陵", "Quần Ngọc lăng"),
             c("reign:0", 18, "Trung hưng, Thần Tông — tiểu dẫn", "在位二十五年，遜位六年，復位十三年"),
             c("reign:0", 18, "năm Quý Mùi (1643)", "詔傳位於皇太子維祐，卽皇帝位于勤政殿，改元爲福泰元年"),
             c("reign:1", 18, "năm Kỷ Sửu (1649)", "奏請太上皇復帝位，改元爲慶德元年"),
             c("reign:1", 18, "năm Nhâm Dần (1662)", "二十二日，帝崩"),
             c("bio", 18, "Trung hưng, Thần Tông — tiểu dẫn", "帝隆準龍顔，聰明博覧，深畧緯文，可稱令辟，然宮闈無制，教惑浮屠，此其所短也")])
G("lang.quan-ngoc", "Quần Ngọc lăng", ["le.than-tong-th"],
  [c("existence", 18, "Trung hưng, Thần Tông — tiểu dẫn", "壽五十六歳而崩，葬群玉陵"), c("occupant:0", 18, "Trung hưng, Thần Tông — tiểu dẫn", "壽五十六歳而崩，葬群玉陵")],
  notes="Lăng Lê Thần Tông; Toàn thư chỉ ghi tên lăng.")

# ── 18. Chân Tông ──────────────────────────────────────────────────
U("u.than-tong--khuyet", "le.than-tong-th")
P(key="le.chan-tong", full_name="Lê Chân Tông", gender="M", parents="u.than-tong--khuyet", nickname="Lê Duy Hựu",
  death={"lunar_year": 1649, "lunar_month": 8}, lifespan=20, burial_place="Hoa Phố lăng",
  reigns=reign(18, "Chân Tông", 1643, 1649, [("Phúc Thái", 1643)]),
  bio="Con trưởng của Lê Thần Tông, tên húy Duy Hựu, 13 tuổi nhận ngôi từ cha (tháng 10 năm Quý Mùi 1643), niên hiệu Phúc Thái. Ở ngôi 7 năm; Toàn thư khen tính trầm lặng, rộng lượng, mấy năm liền được mùa. Mất tháng 8 năm Kỷ Sửu (1649) không có con, thọ 20 tuổi, táng Hoa Phố lăng.",
  citations=[c("existence", 18, "Trung hưng, Chân Tông — tiểu dẫn", "諱維祐，神宗長子也。十三歳受禪，在位七年，壽二十而崩，葬花浦陵"),
             c("nickname", 18, "Trung hưng, Chân Tông — tiểu dẫn", "諱維祐，神宗長子也", "Lê Duy Hựu"),
             c("parents", 18, "Trung hưng, Chân Tông — tiểu dẫn", "諱維祐，神宗長子也"),
             c("lifespan", 18, "Trung hưng, Chân Tông — tiểu dẫn", "十三歳受禪，在位七年，壽二十而崩，葬花浦陵", "20"),
             c("death", 18, "năm Kỷ Sửu (1649)", "秋，八月，帝崩，無嗣", "âm 1649-8"),
             c("burial_place", 18, "Trung hưng, Chân Tông — tiểu dẫn", "壽二十而崩，葬花浦陵", "Hoa Phố lăng"),
             c("reign:0", 18, "năm Quý Mùi (1643)", "詔傳位於皇太子維祐，卽皇帝位于勤政殿，改元爲福泰元年"),
             c("reign:0", 18, "năm Kỷ Sửu (1649)", "秋，八月，帝崩，無嗣"),
             c("bio", 18, "Trung hưng, Chân Tông — tiểu dẫn", "帝天性沉潛，寛容博厚，有人君之德")])
G("lang.hoa-pho", "Hoa Phố lăng", ["le.chan-tong"],
  [c("existence", 18, "Trung hưng, Chân Tông — tiểu dẫn", "壽二十而崩，葬花浦陵"), c("occupant:0", 18, "Trung hưng, Chân Tông — tiểu dẫn", "壽二十而崩，葬花浦陵")],
  notes="Lăng Lê Chân Tông; Toàn thư chỉ ghi tên lăng.")

# ── 19. Huyền Tông ─────────────────────────────────────────────────
P(key="le.huyen-tong", full_name="Lê Huyền Tông", gender="M", parents="u.than-tong--khuyet", nickname="Lê Duy Vũ",
  death={"lunar_year": 1671, "lunar_month": 10, "lunar_day": 15}, lifespan=18, burial_place="Bạo Thịnh lăng",
  posthumous_name="Hoát Đạt Duệ Thông Cương Nghị Trung Chính Ôn Nhu Hòa Lạc Khâm Minh Văn Tư Doãn Cung Khắc Nhượng Mục hoàng đế",
  reigns=reign(19, "Huyền Tông", 1662, 1671, [("Cảnh Trị", 1663)]),
  bio="Con của Lê Thần Tông, em Chân Tông, tên húy Duy Vũ, lên ngôi năm 1662, niên hiệu Cảnh Trị (1663). Toàn thư nói vua nhân hậu, thiên tư đoan nghiêm, trong thời ông trị vì đất nước yên ổn, mùa màng bội thu; năm 1663 ban 47 điều giáo hóa. Mất ngày 15 tháng 10 năm Tân Hợi (1671), thọ 18 tuổi, thụy Mục hoàng đế, miếu hiệu Huyền Tông, táng Bạo Thịnh lăng.",
  citations=[c("existence", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "諱維䄔，神宗之子，眞宗之弟，在位九年，壽十八歲而崩，葬暴盛陵"),
             c("nickname", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "諱維䄔，神宗之子，眞宗之弟", "Lê Duy Vũ"),
             c("parents", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "神宗之子，眞宗之弟"),
             c("lifespan", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "在位九年，壽十八歲而崩，葬暴盛陵", "18"),
             c("death", 19, "năm Tân Hợi (1671)", "冬，十月十五日，帝崩，群臣上尊號曰：豁達睿聰剛毅中正溫柔和樂欽明文思允恭克讓穆皇帝，廟號玄宗", "âm 1671-10-15"),
             c("burial_place", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "壽十八歲而崩，葬暴盛陵", "Bạo Thịnh lăng"),
             c("posthumous_name", 19, "năm Tân Hợi (1671)", "群臣上尊號曰：豁達睿聰剛毅中正溫柔和樂欽明文思允恭克讓穆皇帝，廟號玄宗",
               "Hoát Đạt Duệ Thông Cương Nghị Trung Chính Ôn Nhu Hòa Lạc Khâm Minh Văn Tư Doãn Cung Khắc Nhượng Mục hoàng đế"),
             c("reign:0", 18, "năm Nhâm Dần (1662)", "朕居諒陰，自以幼冲難當負荷，然念宗廟大器，社稷重寄，弗堪辭遜，惟謹遵承，廼於本年本月日卽皇帝位，大赦改元，以明年癸卯爲景治元年"),
             c("reign:0", 19, "năm Tân Hợi (1671)", "冬，十月十五日，帝崩"),
             c("bio", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "帝天資仁厚，神釆端嚴，居拱之年，海内安治，年穀豐登，亦可謂賢君矣")])
G("lang.bao-thinh", "Bạo Thịnh lăng", ["le.huyen-tong"],
  [c("existence", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "壽十八歲而崩，葬暴盛陵"), c("occupant:0", 19, "Trung hưng, Huyền Tông — tiểu dẫn", "壽十八歲而崩，葬暴盛陵")],
  notes="Lăng Lê Huyền Tông; Toàn thư chỉ ghi tên lăng (chữ 暴盛, âm đọc ghi theo Hán-Việt thông thường).")

# ── 20. Gia Tông ───────────────────────────────────────────────────
P(key="le.gia-tong", full_name="Lê Gia Tông", gender="M", parents="u.than-tong--khuyet", nickname="Lê Duy Cối",
  death={"lunar_year": 1675, "lunar_month": 4, "lunar_day": 3}, lifespan=15, burial_place="Phúc An lăng",
  posthumous_name="Khoan Minh Mẫn Đạt Anh Quả Huy Nhu Khắc Nhân Đốc Nghĩa Mỹ hoàng đế",
  reigns=reign(20, "Gia Tông", 1672, 1675, [("Dương Đức", 1672), ("Đức Nguyên", 1674)]),
  bio="Con thứ của Lê Thần Tông, tên húy Duy Cối; Thần Tông mất khi vua mới hai tuổi, vương cho chính phi họ Trịnh nuôi trong cung. Huyền Tông mất không có con thì ông lên ngôi (1672), niên hiệu Dương Đức (1672), rồi Đức Nguyên (1674). Ở ngôi 4 năm, Toàn thư khen thể chất hùng vĩ, tính rộng hòa, có đức người làm vua. Mất ngày 3 tháng 4 năm Ất Mão (1675), thọ 15 tuổi, thụy Mỹ hoàng đế, miếu hiệu Gia Tông, táng Phúc An lăng.",
  citations=[c("existence", 19, "Trung hưng, Gia Tông — tiểu dẫn", "諱維禬，神宗次子也"),
             c("nickname", 19, "Trung hưng, Gia Tông — tiểu dẫn", "諱維禬，神宗次子也", "Lê Duy Cối"),
             c("parents", 19, "Trung hưng, Gia Tông — tiểu dẫn", "諱維禬，神宗次子也"),
             c("lifespan", 19, "Trung hưng, Gia Tông — tiểu dẫn", "在位四年崩，壽十五歳，葬福安陵", "15"),
             c("death", 19, "năm Ất Mão (1675)", "夏，四月三日，帝崩，群臣上尊號曰寛明敏達英果徽柔克仁篤義美皇帝，廟號嘉宗", "âm 1675-4-3"),
             c("burial_place", 19, "Trung hưng, Gia Tông — tiểu dẫn", "壽十五歳，葬福安陵", "Phúc An lăng"),
             c("posthumous_name", 19, "năm Ất Mão (1675)", "群臣上尊號曰寛明敏達英果徽柔克仁篤義美皇帝，廟號嘉宗",
               "Khoan Minh Mẫn Đạt Anh Quả Huy Nhu Khắc Nhân Đốc Nghĩa Mỹ hoàng đế"),
             c("reign:0", 19, "năm Ất Mão (1675)", "玄宗崩，無嗣，遂登大寶，在位四年崩") if False else c("reign:0", 19, "Trung hưng, Gia Tông — tiểu dẫn", "玄宗崩，無嗣，遂登大寶，在位四年崩"),
             c("reign:0", 19, "năm Ất Mão (1675)", "夏，四月三日，帝崩"),
             c("bio", 19, "Trung hưng, Gia Tông — tiểu dẫn", "帝體貌英偉，天性寛和，有人君之德，惜夫享國不久，未見其有爲也")])
G("lang.phuc-an", "Phúc An lăng", ["le.gia-tong"],
  [c("existence", 19, "Trung hưng, Gia Tông — tiểu dẫn", "壽十五歳，葬福安陵"), c("occupant:0", 19, "Trung hưng, Gia Tông — tiểu dẫn", "壽十五歳，葬福安陵")],
  notes="Lăng Lê Gia Tông; Toàn thư chỉ ghi tên lăng.")

# ── Di sản ─────────────────────────────────────────────────────────
H("ds.dung-nghiep-ai-lao", "story", "Dựng lại nhà Lê ở Ai Lao (1533)",
  "Tháng giêng năm Quý Tỵ (1533), con Lê Chiêu Tông lên ngôi ở Ai Lao, mở đầu thời Lê trung hưng.",
  "Khi Mạc Đăng Dung cướp ngôi, con cháu nhà Lê tản mác. Thái sư Hưng quốc công Nguyễn Kim cho người tìm kiếm, tìm được con Lê Chiêu Tông là Lê Ninh đang lánh ở Thanh Hóa, đón sang nước Ai Lao tôn lập. Tháng giêng năm Quý Tỵ (1533), vua lên ngôi ở Ai Lao, đặt niên hiệu Nguyên Hòa, phong Nguyễn Kim làm Thượng phụ Thái sư Hưng quốc công nắm việc trong ngoài; kết thân với chúa Ai Lao để có binh lương mưu tiến công. Từ đó nhà Lê mở thời trung hưng, chia đôi đất nước với nhà Mạc.",
  [("le.trang-tong", "được tôn lập ở Ai Lao")],
  [c("existence", 16, "năm Quý Tỵ (1533)", "春，正月，帝即位於哀牢，建元元和，尊大將軍阮淦爲尙父太師興國公，掌內外事"),
   c("body", 16, f"{TT[12]}", "時莫登庸篡潜，帝避居清華，太師興國公阮淦，使人訪求，迎至哀牢國尊立之"),
   c("body", 16, "năm Quý Tỵ (1533)", "又與哀牢主乍斗相結，資其兵糧，以圖進取"),
   c("person:0", 16, "năm Quý Tỵ (1533)", "春，正月，帝即位於哀牢，建元元和"),
   c("location_name", 16, "năm Quý Tỵ (1533)", "春，正月，帝即位於哀牢，建元元和", "Ai Lao (Lào)", note="Ai Lao là nước Lào ngày nay.")],
  "Ai Lao (Lào)")
H("ds.sac-phong-an-nam-quoc-vuong", "artifact", "Sắc phong và ấn An Nam quốc vương của nhà Minh (1646–1647)",
  "Năm 1646 nhà Nam Minh cử sứ mang sắc, cáo mệnh và ấn mạ vàng bạc sang phong Thái thượng hoàng Lê Thần Tông làm An Nam quốc vương.",
  "Năm Bính Tuất (1646), Lê Thần Tông cử sứ bộ cùng sứ nhà Minh theo đường biển sang Phúc Kiến cầu phong. Vua nhà Minh đang bị quân Thanh đánh bại, các quan tôn lập Vĩnh Lịch hoàng đế; hoàng đế này sai Hàn lâm Phan Kỳ mang sắc thư, cáo mệnh cùng ấn mạ vàng bạc sang nước ta, sách phong Thái thượng hoàng làm An Nam quốc vương. Sứ Minh đi đường bộ qua Trấn Nam Quan. Mùa hạ năm Đinh Hợi (1647), các quan ra cửa ải đón sứ mang ấn về kinh.",
  [("le.than-tong-th", "được phong An Nam quốc vương")],
  [c("existence", 18, "năm Bính Tuất (1646)", "明帝因遣翰林潘琦等齎勅書誥命，幷塗金銀印往本國，册封太上皇爲安南國王"),
   c("body", 18, "năm Bính Tuất (1646)", "差正使阮仁政，副使范永綿，陳槩，阮滚等同天朝使都督林參駕海往福建，求封于明"),
   c("body", 18, "năm Đinh Hợi (1647)", "夏，五月，阮仁政等候明使齋封印到關"),
   c("person:0", 18, "năm Bính Tuất (1646)", "册封太上皇爲安南國王")], None)
H("ds.giao-hoa-47-dieu", "custom", "Bốn mươi bảy điều giáo hóa (1663)",
  "Tháng 7 năm Quý Mão (1663), Lê Huyền Tông ban bốn mươi bảy điều răn dạy về hiếu nghĩa, hôn nhân, tang lễ, làng xóm.",
  "Mùa thu tháng 7 năm Quý Mão (Cảnh Trị 1, 1663), triều đình ban bốn mươi bảy điều giáo hóa gồm: làm tôi tận trung, làm con hết hiếu, anh em hòa thuận, vợ chồng yêu kính, bạn bè giữ chữ tín; cha mẹ tu thân để dạy con, thầy trò đối đãi theo đạo, gia trưởng lập giáo bằng lễ; người trong làng xóm kính nhường tuổi tác; không cậy mạnh hiếp yếu; không dùng đồng cốt; tang lễ tùy sức, đừng đòi ăn uống; cùng làng không cướp của nhau… Các điều này được sao gửi đến mọi nha môn ở phủ, huyện, châu để treo lên.",
  [("le.huyen-tong", "ban hành")],
  [c("existence", 19, "năm Quý Mão (1663)", "秋，七月，申明敎化四十七條"),
   c("body", 19, "năm Quý Mão (1663)", "爲臣盡忠，爲子止孝，兄弟相和睦，夫妻相愛敬，朋友止信以輔仁"),
   c("body", 19, "năm Quý Mão (1663)", "喪禮各隨豐儉，毋索飲食"),
   c("person:0", 19, "năm Quý Mão (1663)", "秋，七月，申明敎化四十七條")], None)
