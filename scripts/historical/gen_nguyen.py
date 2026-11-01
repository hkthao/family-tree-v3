"""Sinh data/historical/nguyen.json — khung gia phả Nhà Nguyễn (BẢN NHÁP, đợt 1:
tổ tiên → các chúa Nguyễn → Hưng Tổ → Gia Long + gia đình Gia Long).

  bash scripts/historical/fetch_nguyen.sh /tmp/nguyen-src
  python3 -I scripts/historical/gen_nguyen.py data/historical/nguyen.json /tmp/nguyen-src

Nguồn: Đại Nam thực lục Tiền biên Q.1–12 (DNTL), Chính biên Q.1 kỷ 1 (DNTL),
Đại Nam liệt truyện sơ tập Q.1–2 (DNLT) — nguyên văn chữ Hán zh.wikisource.
MỌI trích dẫn được kiểm có THẬT trong nguyên văn ngay lúc sinh file (sai là dừng).
Giá trị (value), tiểu sử là phiên âm/dịch của người soạn — người duyệt kiểm lại.

Chưa có (nguồn chưa nằm trên Wikisource): ngày mất, thụy hiệu, lăng của Gia Long (Chính
biên kỷ 1 quyển cuối). Sinh lại file sẽ ghi đè trạng thái duyệt.
"""
import json
import re
import sys

OUT, SRC = sys.argv[1], sys.argv[2]


def clean(t):
    t = re.sub(r"<ref>.*?</ref>", "", t)
    t = re.sub(r"\{\{漏字\|([^|}]*)\|[^}]*\}\}", r"\1", t)
    t = re.sub(r"\{\{[*注註]\|([^}]*)\}\}", r"（\1）", t)
    return re.sub(r"\{\{[^}]*\}\}", "", t)


def load(path):
    return re.sub(r"\s+", "", clean(open(f"{SRC}/{path}", encoding="utf8").read()))


TB = {n: load(f"tb/tb_{n:02d}.txt") for n in range(1, 13)}
CB = {k: load(f"cb/cb_{h}_q1.txt") for k, h in {1: "一", 2: "二", 3: "三", 4: "四", 5: "五"}.items()}
LT1 = {n: load(f"lt1/lt1_{n:02d}.txt") for n in (1, 2)}
LT2 = {n: load(f"lt2/lt2_{n:02d}.txt") for n in (1, 2, 4, 5, 6)}
TEXT = {"tb": TB, "cb": CB, "lt": LT1, "lt2": LT2}
BAD = []


def c(field, src, vol, where, quote, value=None, note=None):
    """src: tb (Tiền biên) | cb (Chính biên, vol = số kỷ, quyển 1) | lt (Liệt truyện sơ tập) | lt2 (nhị tập)."""
    if re.sub(r"\s+", "", quote) not in TEXT[src][vol]:
        BAD.append((src, vol, quote))
    code, loc = {"tb": lambda: ("DNTL", f"Tiền biên Q.{vol}"),
                 "cb": lambda: ("DNTL", f"Chính biên, Đệ {'nhất nhị tam tứ ngũ'.split()[vol - 1]} kỷ, Q.1"),
                 "lt": lambda: ("DNLT", f"Sơ tập Q.{vol}"), "lt2": lambda: ("DNLT", f"Nhị tập Q.{vol}")}[src]()
    d = {"field": field, "source": code, "locator": f"{loc}, {where}", "quote": quote}
    if value is not None:
        d["value"] = value
    if note:
        d["note"] = note
    return d


DRAFT = {"status": "draft", "note": "Đợt 1 — trích từ nguyên văn Đại Nam thực lục / Liệt truyện; cần người duyệt đối chiếu bản dịch."}
persons, unions = [], []


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


def lord(n, key, name, parents, ordinal, temple, start, end, **kw):
    """Một chúa Nguyễn: reign role 'lord'."""
    P(key=key, full_name=name, gender="M", parents=parents,
      reigns=[{"dynasty": "Chúa Nguyễn", "ordinal": ordinal, "role": "lord", "temple_name": temple,
               "start_year": start, "end_year": end}], **kw)


NAC = "Nguyễn Phúc" 
# ── Tổ tiên ───────────────────────────────────────────────────────────
TD = "tiểu dẫn Thái Tổ"
P(key="nguyen.van-luu", full_name="Nguyễn Văn Lựu", gender="M", is_root=True,
  titles=[{"title": "Thái phó Trừng quốc công"}],
  bio="Tổ nhà Thái Tổ Gia Dụ hoàng đế; 8 tuổi biết làm văn, 15 tuổi thạo võ nghệ. Đời Lê Hiến Tông làm Kinh lược sứ Đà Giang. Khi Uy Mục đế vô đạo thì về miền Tây, giúp Lê Oanh khởi binh ở Thanh Hoa; Oanh lên ngôi (Tương Dực đế), phong Thái phó Trừng quốc công. Là tổ xa nhất mà chính sử chép tên.",
  citations=[c("existence", "tb", 1, TD, "祖澄國公，諱文溜"),
             c("title:0", "tb", 1, TD, "封太傅澄國公"),
             c("bio", "tb", 1, TD, "八歲能文，十五歲嫻習武藝")])
U("u.van-luu", "nguyen.van-luu")
P(key="nguyen.trieu-to", full_name="Nguyễn Triệu Tổ", gender="M", parents="u.van-luu",
  titles=[{"title": "Hữu vệ điện tiền tướng quân An Thanh hầu"}, {"title": "Miếu hiệu Triệu Tổ Tĩnh hoàng đế, truy tôn đời Gia Long"}],
  bio="Con trưởng của Văn Lựu. Tên húy là 淦. Ban đầu làm quan nhà Lê chức Hữu vệ điện tiền tướng quân, An Thanh hầu. Năm Bính Tuất (1526) Mạc Đăng Dung cướp ngôi; ông đem con em sang nước Ai Lao, chiêu tập hào kiệt, mưu tìm con cháu nhà Lê để lập lại.",
  citations=[c("existence", "tb", 1, TD, "考肇祖靖皇帝，諱淦，澄國公長子"),
             c("parents", "tb", 1, TD, "澄國公長子"),
             c("title:0", "tb", 1, TD, "初仕黎爲右衛殿前將軍、安清侯"),
             c("title:1", "tb", 1, TD, "考肇祖靖皇帝"),
             c("bio", "tb", 1, TD, "肇祖憤莫僭逆，志圖匡復，乃率子弟避于哀牢國")])

# ── Chúa Nguyễn ───────────────────────────────────────────────────────
U("u.trieu-to", "nguyen.trieu-to")
lord(1, "nguyen.thai-to", "Nguyễn Thái Tổ", "u.trieu-to", 1, "Thái Tổ", 1558, 1613,
     nickname="Nguyễn Hoàng",
     birth={"lunar_year": 1525, "lunar_month": 8},
     death={"lunar_year": 1613, "lunar_month": 6}, lifespan=89,
     burial_place="Núi La Khê (Hương Trà); lăng Trường Cơ",
     posthumous_name="Cẩn Nghĩa Đạt Lý Hiển Ứng Chiêu Hựu Diệu Linh Gia Dụ hoàng đế",
     bio="Họ Nguyễn, tên húy là Hoàng, người xã Gia Miêu ngoại, huyện Tống Sơn, phủ Hà Trung, Thanh Hoa; con thứ hai của Triệu Tổ. Sinh tháng 8 năm Ất Dậu (1525). Mùa đông tháng 10 năm Mậu Ngọ (1558), 34 tuổi, bắt đầu trấn giữ Thuận Hóa, được dân gọi là Tiên chúa. Mất ngày Canh Dần tháng 6 năm Quý Sửu (1613), ở ngôi 58 năm, thọ 89 tuổi; sau được truy tôn miếu hiệu Thái Tổ, lăng Trường Cơ.",
     citations=[c("existence", "tb", 1, TD, "姓阮氏，諱潢"),
                c("nickname", "tb", 1, TD, "姓阮氏，諱潢", "Nguyễn Hoàng"),
                c("parents", "tb", 1, TD, "肇祖靖皇帝第二子也"),
                c("birth", "tb", 1, TD, "聖誕乙酉年（黎統元四年，明嘉靖四年）秋八月丙寅", "âm 1525-8"),
                c("death", "tb", 1, "năm Quý Sửu (1613)", "六月庚寅，大漸", "âm 1613-6"),
                c("lifespan", "tb", 1, "năm Quý Sửu (1613)", "是日上崩，在位五十八年，壽八十有九", "89"),
                c("burial_place", "tb", 1, "năm Quý Sửu (1613)", "後改寧陵于羅溪（社名，屬香茶縣）山", "Núi La Khê (Hương Trà); lăng Trường Cơ"),
                c("posthumous_name", "tb", 1, "năm Quý Sửu (1613)", "嘉隆五年，追尊為肇基垂統欽明恭懿謹義達理顯應昭祐耀靈嘉裕皇帝，廟號太祖，陵名長基",
                  "Cẩn Nghĩa Đạt Lý Hiển Ứng Chiêu Hựu Diệu Linh Gia Dụ hoàng đế"),
                c("reign:0", "tb", 1, "năm Mậu Ngọ (1558)", "戊午元年（黎正治元年，明嘉靖三十七年）冬十月，上初鎮順化，時年三十四"),
                c("reign:0", "tb", 1, "năm Quý Sửu (1613)", "是日上崩，在位五十八年，壽八十有九"),
                c("bio", "tb", 1, TD, "清華河中府宋山縣嘉苗外庄人")])
U("u.thai-to", "nguyen.thai-to")
lord(2, "nguyen.hy-tong", "Nguyễn Hy Tông", "u.thai-to", 2, "Hy Tông", 1613, 1635,
     nickname="Nguyễn Phúc Nguyên",
     birth={"lunar_year": 1563}, death={"lunar_year": 1635}, lifespan=73,
     burial_place="Núi Quảng Điền, sau cải táng Hải Cát; lăng Trường Diễn",
     posthumous_name="Hiển Mô Quang Liệt Ôn Cung Minh Duệ Dực Thiện Tuy Du Hiếu Văn hoàng đế",
     bio="Tên húy là Nguyên, con thứ sáu của Thái Tổ. Sinh năm Quý Hợi (1563). Mùa hạ tháng 6 năm Quý Sửu (1613), Thái Tổ mất, ông nối ngôi; từ đó họ nước được gọi là Nguyễn Phúc. Mất năm Ất Hợi (1635), ở ngôi 22 năm, thọ 73 tuổi, miếu hiệu Hy Tông, lăng Trường Diễn.",
     citations=[c("existence", "tb", 2, "tiểu dẫn", "熙宗顯謨光烈溫恭明睿翼善綏猷孝文皇帝，諱源"),
                c("nickname", "tb", 2, "tiểu dẫn", "自是始稱國姓為阮福氏", "Nguyễn Phúc Nguyên", note="Chép họ 阮福氏 từ đời này."),
                c("parents", "tb", 2, "tiểu dẫn", "太祖嘉裕皇帝第六子也"),
                c("birth", "tb", 2, "tiểu dẫn", "聖誕癸亥年（黎正治六年，明嘉靖四十二年）", "âm 1563"),
                c("death", "tb", 2, "cuối quyển", "是日上崩，在位二十二年，壽七十有三", "âm 1635"),
                c("lifespan", "tb", 2, "cuối quyển", "壽七十有三", "73"),
                c("burial_place", "tb", 2, "cuối quyển", "寧陵于廣田山，後改寧陵于海葛（坊名屬香茶縣）", "Núi Quảng Điền, sau cải táng Hải Cát; lăng Trường Diễn"),
                c("posthumous_name", "tb", 2, "cuối quyển", "嘉隆五年，追尊為顯謨光烈溫恭明睿翼善綏猷孝文皇帝，廟號熙宗，陵名長衍",
                  "Hiển Mô Quang Liệt Ôn Cung Minh Duệ Dực Thiện Tuy Du Hiếu Văn hoàng đế"),
                c("reign:0", "tb", 2, "tiểu dẫn", "癸丑夏六月庚寅，太祖崩"),
                c("reign:0", "tb", 2, "cuối quyển", "是日上崩，在位二十二年，壽七十有三"),
                c("bio", "tb", 2, "tiểu dẫn", "上嗣位，修城堡、設關汛、撫循軍民，中外莫不悅服，時稱佛主")])
U("u.hy-tong", "nguyen.hy-tong")
lord(3, "nguyen.than-tong", "Nguyễn Thần Tông", "u.hy-tong", 3, "Thần Tông", 1635, 1648,
     birth={"lunar_year": 1601}, death={"lunar_year": 1648}, lifespan=48,
     burial_place="Núi An Bằng (Hương Trà); lăng Trường Diên",
     posthumous_name="Thừa Cơ Toản Thống Cương Minh Hùng Nghị Uy Đoán Anh Vũ Hiếu Chiêu hoàng đế",
     bio="Con thứ hai của Hy Tông, sinh năm Tân Sửu (1601). Khi Hy Tông mất (tháng 10 năm Ất Hợi 1635) ông 35 tuổi, nối ngôi. Mất trên ngự thuyền ở Tam Giang hải nhi, ở ngôi 13 năm, thọ 48 tuổi (1648); miếu hiệu Thần Tông, lăng Trường Diên.",
     citations=[c("existence", "tb", 3, "tiểu dẫn", "神宗承基纘統剛明雄毅威斷英武孝昭皇帝"),
                c("parents", "tb", 3, "tiểu dẫn", "熙宗孝文皇帝第二子也"),
                c("birth", "tb", 3, "tiểu dẫn", "聖誕辛丑年（黎弘定二年，明萬曆二十九年）", "âm 1601"),
                c("death", "tb", 3, "cuối quyển", "辛卯還至三江海兒崩于御舟，在位十三年，壽四十有八", "âm 1648"),
                c("lifespan", "tb", 3, "cuối quyển", "壽四十有八", "48"),
                c("burial_place", "tb", 3, "cuối quyển", "寧陵于安憑（社名，屬香茶縣）山", "Núi An Bằng (Hương Trà); lăng Trường Diên"),
                c("posthumous_name", "tb", 3, "cuối quyển", "嘉隆五年，追尊為承基纘統剛明雄毅威斷英武孝昭皇帝，廟號神宗，陵名長延",
                  "Thừa Cơ Toản Thống Cương Minh Hùng Nghị Uy Đoán Anh Vũ Hiếu Chiêu hoàng đế"),
                c("reign:0", "tb", 3, "tiểu dẫn", "乙亥冬十月丁亥，熙宗孝文皇帝崩，上時三十五"),
                c("reign:0", "tb", 3, "cuối quyển", "在位十三年，壽四十有八"),
                c("bio", "tb", 3, "tiểu dẫn", "上既親政，以恩惠撫黎庶")])
U("u.than-tong", "nguyen.than-tong")
lord(4, "nguyen.thai-tong", "Nguyễn Thái Tông", "u.than-tong", 4, "Thái Tông", 1648, 1687,
     nickname="Nguyễn Phúc Tần",
     birth={"lunar_year": 1620}, death={"lunar_year": 1687, "lunar_month": 3}, lifespan=68,
     burial_place="Núi Hải Cát; lăng Trường Hưng",
     posthumous_name="Tuyên Uy Kiến Vũ Anh Minh Trang Chính Thánh Đức Thần Công Hiếu Triết hoàng đế",
     bio="Tên húy là Tần, con thứ hai của Thần Tông, sinh năm Canh Thân (1620). Năm Mậu Tý (1648) Thần Tông mất, ông 29 tuổi nối ngôi, được gọi là Hiền chúa. Mất tháng 3 năm Đinh Mão (1687), ở ngôi 39 năm, thọ 68 tuổi; miếu hiệu Thái Tông, lăng Trường Hưng.",
     citations=[c("existence", "tb", 4, "tiểu dẫn", "太宗宣威建武英明莊正聖德神功孝哲皇帝，諱瀕"),
                c("nickname", "tb", 4, "tiểu dẫn", "太宗宣威建武英明莊正聖德神功孝哲皇帝，諱瀕", "Nguyễn Phúc Tần", note="Họ Phúc theo Q.2."),
                c("parents", "tb", 4, "tiểu dẫn", "神宗孝昭皇帝第二子也"),
                c("birth", "tb", 4, "tiểu dẫn", "聖誕庚申年（黎永祚二年，明萬曆四十八年）", "âm 1620"),
                c("death", "tb", 5, "cuối quyển", "丁卯三十九年春三月，上不豫", "âm 1687-3"),
                c("lifespan", "tb", 5, "cuối quyển", "言訖而崩。在位三十九年，壽六十有八", "68"),
                c("burial_place", "tb", 5, "cuối quyển", "寧陵于海葛山", "Núi Hải Cát; lăng Trường Hưng"),
                c("posthumous_name", "tb", 5, "cuối quyển", "嘉隆五年，追尊為宣威建武英明莊正聖德神功孝哲皇帝，廟號太宗，陵名長興",
                  "Tuyên Uy Kiến Vũ Anh Minh Trang Chính Thánh Đức Thần Công Hiếu Triết hoàng đế"),
                c("reign:0", "tb", 4, "tiểu dẫn", "辛卯，神宗孝昭皇帝崩，上時二十九"),
                c("reign:0", "tb", 5, "cuối quyển", "言訖而崩。在位三十九年，壽六十有八"),
                c("bio", "tb", 4, "tiểu dẫn", "時稱賢主")])
U("u.thai-tong", "nguyen.thai-tong")
lord(5, "nguyen.anh-tong", "Nguyễn Anh Tông", "u.thai-tong", 5, "Anh Tông", 1687, 1691,
     nickname="Nguyễn Phúc Thái",
     birth={"lunar_year": 1649}, death={"lunar_year": 1691, "lunar_month": 1}, lifespan=43,
     burial_place="Núi Kim Ngọc (xã Định Môn, Hương Trà); lăng Trường Mậu",
     posthumous_name="Thiệu Hưu Toản Nghiệp Khoan Hồng Bác Hậu Ôn Huệ Từ Tường Hiếu Nghĩa hoàng đế",
     bio="Con thứ hai của Thái Tông, sinh năm Kỷ Sửu (1649). Tháng 3 năm Đinh Mão (1687), Thái Tông mất, ông 39 tuổi nối ngôi, được gọi là Nghĩa chúa. Mất tháng Giêng năm Tân Mùi (1691), ở ngôi 4 năm, thọ 43 tuổi; miếu hiệu Anh Tông, lăng Trường Mậu.",
     citations=[c("existence", "tb", 6, "tiểu dẫn", "英宗紹休纂業寬洪博厚溫惠慈祥孝義皇帝，諱溙"),
                c("nickname", "tb", 6, "tiểu dẫn", "英宗紹休纂業寬洪博厚溫惠慈祥孝義皇帝，諱溙", "Nguyễn Phúc Thái", note="Họ Phúc theo Q.2."),
                c("parents", "tb", 6, "tiểu dẫn", "太宗孝哲皇帝第二子也"),
                c("birth", "tb", 6, "tiểu dẫn", "聖誕己丑年（黎慶德元年，清順治六年）", "âm 1649"),
                c("death", "tb", 6, "cuối quyển", "辛未四年春正月甲申，上不豫", "âm 1691-1"),
                c("lifespan", "tb", 6, "cuối quyển", "是日上崩。在位四年，壽四十有三", "43"),
                c("burial_place", "tb", 6, "cuối quyển", "寧陵于金玉山（在香茶縣定門社）", "Núi Kim Ngọc (xã Định Môn, Hương Trà); lăng Trường Mậu"),
                c("posthumous_name", "tb", 6, "cuối quyển", "嘉隆五年，追尊為紹休纂業寬洪博厚溫惠慈祥孝義皇帝，廟號英宗，陵名長茂",
                  "Thiệu Hưu Toản Nghiệp Khoan Hồng Bác Hậu Ôn Huệ Từ Tường Hiếu Nghĩa hoàng đế"),
                c("reign:0", "tb", 6, "tiểu dẫn", "丁卯春三月丁酉，太宗孝哲皇帝崩，上時三十九"),
                c("reign:0", "tb", 6, "cuối quyển", "是日上崩。在位四年，壽四十有三"),
                c("bio", "tb", 6, "tiểu dẫn", "上嗣位，寬刑薄賦，百姓莫不欣悅，時稱義主")])
U("u.anh-tong", "nguyen.anh-tong")
lord(6, "nguyen.hien-tong", "Nguyễn Hiển Tông", "u.anh-tong", 6, "Hiển Tông", 1691, 1725,
     nickname="Nguyễn Phúc Chu",
     birth={"lunar_year": 1675}, death={"lunar_year": 1725, "lunar_month": 4}, lifespan=51,
     burial_place="Núi Kim Ngọc; lăng Trường Thanh",
     posthumous_name="Anh Mô Hùng Lược Thánh Văn Tuyên Đạt Khoan Từ Nhân Thứ Hiếu Minh hoàng đế",
     bio="Tên húy là Chu, con trưởng của Anh Tông, sinh năm Ất Mão (1675). Tháng Giêng năm Tân Mùi (1691), Anh Tông mất, ông 17 tuổi nối ngôi. Mất tháng 4 năm Ất Tỵ (1725), ở ngôi 34 năm, thọ 51 tuổi, có 146 con; miếu hiệu Hiển Tông, lăng Trường Thanh.",
     citations=[c("existence", "tb", 7, "tiểu dẫn", "顯宗英謨雄略聖文宣達寬慈仁恕孝明皇帝，諱淍"),
                c("nickname", "tb", 7, "tiểu dẫn", "顯宗英謨雄略聖文宣達寬慈仁恕孝明皇帝，諱淍", "Nguyễn Phúc Chu", note="Họ Phúc theo Q.2."),
                c("parents", "tb", 7, "tiểu dẫn", "英宗孝義皇帝第長子也"),
                c("birth", "tb", 7, "tiểu dẫn", "聖誕乙卯年（黎德元二年，清康熙十四年）", "âm 1675"),
                c("death", "tb", 8, "cuối quyển", "乙巳三十四年夏四月戊子，上崩", "âm 1725-4"),
                c("lifespan", "tb", 8, "cuối quyển", "在位三十四年，壽五十有一，有子女一百四十六人", "51"),
                c("burial_place", "tb", 8, "cuối quyển", "寧陵于金玉山", "Núi Kim Ngọc; lăng Trường Thanh"),
                c("posthumous_name", "tb", 8, "cuối quyển", "嘉隆五年，追尊為英謨雄略聖文宣達寬慈仁恕孝明皇帝，廟號顯宗，陵名長清",
                  "Anh Mô Hùng Lược Thánh Văn Tuyên Đạt Khoan Từ Nhân Thứ Hiếu Minh hoàng đế"),
                c("reign:0", "tb", 7, "tiểu dẫn", "辛未春正月甲申，英宗孝義皇帝崩"),
                c("reign:0", "tb", 8, "cuối quyển", "乙巳三十四年夏四月戊子，上崩。在位三十四年"),
                c("bio", "tb", 7, "tiểu dẫn", "及長好學工書，兼文武才略")])
U("u.hien-tong", "nguyen.hien-tong")
lord(7, "nguyen.tuc-tong", "Nguyễn Túc Tông", "u.hien-tong", 7, "Túc Tông", 1725, 1738,
     nickname="Nguyễn Phúc Trú",
     birth={"lunar_year": 1696}, death={"lunar_year": 1738, "lunar_month": 4}, lifespan=43,
     burial_place="Định Môn; lăng Trường Phong",
     posthumous_name="Tuyên Quang Thiệu Liệt Tuấn Triết Tĩnh Uyên Kinh Văn Vĩ Võ Hiếu Ninh hoàng đế",
     bio="Tên húy là Trú, lại húy Vượng, con trưởng của Hiển Tông, sinh năm Bính Tý (1696). Tháng 4 năm Ất Tỵ (1725) Hiển Tông mất, ông 30 tuổi nối ngôi. Mất tháng 4 năm Mậu Ngọ (1738), ở ngôi 13 năm, thọ 43 tuổi; miếu hiệu Túc Tông, lăng Trường Phong.",
     citations=[c("existence", "tb", 9, "tiểu dẫn", "肅宗宣光紹烈濬哲靜淵經文緯武孝寧皇帝，諱澍，又諱旺"),
                c("nickname", "tb", 9, "tiểu dẫn", "諱澍，又諱旺", "Nguyễn Phúc Trú", note="Họ Phúc theo Q.2."),
                c("parents", "tb", 9, "tiểu dẫn", "顯宗孝明皇帝長子也"),
                c("birth", "tb", 9, "tiểu dẫn", "聖誕丙子年（黎正和十七年，清康熙三十五年）", "âm 1696"),
                c("death", "tb", 9, "cuối quyển", "夏四月壬寅，上崩，在位十三年，壽四十有三", "âm 1738-4"),
                c("lifespan", "tb", 9, "cuối quyển", "壽四十有三", "43"),
                c("burial_place", "tb", 9, "cuối quyển", "寧陵于定門", "Định Môn; lăng Trường Phong"),
                c("posthumous_name", "tb", 9, "cuối quyển", "嘉隆五年，追尊為宣光紹烈濬哲靜淵經文緯武孝寧皇帝，廟號肅宗，陵名長豐",
                  "Tuyên Quang Thiệu Liệt Tuấn Triết Tĩnh Uyên Kinh Văn Vĩ Võ Hiếu Ninh hoàng đế"),
                c("reign:0", "tb", 9, "tiểu dẫn", "乙巳夏四月戊子，顯宗孝明皇帝崩"),
                c("reign:0", "tb", 9, "cuối quyển", "夏四月壬寅，上崩，在位十三年"),
                c("bio", "tb", 9, "tiểu dẫn", "及長有文武才略")])
U("u.tuc-tong", "nguyen.tuc-tong")
lord(8, "nguyen.the-tong", "Nguyễn Thế Tông", "u.tuc-tong", 8, "Thế Tông", 1738, 1765,
     nickname="Nguyễn Phúc Khoát",
     birth={"lunar_year": 1714}, death={"lunar_year": 1765, "lunar_month": 5}, lifespan=52,
     burial_place="Núi La Khê; lăng Trường Thái",
     posthumous_name="Càn Cương Uy Đoán Thần Nghị Thánh Du Nhân Từ Duệ Trí Hiếu Võ hoàng đế",
     bio="Tên húy là Khoát, lại húy Hiểu, con trưởng của Túc Tông, sinh năm Giáp Ngọ (1714). Mùa hạ tháng 4 năm Mậu Ngọ (1738) Túc Tông mất, ông 25 tuổi nối ngôi. Mất ngày Giáp Ngọ tháng 5 năm Ất Dậu (1765), ở ngôi 27 năm, thọ 52 tuổi; miếu hiệu Thế Tông, lăng Trường Thái.",
     citations=[c("existence", "tb", 10, "tiểu dẫn", "世宗乾剛威斷神毅聖猷仁慈睿智孝武皇帝，諱濶，又諱曉"),
                c("nickname", "tb", 10, "tiểu dẫn", "諱濶，又諱曉", "Nguyễn Phúc Khoát", note="Họ Phúc theo Q.2."),
                c("parents", "tb", 10, "tiểu dẫn", "肅宗孝寧皇帝長子也"),
                c("birth", "tb", 10, "tiểu dẫn", "聖誕甲午年（黎永盛十年，清康熙五十三年）", "âm 1714"),
                c("death", "tb", 10, "cuối quyển", "乙酉二十七年夏五月甲午，上崩，在位二十七年，壽五十有二", "âm 1765-5"),
                c("lifespan", "tb", 10, "cuối quyển", "壽五十有二", "52"),
                c("burial_place", "tb", 10, "cuối quyển", "寧陵于羅溪山", "Núi La Khê; lăng Trường Thái"),
                c("posthumous_name", "tb", 10, "cuối quyển", "嘉隆五年，追尊為乾剛威斷神毅聖猷仁慈睿智孝武皇帝，廟號世宗，陵名長泰",
                  "Càn Cương Uy Đoán Thần Nghị Thánh Du Nhân Từ Duệ Trí Hiếu Võ hoàng đế"),
                c("reign:0", "tb", 10, "tiểu dẫn", "戊午夏四月壬寅，肅宗孝寧皇帝崩，群臣奉遺命尊為節制水步諸營兼總內外平章軍國重事太保曉郡公，時年二十五"),
                c("reign:0", "tb", 10, "cuối quyển", "乙酉二十七年夏五月甲午，上崩，在位二十七年"),
                c("bio", "tb", 10, "tiểu dẫn", "初封前水營掌營正侯")])
U("u.the-tong", "nguyen.the-tong")
P(key="nguyen.hung-to", full_name="Nguyễn Hưng Tổ", gender="M", parents="u.the-tong",
  death={"lunar_year": 1765, "lunar_month": 9}, lifespan=33,
  burial_place="Xã Cư Chính (Hương Trà); lăng Cơ Thánh",
  titles=[{"title": "Từ Tường Đạm Bạc Khoan Dụ Ôn Hòa Hiếu Khang vương, truy tôn năm Mậu Tuất (1778)", "from_year": 1778},
          {"title": "Miếu hiệu Hưng Tổ, năm Minh Mạng thứ 2", "from_year": 1821}],
  bio="Con thứ hai của Thế Tông (mẹ là nguyên phi Trương thị), cha của Gia Long. Thế Tông định lập làm người kế vị. Năm Ất Dậu (1765) Thế Tông mất, quyền thần Trương Phúc Loan ép ông vào lãnh cung; tháng 9 năm đó ông mất, thọ 33 tuổi, táng ở xã Cư Chính. Gia Long truy tôn Hiếu Khang vương (1778), Hiếu Khang hoàng đế (1806), miếu hiệu Hưng Tổ.",
  citations=[c("existence", "tb", 10, "năm Canh Thìn (1760)", "皇二子（即興祖孝康皇帝，母元妃張氏）年二十八"),
             c("parents", "tb", 10, "năm Canh Thìn (1760)", "皇二子（即興祖孝康皇帝，母元妃張氏）"),
             c("death", "tb", 11, "năm Ất Dậu (1765)", "秋九月未歸邸而崩，壽三十有三", "âm 1765-9"),
             c("lifespan", "tb", 11, "năm Ất Dậu (1765)", "壽三十有三", "33"),
             c("burial_place", "tb", 11, "năm Ất Dậu (1765)", "寧陵于居正（社名，屬香茶縣）", "Xã Cư Chính (Hương Trà); lăng Cơ Thánh"),
             c("title:0", "tb", 11, "năm Ất Dậu (1765)", "追尊為慈祥澹泊寬裕溫和孝康王"),
             c("title:1", "tb", 11, "năm Ất Dậu (1765)", "上廟號曰興祖"),
             c("bio", "tb", 11, "năm Ất Dậu (1765)", "興祖為張福巒所忌，逼置冷室內")])
U("u.hung-to--hieu-khang", "nguyen.hung-to", "nguyen.hieu-khang", 1,
  [c("union", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "生子三，長東海郡王晍，二是爲世祖高皇帝，三通化郡王晪；女一，隆城公主玉琇")])
P(key="nguyen.hieu-khang", full_name="Hiếu Khang hoàng hậu", gender="F",
  death={"lunar_year": 1811, "lunar_month": 9}, lifespan=74,
  titles=[{"title": "Vương thái phi (1797)"}, {"title": "Vương thái hậu (Gia Long 2)"}, {"title": "Hoàng thái hậu (Gia Long 5)"}],
  bio="Vợ Hưng Tổ, mẹ Gia Long, người Minh Linh, Thừa Thiên; con gái Diễn quốc công Nguyễn Phúc Trung. Sinh ba con trai (Đông Hải quận vương, Gia Long, Thông Hóa quận vương) và một con gái (Long Thành công chúa Ngọc Tú). Năm Gia Long thứ 10 (1811) bà mất, thọ 74 tuổi.",
  citations=[c("existence", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "興祖孝康皇后阮氏，承天明靈人，演國公阮福忠（其姓阮，或者賜姓阮福，無考。）之女"),
             c("death", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "十年秋九月，后不豫", "âm 1811-9", note="Năm Gia Long 10; hậu băng ngày Kỷ Sửu."),
             c("lifespan", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "己丑，后崩，壽七十有四歲", "74"),
             c("title:0", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "尊爲國母王太妃"),
             c("title:1", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "二年春三月壬寅，尊爲王太后"),
             c("title:2", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "五年秋七月戊申，冊尊爲皇太后"),
             c("bio", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "生子三，長東海郡王晍，二是爲世祖高皇帝，三通化郡王晪；女一，隆城公主玉琇")])

# ── Gia Long ──────────────────────────────────────────────────────────
GL = "tiểu dẫn Thế Tổ"
P(key="nguyen.gia-long", full_name="Nguyễn Thế Tổ (Gia Long)", gender="M", parents="u.hung-to--hieu-khang",
  death={"lunar_year": 1819, "lunar_month": 12},
  nickname="Nguyễn Phúc Ánh; Nguyễn Phúc Noãn; Nguyễn Phúc Chủng",
  birth={"lunar_year": 1762, "lunar_month": 1},
  titles=[{"title": "Đại nguyên soái, nhiếp quốc chính (1778)", "from_year": 1778}, {"title": "Lên ngôi vương ở Sài Côn (1780)", "from_year": 1780}],
  reigns=[{"dynasty": "Nhà Nguyễn", "ordinal": 1, "role": "emperor", "temple_name": "Thế Tổ", "start_year": 1802, "end_year": 1819}],
  bio="Con thứ ba của Hưng Tổ, mẹ Hiếu Khang hoàng hậu, sinh năm Nhâm Ngọ (1762). Năm Ất Dậu (1765) cha mất, ông mới 4 tuổi. Năm Đinh Dậu (1777) Duệ Tông chết trận, ông thoát nạn. Năm Mậu Tuất (1778) được các tướng tôn làm Đại nguyên soái nhiếp quốc chính; năm Canh Tý (1780) lên ngôi vương ở Sài Côn. Mất ngày Đinh Mùi tháng 12 năm Gia Long 18 (1819). (Thụy hiệu, lăng, tuổi thọ chưa có nguyên văn trên Wikisource; sẽ bổ sung.)",
  citations=[c("existence", "cb", 1, GL, "世祖開天弘道立紀垂統神文聖武峻德隆功至仁大孝高皇帝諱暖，又諱映"),
             c("nickname", "cb", 1, GL, "又諱映，（初，睿宗謂帝曰：“此字爲日正中之象。”因名之。）又諱種", "Nguyễn Phúc Ánh; Nguyễn Phúc Noãn; Nguyễn Phúc Chủng",
               note="Họ Phúc theo Tiền biên Q.2. Phiên âm 暖/映/種 do người soạn."),
             c("parents", "cb", 1, GL, "興祖孝康皇帝第三子也，母孝康皇后阮氏"),
             c("birth", "cb", 1, GL, "聖誕壬午年", "âm 1762"),
             c("birth", "tb", 10, "năm Nhâm Ngọ (1762)", "壬午二十四年春正月己酉，世孫（即世祖高皇帝）生", "âm 1762-1"),
             c("title:0", "cb", 1, "năm Mậu Tuất (1778)", "杜清仁與諸將尊帝爲大元帥，攝國政"),
             c("title:1", "cb", 1, "năm Canh Tý (1780)", "春正月癸卯，帝即王位"),
             c("reign:0", "lt", 1, "Hưng Tổ Hiếu Khang hoàng hậu", "嘉隆元年夏四月，世祖命黄曰纘等爲奉迎使", note="Năm hiệu Gia Long nguyên niên = 1802."),
             c("reign:0", "cb", 2, "Gia Long năm 18", "十八年冬十二月丁未，世祖高皇帝崩", note="Gia Long 18 = 1819."),
             c("death", "cb", 2, "Gia Long năm 18", "十八年冬十二月丁未，世祖高皇帝崩", "âm 1819-12", note="Ngày Đinh Mùi tháng 12 năm Gia Long 18; chưa có tuổi thọ, lăng, thụy (quyển cuối kỷ 1)."),
             c("bio", "cb", 1, GL, "乙酉秋，興祖崩，帝年甫四歲")])
P(key="nguyen.thua-thien-cao", full_name="Thừa Thiên Cao hoàng hậu", gender="F",
  titles=[{"title": "Nguyên phi (1778)", "from_year": 1778}],
  bio="Họ Tống, người huyện Thanh Ba, con gái Quy quốc công Tống Phúc Khuông. Năm Mậu Tuất (1778), 18 tuổi, được Gia Long cưới, tấn nguyên phi. Sinh hai con trai: Chiêu (mất sớm) và Cảnh (Anh Duệ hoàng thái tử).",
  citations=[c("existence", "lt", 1, "Thế Tổ Thừa Thiên Cao hoàng hậu", "世祖承天高皇后宋氏，清葩貴縣人，歸國公宋福匡之女"),
             c("title:0", "lt", 1, "Thế Tổ Thừa Thiên Cao hoàng hậu", "戊戌年，后年十八，世祖高皇帝備禮聘之，晉元妃"),
             c("bio", "lt", 1, "Thế Tổ Thừa Thiên Cao hoàng hậu", "生子二，長子昭，早殤，次子景，立爲東宮")])
P(key="nguyen.thuan-thien-cao", full_name="Thuận Thiên Cao hoàng hậu", gender="F",
  titles=[{"title": "Tả cung tần, hiệu Nhị phi"}],
  bio="Họ Trần, người Hương Trà, con gái Thọ quốc công Trần Hưng Đạt. Năm Kỷ Hợi (1779), 14 tuổi vào cung, sau tấn Tả cung tần, hiệu Nhị phi. Năm Tân Hợi (1791), 24 tuổi, sinh Thánh Tổ Nhân hoàng đế (Minh Mạng) ở thôn Hoạt Lộc; sau sinh thêm Kiến An vương Đán và Thiệu Hóa quận vương Giản.",
  citations=[c("existence", "lt", 1, "Thế Tổ Thuận Thiên Cao hoàng hậu", "順天高皇后陳氏，承天香茶人，壽國公陳興達之女"),
             c("title:0", "lt", 1, "Thế Tổ Thuận Thiên Cao hoàng hậu", "尋晉左宮嬪，號二妃"),
             c("bio", "lt", 1, "Thế Tổ Thuận Thiên Cao hoàng hậu", "辛亥，后年二十四，生聖祖仁皇帝於活祿村")])
U("u.gia-long--thua-thien", "nguyen.gia-long", "nguyen.thua-thien-cao", 1,
  [c("union", "lt", 1, "Thế Tổ Thừa Thiên Cao hoàng hậu", "世祖承天高皇后宋氏")])
U("u.gia-long--thuan-thien", "nguyen.gia-long", "nguyen.thuan-thien-cao", 2,
  [c("union", "lt", 1, "Thế Tổ Thuận Thiên Cao hoàng hậu", "順天高皇后陳氏")])
P(key="nguyen.anh-due", full_name="Anh Duệ hoàng thái tử Cảnh", gender="M", parents="u.gia-long--thua-thien",
  birth={"lunar_year": 1780, "lunar_month": 3}, death={"lunar_year": 1801}, lifespan=22,
  titles=[{"title": "Đông cung, Nguyên soái, Quận công (1793)", "from_year": 1793}],
  bio="Con trai trưởng của Gia Long, mẹ Thừa Thiên Cao hoàng hậu, sinh tháng 3 năm Canh Tý (1780) ở Gia Định. Năm Quý Mão (1783) mới 4 tuổi, theo Bá Đa Lộc sang Pháp, trở về năm Kỷ Dậu (1789). Năm Quý Sửu (1793), 14 tuổi, được lập Đông cung. Mất vì bệnh đậu mùa năm Tân Dậu (1801), 22 tuổi.",
  citations=[c("existence", "lt", 2, "Anh Duệ hoàng thái tử Cảnh", "英睿皇太子景，世祖長子，母皇后宋氏"),
             c("parents", "lt", 2, "Anh Duệ hoàng thái tử Cảnh", "英睿皇太子景，世祖長子，母皇后宋氏"),
             c("birth", "cb", 1, "năm Canh Tý (1780)", "三月辛巳，皇長子景（即英睿皇太子。）生", "âm 1780-3"),
             c("death", "lt", 2, "Anh Duệ hoàng thái tử Cảnh", "辛酉春，公以痘薨，年二十有二", "âm 1801"),
             c("lifespan", "lt", 2, "Anh Duệ hoàng thái tử Cảnh", "年二十有二", "22"),
             c("title:0", "lt", 2, "Anh Duệ hoàng thái tử Cảnh", "冊立爲東宮，封元帥、郡公"),
             c("bio", "lt", 2, "Anh Duệ hoàng thái tử Cảnh", "是年公甫四歲")])

# ══ Đợt 2: Minh Mạng ═══════════════════════════════════════════════
MM = "tiểu dẫn Thánh Tổ"
P(key="nguyen.minh-mang", full_name="Nguyễn Thánh Tổ (Minh Mạng)", gender="M", parents="u.gia-long--thuan-thien",
  nickname="Nguyễn Phúc Đảm; Nguyễn Phúc Kiểu",
  birth={"lunar_year": 1791}, death={"lunar_year": 1840, "lunar_month": 12, "lunar_day": 28},
  posthumous_name="Thể Thiên Xương Vận Chí Hiếu Thuần Đức Văn Vũ Minh Đoán Sáng Thuật Đại Thành Hậu Trạch Phong Công Nhân hoàng đế",
  titles=[{"title": "Hoàng thái tử (Gia Long 15)", "from_year": 1816}],
  reigns=[{"dynasty": "Nhà Nguyễn", "ordinal": 2, "role": "emperor", "temple_name": "Thánh Tổ", "start_year": 1820, "end_year": 1840,
           "era_names": [{"name": "Minh Mạng", "from_year": 1820}]}],
  bio="Con thứ tư của Gia Long, mẹ Thuận Thiên Cao hoàng hậu, sinh năm Tân Hợi (1791). Năm Gia Long 15 được lập làm hoàng thái tử. Tháng 12 năm Gia Long 18 (1819) Gia Long mất, ông nối ngôi; mùa xuân năm Canh Thìn (1820) lên ngôi ở điện Thái Hòa, lấy năm đó làm Minh Mạng nguyên niên. Mất ngày 28 tháng 12 năm Minh Mạng 21 (1840), truyền ngôi cho con trưởng là Thiệu Trị. (Tuổi thọ, lăng chưa có nguyên văn trên Wikisource.)",
  citations=[c("existence", "cb", 2, MM, "聖祖體天昌運至孝純德文武明斷創述大成厚澤豐功仁皇帝，諱晈，又諱膽"),
             c("nickname", "cb", 2, MM, "聖祖體天昌運至孝純德文武明斷創述大成厚澤豐功仁皇帝，諱晈，又諱膽", "Nguyễn Phúc Đảm; Nguyễn Phúc Kiểu", note="Họ Phúc theo Tiền biên Q.2; phiên âm 晈/膽 do người soạn."),
             c("parents", "cb", 2, MM, "世祖高皇帝第四子也。母順天高皇后陳氏"),
             c("birth", "cb", 2, MM, "聖誕辛亥年，（世祖高皇帝嗣王位之十二年，清乾隆五十六年。）", "âm 1791"),
             c("death", "cb", 3, "tiểu dẫn Hiến Tổ", "二十八日，宣至御榻前，握手面諭，命以嗣位。是日，聖祖仁皇帝崩", "âm 1840-12-28", note="Minh Mạng năm 21 (1840), tháng 12 ngày 28."),
             c("posthumous_name", "cb", 2, MM, "聖祖體天昌運至孝純德文武明斷創述大成厚澤豐功仁皇帝",
               "Thể Thiên Xương Vận Chí Hiếu Thuần Đức Văn Vũ Minh Đoán Sáng Thuật Đại Thành Hậu Trạch Phong Công Nhân hoàng đế"),
             c("title:0", "cb", 2, MM, "嘉隆十五年夏六月己未，冊立爲皇太子"),
             c("reign:0", "cb", 2, MM, "庚辰明命元年，（清嘉慶二十五年。）春正月戊午朔，帝即皇帝位于太和殿"),
             c("reign:0", "cb", 2, MM, "以今年庚辰爲明命元年"),
             c("reign:0", "cb", 3, "tiểu dẫn Hiến Tổ", "二十八日，宣至御榻前，握手面諭，命以嗣位。是日，聖祖仁皇帝崩"),
             c("bio", "cb", 2, MM, "十八年冬十二月丁未，世祖高皇帝崩，羣臣奉箋勸進")])
P(key="nguyen.ta-thien-nhan", full_name="Tá Thiên Nhân hoàng hậu", gender="F",
  death={"lunar_year": 1807}, lifespan=17,
  titles=[{"title": "Nghi (truy tặng, Minh Mạng 2), thụy Thuận Đức", "from_year": 1821}, {"title": "Thần phi (Minh Mạng 17)", "from_year": 1836},
          {"title": "Hoàng hậu (truy tôn đầu Thiệu Trị)", "from_year": 1841}],
  bio="Họ Hồ, người Bình An, Biên Hòa; con gái Phúc quốc công Hồ Văn Bôi. Năm Gia Long 5 (1806) được Gia Long và Thuận Thiên hoàng hậu chọn làm vợ Minh Mạng. Tháng 5 năm Đinh Mão (1807), sinh Thiệu Trị được 13 ngày thì mất, thọ 17 tuổi. Được truy tôn thụy hiệu Tá Thiên Nghi Thánh Đoan Chính Cung Hòa Đốc Khánh Từ Huy Minh Hiền Thuận Đức Nhân hoàng hậu.",
  citations=[c("existence", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "聖祖佐天仁皇后胡氏，邊和平安人，福國公文盃之女，母黃氏"),
             c("death", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "六年丁卯夏五月，生我憲祖章皇帝纔十三日，后崩，壽十有七歲", "âm 1807"),
             c("lifespan", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "后崩，壽十有七歲", "17"),
             c("title:0", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "明命二年辛巳夏六月，冊贈爲儀，諡順德"),
             c("title:1", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "十七年丙申夏五月，晉贈爲宸妃"),
             c("title:2", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "追上尊諡曰：佐天儷聖端正恭和篤慶慈徽明賢順德仁皇后"),
             c("bio", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "嘉隆五年丙寅，世祖高皇帝與順天高皇后選功臣之女爲聖祖仁皇帝配")])
U("u.minh-mang--ta-thien", "nguyen.minh-mang", "nguyen.ta-thien-nhan", 1,
  [c("union", "lt2", 1, "Tá Thiên Nhân hoàng hậu", "選功臣之女爲聖祖仁皇帝配，命進侍潛邸")])

# Thiệu Trị
HT = "tiểu dẫn Hiến Tổ"
P(key="nguyen.thieu-tri", full_name="Nguyễn Hiến Tổ (Thiệu Trị)", gender="M", parents="u.minh-mang--ta-thien",
  nickname="Nguyễn Phúc Miên Tông",
  birth={"lunar_year": 1807, "lunar_month": 5, "lunar_day": 11}, death={"lunar_year": 1847, "lunar_month": 9, "lunar_day": 27},
  posthumous_name="Thiệu Thiên Long Vận Chí Thiện Thuần Hiếu Khoan Minh Duệ Đoán Văn Trị Võ Công Thánh Triết Chương hoàng đế",
  titles=[{"title": "Trưởng Khánh công (Minh Mạng 11)", "from_year": 1830}],
  reigns=[{"dynasty": "Nhà Nguyễn", "ordinal": 3, "role": "emperor", "temple_name": "Hiến Tổ", "start_year": 1840, "end_year": 1847,
           "era_names": [{"name": "Thiệu Trị", "from_year": 1841}]}],
  bio="Con trưởng của Minh Mạng, mẹ Tá Thiên Nhân hoàng hậu, sinh ngày 11 tháng 5 năm Đinh Mão (1807); 13 ngày sau mẹ mất, Thuận Thiên hoàng hậu nuôi trong cung. Năm Minh Mạng 11 phong Trưởng Khánh công. Ngày 28 tháng 12 năm Minh Mạng 21 (1840) nhận lời trối của Minh Mạng, nối ngôi; năm Tân Sửu (1841) lấy niên hiệu Thiệu Trị. Mất ngày 27 tháng 9 năm Thiệu Trị 7 (1847). (Tuổi thọ, lăng chưa có nguyên văn trên Wikisource.)",
  citations=[c("existence", "cb", 3, HT, "憲祖紹天隆運至善純孝寬明睿斷文治武功聖哲章皇帝，諱暶，又諱曧，字綿宗"),
             c("nickname", "cb", 3, HT, "憲祖紹天隆運至善純孝寬明睿斷文治武功聖哲章皇帝，諱暶，又諱曧，字綿宗", "Nguyễn Phúc Miên Tông", note="Chép tên tự 綿宗; phiên âm do người soạn."),
             c("parents", "cb", 3, HT, "聖祖仁皇帝長子也，母順德仁皇后胡氏誕生于京城東之春祿邑"),
             c("birth", "cb", 3, HT, "聖誕丁卯年五月十一日壬子（世祖高皇帝嘉隆六年，清嘉慶十二年）", "âm 1807-5-11"),
             c("death", "cb", 4, "tiểu dẫn Dực Tông", "二十七日癸卯，憲祖章皇帝崩", "âm 1847-9-27", note="Thiệu Trị 7, tháng 9 (xem câu trước: 七年九月，聖躬不豫)."),
             c("bio", "cb", 4, "tiểu dẫn Dực Tông", "七年九月，聖躬不豫"),
             c("posthumous_name", "cb", 3, HT, "憲祖紹天隆運至善純孝寬明睿斷文治武功聖哲章皇帝",
               "Thiệu Thiên Long Vận Chí Thiện Thuần Hiếu Khoan Minh Duệ Đoán Văn Trị Võ Công Thánh Triết Chương hoàng đế"),
             c("title:0", "cb", 3, HT, "十一年正月，冊封長慶公"),
             c("reign:0", "cb", 3, HT, "乃即位繼大統。辛丑紹治元年（清道光二十一年）"),
             c("reign:0", "cb", 4, "tiểu dẫn Dực Tông", "二十七日癸卯，憲祖章皇帝崩"),
             c("bio", "cb", 3, HT, "越十三日，后崩，泣血不止。順天高皇后育之宮中")])
P(key="nguyen.nghi-thien", full_name="Nghi Thiên Chương hoàng hậu", gender="F",
  birth={"lunar_year": 1810, "lunar_month": 5, "lunar_day": 19},
  bio="Họ Phạm, người Tân Hòa, Gia Định; con gái Lễ bộ thượng thư, Cần Chính điện đại học sĩ, Đức quốc công Phạm Đăng Hưng. Sinh ngày 19 tháng 5 năm Gia Long 9 (1810). Vợ Thiệu Trị, mẹ Tự Đức; sau được tôn Từ Dụ thái hoàng thái hậu.",
  citations=[c("existence", "lt2", 2, "Nghi Thiên Chương hoàng hậu", "憲祖儀天章皇后范氏，嘉定新和人，禮部尚書贈勤政殿大學士封德國公登興之女"),
             c("birth", "lt2", 2, "Nghi Thiên Chương hoàng hậu", "嘉隆九年夏五月十九日生", "âm 1810-5-19"),
             c("bio", "cb", 4, "tiểu dẫn Dực Tông", "母慈裕博惠康壽太太皇太后范登氏", note="Mẹ Tự Đức (chép là Phạm Đăng thị).")])
U("u.thieu-tri--nghi-thien", "nguyen.thieu-tri", "nguyen.nghi-thien", 1,
  [c("union", "lt2", 2, "Nghi Thiên Chương hoàng hậu", "憲祖儀天章皇后范氏")])

# Các hoàng tử nổi bật của Minh Mạng (Liệt truyện nhị tập Q.5–6) — đợt này chỉ lấy người có dữ kiện rõ
def son(key, name, han, order, vol, quote_exist, mother_key, mother_name, mother_quote, mother_bio, **kw):
    P(key=key, full_name=name, gender="M", parents=f"u.minh-mang--{mother_key}",
      citations=kw.pop("cites") + [c("existence", "lt2", vol, name, quote_exist), c("parents", "lt2", vol, name, quote_exist)], **kw)
    if not any(p["key"] == f"nguyen.{mother_key}" for p in persons):
        P(key=f"nguyen.{mother_key}", full_name=mother_name, gender="F", bio=mother_bio,
          citations=[c("existence", "lt2", vol, name, mother_quote), c("bio", "lt2", vol, name, mother_quote)])
        U(f"u.minh-mang--{mother_key}", "nguyen.minh-mang", f"nguyen.{mother_key}", None, [c("union", "lt2", vol, name, mother_quote)])

son("nguyen.mien-dinh", "Miên Định (Thọ Xuân vương)", "壽春王綿定", 3, 5, "壽春王綿定，字明靜，號東池。初奉世祖高皇帝賜名宴，明命四年，御製帝系金冊，賜今名。聖祖仁皇帝第三子也",
    "gia-phi-pham", "Gia phi Phạm thị", "母嘉妃范氏，平定綏遠人，追授光祿寺少卿文軫之女也，以嘉隆九年秋七月生王",
    "Họ Phạm, người Tuy Viễn, Bình Định; con gái Quang lộc tự thiếu khanh (truy tặng) Văn Chẩn. Mất năm Gia Long 11 (1812); Thuận Thiên hoàng hậu nuôi con là Miên Định.",
    birth={"lunar_year": 1810, "lunar_month": 7}, titles=[{"title": "Thọ Xuân vương; hoàng tử thứ 3 của Minh Mạng"}],
    bio="Tên chữ Minh Tĩnh, hiệu Đông Trì; ban đầu được Gia Long đặt tên Yến, năm Minh Mạng 4 đổi tên là Miên Định. Con thứ 3 của Minh Mạng, mẹ Gia phi Phạm thị; sinh tháng 7 năm Gia Long 9 (1810).",
    cites=[c("birth", "lt2", 5, "Miên Định", "以嘉隆九年秋七月生王", "âm 1810-7"),
           c("title:0", "lt2", 5, "Miên Định", "壽春王綿定，字明靜，號東池"),
           c("bio", "lt2", 5, "Miên Định", "十一年，嘉妃薨，王甫三歲，順天高皇后撫之宮中")])
son("nguyen.mien-nghi", "Miên Nghi (Ninh Thuận quận vương)", "寧順郡王綿宜", 4, 5, "寧順郡王綿宜，初名昱，後賜今名。聖祖仁皇帝第四子。母莊嬪陳氏，承天富祿人，追贈衞尉公議之女也",
    "trang-tan-tran", "Trang tần Trần thị", "母莊嬪陳氏，承天富祿人，追贈衞尉公議之女也",
    "Họ Trần, người Phú Lộc, Thừa Thiên; con gái Vệ úy (truy tặng) Nghị.",
    birth={"lunar_year": 1810}, lifespan=65, titles=[{"title": "Ninh Thuận quận vương, thụy Đoan Túc; hoàng tử thứ 4 của Minh Mạng"}],
    bio="Ban đầu tên Úc, sau được ban tên Miên Nghi. Con thứ 4 của Minh Mạng, sinh năm Gia Long 9 (1810). Năm Minh Mạng 11 phong Đức Thọ công, năm 14 đổi Ninh Thuận công. Mất khi chưa kịp tuyên phong vương, thọ 65 tuổi, được tặng Ninh Thuận quận vương, thụy Đoan Túc; lập từ ở xã Tiên Nộn, Phú Vinh.",
    cites=[c("birth", "lt2", 5, "Miên Nghi", "以嘉隆九年生王", "âm 1810"),
           c("lifespan", "lt2", 5, "Miên Nghi", "尋茵病，未及宣封而薨，壽六十有五", "65"),
           c("title:0", "lt2", 5, "Miên Nghi", "明命十一年封爲德壽公，十四年攺封寧順公"),
           c("bio", "lt2", 5, "Miên Nghi", "尋茵病，未及宣封而薨，壽六十有五")])
son("nguyen.mien-hoanh", "Miên Hoành (Vĩnh Tường quận vương)", "永祥郡王綿宏", 5, 5, "永祥郡王綿宏，初名曙，後賜今名。聖祖仁皇帝第五子，皇二子晸同母弟也",
    "hien-phi-ngo", "Hiền phi Ngô thị", "母吳氏，掌奇文楚之女，初侍潛邸",
    "Họ Ngô, con gái Chưởng cơ Văn Sở; vào hầu ở tiềm để, năm Minh Mạng nguyên niên phong Cung tần, sau tấn Hiền phi. (Chép trong mục hoàng tử Chính, anh ruột Miên Hoành.)",
    birth={"lunar_year": 1811}, death={"lunar_year": 1835}, lifespan=25, titles=[{"title": "Vĩnh Tường quận vương (truy tặng), thụy Trang Mục; hoàng tử thứ 5 của Minh Mạng"}],
    bio="Ban đầu tên Thự, sau được ban tên Miên Hoành. Con thứ 5 của Minh Mạng, sinh năm Gia Long 10 (1811). Năm Minh Mạng 11 phong Vĩnh Tường công; mất năm Minh Mạng 16 (1835), thọ 25 tuổi, được truy tặng quận vương, thụy Trang Mục.",
    cites=[c("birth", "lt2", 5, "Miên Hoành", "以嘉隆十年生", "âm 1811"),
           c("death", "lt2", 5, "Miên Hoành", "十六年，薨，追贈郡王，賜諡莊穆，年二十有五", "âm 1835", note="Minh Mạng 16 (câu trước nêu Minh Mạng 11)."),
           c("lifespan", "lt2", 5, "Miên Hoành", "年二十有五", "25"),
           c("title:0", "lt2", 5, "Miên Hoành", "追贈郡王，賜諡莊穆"),
           c("bio", "lt2", 5, "Miên Hoành", "以嘉隆十年生")])
son("nguyen.mien-tham", "Miên Thẩm (Tùng Thiện vương)", "從善郡王綿審", 10, 5, "從善郡王綿審，初名睍，字仲淵，又字愼明，號倉山，別號白毫子，聖祖仁皇帝第十子淑嬪阮克氏所出也",
    "thuc-tan-nguyen-khac", "Thục tần Nguyễn Khắc thị", "淑嬪阮克氏所出也",
    "Họ Nguyễn Khắc; năm Tự Đức 2 (1849) mất ở nhà con (Miên Thẩm đón về phụng dưỡng).",
    death={"lunar_year": 1870}, lifespan=52, titles=[{"title": "Tùng Thiện vương, thụy Văn Nhã; hoàng tử thứ 10 của Minh Mạng"}],
    bio="Ban đầu tên Hiện, tự Trọng Uyên, lại tự Thận Minh, hiệu Thương Sơn, biệt hiệu Bạch Hào tử. Con thứ 10 của Minh Mạng, mẹ Thục tần Nguyễn Khắc thị. Lúc sinh lông mày phải có một sợi lông trắng dài, mình có bốn nhũ, Gia Long nghe và mừng. Mất năm Tự Đức 23 (1870), thọ 52 tuổi, thụy Văn Nhã. Sáng tác 14 tập thơ văn, tiêu biểu Thương Sơn thi tập.",
    cites=[c("death", "lt2", 5, "Miên Thẩm", "二十三年薨，辰年五十二也", "âm 1870", note="Tự Đức 23."),
           c("lifespan", "lt2", 5, "Miên Thẩm", "二十三年薨，辰年五十二也", "52"),
           c("title:0", "lt2", 5, "Miên Thẩm", "輟朝三日，加賜錦繒錢布祕器竝銀錢，又親製祭文，命綏理王賜祭賜酒，諡文雅"),
           c("bio", "lt2", 5, "Miên Thẩm", "初生辰，右眉有一長白毫，體有四乳，腰有紫痣")])
son("nguyen.mien-trinh", "Miên Trinh (Tuy Lý vương)", "綏理王綿寊", 11, 6, "綏理王綿寊，字坤章，又字季仲，號靜圃，又號葦野。聖祖仁皇帝第十一子，婕妤黎氏所出也",
    "tiep-du-le", "Tiệp dư Lê thị", "婕妤黎氏所出也",
    "Họ Lê, vợ lẽ của Minh Mạng; mất khi Miên Trinh còn làm việc ở Tôn nhân phủ (Tuy Lý vương phụng dưỡng lúc bệnh).",
    lifespan=79, titles=[{"title": "Tuy Lý vương, thụy Đoan Cung; hoàng tử thứ 11 của Minh Mạng"}],
    bio="Tự Khôn Chương, lại tự Quý Trọng, hiệu Tĩnh Phố, lại hiệu Vĩ Dã. Con thứ 11 của Minh Mạng, mẹ Tiệp dư Lê thị. Hiếu thảo, ham đọc sách, nổi tiếng thơ văn, có tập Vĩ Dã hợp tập. Mất thọ 79 tuổi, thụy Đoan Cung. Năm 77 tuổi đã có chắt ngoại sinh, được năm đời cùng một nhà.",
    cites=[c("lifespan", "lt2", 6, "Miên Trinh", "未幾薨，年七十九", "79"),
           c("title:0", "lt2", 6, "Miên Trinh", "賜諡端恭"),
           c("bio", "lt2", 6, "Miên Trinh", "平生著述，有葦野合集行世")])
son("nguyen.mien-bao", "Miên Bảo (Tương An quận vương)", "襄安郡王綿寳", 12, 6, "襄安郡王綿寳，字惟善，聖祖仁皇帝第十二子，母安嬪胡氏，廣治由靈人，追贈錦衣校尉文瞻之女也",
    "an-tan-ho", "An tần Hồ thị", "母安嬪胡氏，廣治由靈人，追贈錦衣校尉文瞻之女也",
    "Họ Hồ, người Do Linh, Quảng Trị; con gái Cẩm y hiệu úy (truy tặng) Văn Chiêm.",
    birth={"lunar_year": 1820}, death={"lunar_year": 1854}, lifespan=35, titles=[{"title": "Tương An quận vương, thụy Cung Nghị; hoàng tử thứ 12 của Minh Mạng"}],
    bio="Tự Duy Thiện. Con thứ 12 của Minh Mạng, mẹ An tần Hồ thị, sinh năm Minh Mạng nguyên niên (1820). Có sức khoẻ, ham võ và cưỡi bắn, sau chăm đọc sách; có tiếng thơ, giỏi quốc âm, sáng tác từ khúc. Mất năm Tự Đức 7 (1854), thọ 35 tuổi, thụy Cung Nghị; lập từ ở xã Vạn Xuân, Hương Thủy.",
    cites=[c("birth", "lt2", 6, "Miên Bảo", "明命元年生王，有神力", "âm 1820"),
           c("death", "lt2", 6, "Miên Bảo", "嗣德七年薨，壽三十有五，諡恭毅，建祠于香水之萬春社", "âm 1854", note="Tự Đức 7."),
           c("lifespan", "lt2", 6, "Miên Bảo", "壽三十有五", "35"),
           c("title:0", "lt2", 6, "Miên Bảo", "嗣德七年薨，壽三十有五，諡恭毅"),
           c("bio", "lt2", 6, "Miên Bảo", "明命元年生王，有神力，少好武善騎射")])


# ══ Tiểu sử có mục (mẫu Trần Thái Tông): Tóm lược / Xuất thân / Nối ngôi / Sự nghiệp / Gia quyến / Qua đời ═══
# Mỗi mục thêm vào chỉ dùng dữ kiện có trích dẫn nguyên văn (kiểm lúc sinh file). "Sự nghiệp theo năm"
# mới có những năm đã đọc nguyên văn; các năm còn lại bổ sung khi đọc hết quyển (xem docs).
def sections(key, parts, cites):
    """parts: [(tiêu đề, nội dung)]; cites: trích dẫn bổ sung cho các mục."""
    p = next(x for x in persons if x["key"] == key)
    body = ["## Tóm lược\n" + p["bio"]] + [f"## {t}\n{x}" for t, x in parts]
    p["bio"] = "\n\n".join(body)
    p["citations"] += cites


def y(vol, where, quote):
    return c("bio", "tb", vol, where, quote)


sections("nguyen.thai-to", [
    ("Xuất thân", "Con thứ hai của Triệu Tổ Tĩnh hoàng đế (tên húy là 淦), mẹ là Tĩnh hoàng hậu họ Nguyễn, thuộc một dòng họ vọng tộc đất Thanh Hoa. Ông nội là Trừng quốc công Nguyễn Văn Lựu, từng giúp Lê Oanh khởi binh. Ông là người xã Gia Miêu ngoại, huyện Tống Sơn, phủ Hà Trung."),
    ("Trấn giữ Thuận Hóa", "Sau khi Mạc Đăng Dung cướp ngôi, nhà Lê cho rằng Thuận Hóa cần có tướng giỏi trấn giữ; Đoan quận công Nguyễn Hoàng là con nhà tướng, có tài lược nên được cử vào trấn. Mùa đông tháng 10 năm Mậu Ngọ (1558), 34 tuổi, ông bắt đầu trấn Thuận Hóa, dựng dinh ở xã Ái Tử (huyện Vũ Xương, nay là Đăng Xương); người quê Tống Sơn và nghĩa dũng Thanh Hoa đều vui theo. Ông vỗ về quân dân, thu dụng hào kiệt, thuế khóa nhẹ nhàng, lòng người vui phục, dân gọi là Tiên chúa; sử chép \"đế nghiệp nhà Nguyễn thật gây dựng từ đây\"."),
    ("Di huấn", "Tháng 6 năm Quý Sửu (1613), lúc bệnh nặng, ông gọi hoàng tử thứ sáu (Nguyên) cùng các thân thần đến bên giường, dặn: làm con chỉ có hiếu, làm thần tử chỉ có trung, anh em lấy thương yêu làm đầu. Ông cũng dặn đất Thuận Quảng phía bắc có núi Hoành Sơn, sông Gianh hiểm trở, phía nam có núi Hải Vân, núi Thạch Bi vững chắc, đất có vàng sắt cá muối, là nơi anh hùng dụng võ; nếu biết huấn luyện dân, rèn binh thì đủ sức ngang với họ Trịnh, nếu thế lực chưa địch nổi thì giữ bờ cõi mà đợi thời."),
    ("Qua đời và lăng tẩm", "Ngày Canh Dần tháng 6 năm Quý Sửu (1613), ông mất, ở ngôi 58 năm, thọ 89 tuổi. Ban đầu táng ở núi Thạch Hãn (huyện Hải Lăng), sau cải táng ở núi La Khê (huyện Hương Trà). Buổi đầu được dâng thụy Cẩn Nghĩa Đạt Lý Hiển Ứng Chiêu Hựu Diệu Linh Gia Dụ vương; năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Thái Tổ, lăng Trường Cơ; phi được truy tôn Từ Lương Quang Thục Minh Đức Ý Cung Gia Dụ hoàng hậu, lăng Vĩnh Cơ."),
], [y(1, "tiểu dẫn", "母靖皇后阮氏，先世爲清華望族"),
    y(1, "tiểu dẫn", "清華河中府宋山縣嘉苗外庄人"),
    y(1, "năm Mậu Ngọ (1558)", "黎帝從其請，授以鎮節，凡事一以委之，歲徵貢賦而已"),
    y(1, "năm Mậu Ngọ (1558)", "建營於愛子（社名，屬武昌縣，即今登昌）"),
    y(1, "năm Mậu Ngọ (1558)", "上撫循軍民，收用豪傑，輕徭薄賦，人心悅服，時稱僊主，帝業之興寔基於此"),
    y(1, "năm Quý Sửu (1613)", "為子止孝、為臣止忠，兄弟以友愛為先"),
    y(1, "năm Quý Sửu (1613)", "順廣北有橫山𤅷江之險，南有海雲碑山之固"),
    y(1, "năm Quý Sửu (1613)", "縱勢力弗敵，當保守境土，以俟時機"),
    y(1, "năm Quý Sửu (1613)", "初寧陵于石捍（社名，屬海陵縣）山"),
    y(1, "năm Quý Sửu (1613)", "國初上尊諡曰謹義達理顯應昭祐耀靈嘉裕王"),
    y(1, "năm Quý Sửu (1613)", "妃為慈良光淑明德懿恭嘉裕皇后，陵名永基")])

sections("nguyen.hy-tong", [
    ("Xuất thân", "Con thứ sáu của Thái Tổ, mẹ là Gia Dụ hoàng hậu họ Nguyễn. Khi còn là hoàng tử, ông từng đánh tan thủ lĩnh giặc Tây Dương ở cửa biển Việt, Thái Tổ lấy làm lạ, sau cho làm trấn thủ Quảng Nam. Lúc ấy hoàng tử thứ nhất (Hà), thứ hai (Hán), thứ ba và thứ tư (Diễn) đều đã mất trước, hoàng tử thứ năm (Hải) làm con tin ở miền Bắc; ông tuổi lớn lại hiền, hay bàn việc binh, đoán việc thường trúng nên Thái Tổ có ý giao đại nghiệp."),
    ("Nối ngôi", "Ngày Canh Dần tháng 6 năm Quý Sửu (1613), Thái Tổ mất; theo di mệnh, quần thần tôn ông làm Thống lĩnh thủy bộ chư dinh kiêm tổng nội ngoại bình chương quân quốc trọng sự Thái bảo Thụy quận công, khi ấy 51 tuổi. Vua Lê sai sứ tặng Thái Tổ Cẩn Nghĩa công. Ông sửa thành bảo, đặt quan ải, vỗ về quân dân, trong ngoài đều vui phục, người đời gọi là Phật chúa; từ đây họ nước bắt đầu gọi là họ Nguyễn Phúc."),
    ("Sự nghiệp theo năm", "- Năm Giáp Dần (1614): đặt Tam ti ở dinh chính: Xá sai ti (giữ việc kiện tụng, văn án), Tướng thần lại ti (thu tiền thóc, phát lương cho các đạo), Lệnh sử ti (lo tế tự, lễ nghi, cấp lương dinh chính).\n- Năm Giáp Tuất (1634): nội tán Đào Duy Từ bệnh nặng, ông đến thăm, Duy Từ mất thọ 63 tuổi; ông thương tiếc, tặng Hiệp mưu đồng đức công thần. Sử chép Duy Từ phụ giúp việc nước tuy chỉ 8 năm nhưng công lao rõ rệt, đứng đầu công thần khai quốc; có soạn Hổ trướng khu cơ tập."),
    ("Qua đời và lăng tẩm", "Năm Ất Hợi (1635), ông ốm, gọi thế tử Nhân Lộc hầu và Tôn thất Khê vào hầu, dặn việc quân quốc giao cho người em hiền (Khê) quyết định; rồi mất, ở ngôi 22 năm, thọ 73 tuổi. Thế tử nối ngôi, dâng thụy Đại đô thống trấn Nam phương tổng quốc chính Dực thiện tuy du Thụy Dương vương, táng ở núi Quảng Điền, sau cải táng ở phường Hải Cát (huyện Hương Trà). Năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Hy Tông, lăng Trường Diễn."),
], [y(2, "tiểu dẫn", "母嘉裕皇后阮氏，初為皇子時，嘗擊破西洋賊帥于越海口，太祖異之，後命為廣南鎮守"),
    y(2, "tiểu dẫn", "時皇長子河、二子漢、三子、四子演皆先薨，五子海北質，上年長且賢"),
    y(2, "tiểu dẫn", "群臣奉遺命尊為統領水步諸營兼總內外平章軍國重事太保瑞郡公，時年五十一"),
    y(2, "tiểu dẫn", "黎帝遣使，齎勅贈太祖為謹義公"),
    y(2, "năm Giáp Dần (1614)", "甲寅元年（黎弘定十五年，明萬曆四十二年），初置三司在內正營，曰舍差司，掌詞訟文案"),
    y(2, "năm Giáp Tuất (1634)", "甲戌二十一年冬十月，內贊陶維慈病篤，上親臨視維慈"),
    y(2, "năm Giáp Tuất (1634)", "贈協謀同德功臣，特進金紫榮祿大夫"),
    y(2, "năm Giáp Tuất (1634)", "贊襄國政雖止八年，而勳業炳然，為開國功臣之冠"),
    y(2, "năm Ất Hợi (1635)", "召世子仁祿侯及尊室溪入侍"),
    y(2, "năm Ất Hợi (1635)", "尊諡曰大都統鎮南方總國政翼善綏猷瑞陽王，寧陵于廣田山，後改寧陵于海葛")])

sections("nguyen.than-tong", [
    ("Xuất thân", "Con thứ hai của Hy Tông, mẹ là Hiếu Văn hoàng hậu họ Nguyễn. Ban đầu ông được phong Phó tướng Nhân Lộc hầu; mùa hạ năm Tân Mùi (1631), hoàng tử trưởng (Kỳ) mất, ông được lập làm thế tử, mở dinh Thuận Nghĩa."),
    ("Nối ngôi", "Ngày Đinh Hợi tháng 10 năm Ất Hợi (1635), Hy Tông mất; ông 35 tuổi, theo di mệnh quần thần tôn làm Tiết chế thủy bộ chư dinh kiêm tổng nội ngoại bình chương quân quốc trọng sự Thái bảo Nhân quận công, người đời gọi là Thượng chúa. Khi tự cầm chính sự, ông lấy ân huệ vỗ về dân, mưa nắng thuận hòa, nước giàu dân thịnh."),
    ("Sự nghiệp theo năm", "- Năm Ất Hợi (1635): trấn thủ Quảng Nam là Anh (渶) vốn có lòng khác, muốn cướp ngôi thế tử, nghe ông lên ngôi liền khởi binh làm phản, bị dẹp và xử tử."),
    ("Qua đời và lăng tẩm", "Mùa thu năm Mậu Tý (1648), ông thân đi đánh quân Trịnh, ốm nặng rồi mất trên ngự thuyền ở cửa biển Tam Giang, ở ngôi 13 năm, thọ 48 tuổi. Thế tử khóc nói với Chưởng cơ Tôn thất Trung xin nhường ngôi, Trung can từ chối, nói cha truyền con nối là lẽ thường của xưa nay, thế tử bèn lên ngôi. Thụy ban đầu là Đại nguyên soái thống suất Thuận Hóa Quảng Nam đẳng xứ chưởng quốc chính Uy đoán Thần vũ Nhân Chiêu vương, táng ở núi An Bằng (huyện Hương Trà). Năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Thần Tông, lăng Trường Diên."),
], [y(3, "tiểu dẫn", "母孝文皇后阮氏，初封副將仁祿侯，辛未夏皇長子淇薨，立為世子，開順義營"),
    y(3, "tiểu dẫn", "尊為節制水步諸營兼總內外平章軍國重事太保仁郡公，時稱上主"),
    y(3, "tiểu dẫn", "是時雨暘，時若國富民殷"),
    y(3, "tiểu dẫn", "廣南鎮守渶反伏誅"),
    y(3, "tiểu dẫn", "即發兵反"),
    y(3, "cuối quyển", "世子泣謂掌奇尊室忠曰"),
    y(3, "cuối quyển", "父子相傳，古今常道，世子宜承大統以順天人"),
    y(3, "cuối quyển", "尊諡曰大元帥統率順化廣南等處掌國政威斷神武仁昭王，寧陵于安憑")])

sections("nguyen.thai-tong", [
    ("Xuất thân", "Con thứ hai của Thần Tông, mẹ là Hiếu Chiêu hoàng hậu họ Đoàn. Ban đầu ông được phong Phó tướng Dũng Lễ hầu; từng đánh tan giặc Ô Lan ở cửa biển Nhật Lệ nên Thần Tông rất khen."),
    ("Nối ngôi", "Năm Mậu Tý (1648), mùa xuân tháng 2, ông được tấn phong Tiết chế chư quân, đánh tan quân Trịnh ở sông 𤅷 (Cái); sau đó Thần Tông mất, ông 29 tuổi, quần thần tôn làm Tiết chế thủy bộ chư dinh kiêm tổng nội ngoại bình chương quân quốc trọng sự Thái bảo Dũng quận công, người đời gọi là Hiền chúa. Ông cất nhắc Tôn thất Trung, Tôn thất Lộc, Nguyễn Phúc Kiều, Tống Hữu Đại, Tôn thất Nghĩa làm Chưởng dinh, và thăng thưởng văn võ có thứ bậc."),
    ("Qua đời và lăng tẩm", "Mùa xuân tháng 3 năm Đinh Mão (1687) ông ốm; ngày Đinh Dậu gọi hoàng tử thứ hai là Hoằng Ân hầu dặn: mình cả đời ra vào hiểm nguy giữ gìn gia nghiệp, người kế nghiệp phải sửa chính sách nhân từ để yên bờ cõi, văn võ chư thần là người mình đã cất nhắc nên tin dùng, đừng để bọn tiểu nhân gièm pha. Ông cũng dặn các đại thần cùng lòng phò tá. Rồi ông mất, ở ngôi 39 năm, thọ 68 tuổi; hoàng tử thứ hai nối ngôi, táng ở núi Hải Cát. Thụy ban đầu là Đại nguyên soái tổng quốc chính Công cao đức hậu Dũng Triết vương; năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Thái Tông, lăng Trường Hưng."),
    ("Gia quyến", "Nguyên phi họ Chu mất năm Tân Tỵ, thọ 60 tuổi, được tặng Tán quốc chính phu nhân, táng ở núi An Ninh (Vĩnh Hưng lăng). Con trưởng là Diễn (còn gọi là Hán) làm thế tử, tước Phúc Mỹ hầu, mất năm 45 tuổi; hoàng tử thứ ba là Trăn (còn gọi là Huyền) mất, được tặng Cương quận công; hoàng tử thứ hai là Thái nối ngôi (Anh Tông)."),
], [y(4, "tiểu dẫn", "母孝昭皇后段氏，初封副將勇禮侯，嘗擊破烏闌賊于渜海口"),
    y(4, "tiểu dẫn", "戊子春二月，晉封節制諸軍，大破鄭兵於于𤅷江"),
    y(4, "tiểu dẫn", "尊為節制水步諸營兼總內外平章軍國重事太保勇郡公，時稱賢主"),
    y(4, "tiểu dẫn", "以掌奇尊室忠、尊室祿、阮福喬、宋有大、尊室義為掌營"),
    y(5, "cuối quyển", "丁卯三十九年春三月，上不豫。丁酉，召皇二子弘恩侯謂曰"),
    y(5, "cuối quyển", "我生平出入艱險，保有家邦"),
    y(5, "cuối quyển", "尊諡曰大元帥總國政功高德厚勇哲王，寧陵于海葛山"),
    y(5, "cuối quyển", "辛巳，元妃朱氏崩，壽六十，贈贊國正夫人"),
    y(5, "cuối quyển", "皇長子演（又名漢）薨。演初立為世子，封掌營福美侯，至是薨，年四十五"),
    y(5, "cuối quyển", "皇三子掌奇溱（又名玄）薨，贈純信功臣左軍都督府掌府事少保綱郡公")])

sections("nguyen.anh-tong", [
    ("Xuất thân", "Con thứ hai của Thái Tông, mẹ là Hiếu Triết hoàng hậu họ Tống. Vì hoàng tử trưởng (Diễn) mất sớm, Thái Tông thấy ông tuổi lớn lại hiền nên phong Phó tướng Tả thủy dinh Hoằng Ân hầu, dựng phủ ở Tả thủy dinh."),
    ("Nối ngôi", "Ngày Đinh Dậu tháng 3 năm Đinh Mão (1687), Thái Tông mất; ông 39 tuổi, theo di mệnh quần thần tôn làm Tiết chế thủy bộ chư dinh kiêm tổng nội ngoại bình chương quân quốc trọng sự Thái phó Hoằng quốc công. Lên ngôi, ông giảm hình phạt, bớt thuế, trăm họ vui mừng, người đời gọi là Nghĩa chúa. Mùa hạ tháng 4, ông phong các thần linh trong cõi và thưởng bạc cho văn võ bá quan có thứ bậc."),
    ("Qua đời và lăng tẩm", "Mùa xuân tháng Giêng năm Tân Mùi (1691), ngày Giáp Thân ông ốm, gọi thế tử Tộ Trường hầu dặn: mình nối nghiệp trước, người kế phải nhớ nối chí, noi đức tổ tiên, tìm hiền đãi sĩ, yêu dân thương lính, đừng nghe lời gièm, đừng bỏ người ngay; rồi gọi các thân thần dặn phò thế tử. Cùng ngày ông mất, ở ngôi 4 năm, thọ 43 tuổi. Thế tử nối ngôi, dâng thụy Đại nguyên soái tổng quốc chính Thiệu Hưu Toản Nghiệp Hoằng Nghĩa vương, táng ở núi Kim Ngọc (xã Định Môn, huyện Hương Trà). Năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Anh Tông, lăng Trường Mậu."),
], [y(6, "tiểu dẫn", "母孝哲皇后宋氏，初皇長子演早薨，太宗孝哲皇帝以上年長且賢，封左水營副將弘恩侯，治邸於左水營"),
    y(6, "tiểu dẫn", "尊為節制水步諸營兼總內外平章軍國重事太傅弘國公"),
    y(6, "tiểu dẫn", "夏四月，封境內靈神，賞文武百官白金有差"),
    y(6, "cuối quyển", "辛未四年春正月甲申，上不豫。召世子祚長侯謂曰"),
    y(6, "cuối quyển", "求賢待士，愛民恤兵，勿信讒言，勿斥直士"),
    y(6, "cuối quyển", "尊諡曰大元帥總國政紹休纂業弘義王，寧陵于金玉山（在香茶縣定門社）")])

sections("nguyen.hien-tong", [
    ("Xuất thân", "Con trưởng của Anh Tông, mẹ là Hiếu Nghĩa hoàng hậu họ Tống. Sử chép mùa thu năm Giáp Dần (1674), ở phía tây nam bầu trời mở ra một khe, mây năm sắc quấn quanh, giữa có vầng sáng tròn từ không trung rọi xuống phòng của hoàng hậu, người biết cho là điềm thánh; năm sau ông ra đời, hương lạ đầy nhà. Lớn lên ông hiếu học, giỏi viết chữ, kiêm có tài văn võ; ban đầu phong Phó tướng Tả Bính dinh Tộ Trường hầu, dựng phủ ở Tả Bính cơ."),
    ("Nối ngôi", "Ngày Giáp Thân tháng Giêng năm Tân Mùi (1691), Anh Tông mất; ông 17 tuổi, theo di mệnh quần thần tôn làm Tiết chế thủy bộ chư dinh kiêm tổng nội ngoại bình chương quân quốc trọng sự Thái bảo Tộ quận công, hiệu Thiên Túng đạo nhân. Khi lên ngôi, ông vọng bái đài Kính Thiên, hôm đó trời trong, mây lành hiện, người cho là cảnh thái bình. Tháng 3 phong các thần linh trong cõi, miễn một nửa thuế ruộng năm đó."),
    ("Sự nghiệp theo năm", "- Năm Mậu Tý (1708): cho Mạc Cửu làm Tổng binh trấn Hà Tiên. Cửu là người Lôi Châu, Quảng Đông, khi nhà Minh mất thì để tóc theo xuống Chân Lạp, làm chức Óc nha; ở Sài Mạt mở sòng bạc thu thuế, lại được mỏ bạc nên giàu, chiêu tập lưu dân.\n- Năm Kỷ Hợi (1719): tháng 3, vua đến doanh Quảng Nam, rồi đến phố Hội An, thấy phía tây phố có cây cầu, thuyền buôn tụ họp, đặt tên là cầu Lai Viễn, ngự thư biển vàng ban cho."),
    ("Qua đời và lăng tẩm", "Mùa hạ tháng 4 năm Ất Tỵ (1725), ngày Mậu Tý, ông mất, ở ngôi 34 năm, thọ 51 tuổi, có 146 con trai gái. Con trưởng nối ngôi, dâng thụy Đô nguyên soái tổng quốc chính Khoan Từ Nhân Thứ Tộ Minh vương, táng ở núi Kim Ngọc. Năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Hiển Tông, lăng Trường Thanh."),
], [y(7, "tiểu dẫn", "母孝義皇后宋氏。先是甲寅秋，西南方天開一竅，彩雲繚繞，中有圓光從空而下，其光燭天，當母后所居之室"),
    y(7, "tiểu dẫn", "次年，上應期降誕，異香滿室；及長好學工書，兼文武才略"),
    y(7, "tiểu dẫn", "初封左柄營副將祚長侯，治邸於左柄奇"),
    y(7, "tiểu dẫn", "尊為節制水步諸營兼總內外平章軍國重事太保祚郡公，時年十七，號天縱道人"),
    y(7, "tiểu dẫn", "望拜敬天臺，是日天氣清祥雲見，人以為太平景象云"),
    y(7, "tiểu dẫn", "三月，封境內靈神"),
    y(7, "tiểu dẫn", "免是年田租之半"),
    y(8, "năm Mậu Tý (1708)", "以鄚玖為河僊鎮總兵。玖廣東雷州人，明亡留髮而南投于真臘，為屋牙"),
    y(8, "năm Mậu Tý (1708)", "乃開賭博場徵課，謂之花枝；又得坑銀致富，因招流民"),
    y(8, "năm Kỷ Hợi (1719)", "己亥二十八年春三月，上幸廣南營閱士馬，尋幸會安舖，因見舖之西有橋，以其地商船輳集，名來遠橋，御書金匾賜之"),
    y(8, "cuối quyển", "尊諡曰都元帥總國政寬慈仁恕祚明王，寧陵于金玉山"),
    y(8, "cuối quyển", "在位三十四年，壽五十有一，有子女一百四十六人")])

sections("nguyen.tuc-tong", [
    ("Xuất thân", "Con trưởng của Hiển Tông, mẹ là Hiếu Minh hoàng hậu họ Tống. Khi sinh có khí lành, hương lạ đầy nhà; lớn lên ông có tài văn võ. Ban đầu giữ chức Cai cơ Đỉnh Thịnh hầu, năm Ất Mùi (1715) thăng Chưởng cơ, dựng phủ ở Tả Súng cơ."),
    ("Nối ngôi", "Ngày Mậu Tý tháng 4 năm Ất Tỵ (1725), Hiển Tông mất; ông 30 tuổi, theo di mệnh quần thần tôn làm Tiết chế thủy bộ chư dinh kiêm tổng nội ngoại bình chương quân quốc trọng sự Thái phó Đỉnh quốc công, hiệu Vân Tuyền đạo nhân. Ông miễn một nửa tiền sai dư và hai phần mười thuế ruộng trong cõi, phát tiền kho thưởng quân sĩ, cho đúc thêm tiền đồng vì tiền cũ hao dần do bị nấu làm đồ."),
    ("Sự nghiệp theo năm", "- Năm Ất Mão (1735): Tổng binh Hà Tiên Mạc Cửu mất, được tặng Khai trấn thượng trụ quốc đại tướng quân Vũ Nghị công.\n- Năm Bính Thìn (1736): cho Mạc Thiên Tứ (con Mạc Cửu) làm Đô đốc trấn Hà Tiên, ban ba thuyền long bài, miễn thuế, cho mở cục đúc tiền để thông thương; Thiên Tứ chia đặt thuộc viên, đắp thành bảo, mở phố chợ, chiêu mộ văn sĩ, lập Chiêu Anh các, có Hà Tiên thập vịnh."),
    ("Qua đời và lăng tẩm", "Mùa hạ tháng 4 năm Mậu Ngọ (1738), ngày Nhâm Dần, ông mất, ở ngôi 13 năm, thọ 43 tuổi. Con trưởng nối ngôi, dâng thụy Đại đô thống tổng quốc chính Tuyên Quang Thiệu Liệt Đỉnh Ninh vương, táng ở Định Môn; năm Giáp Tý (1744) dâng thêm thụy Tuyên Quang Thiệu Liệt Tuấn Triết Tĩnh Uyên Kinh Văn Vĩ Võ Hiếu Ninh vương. Năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Túc Tông, lăng Trường Phong."),
    ("Gia quyến", "Nguyên phi họ Trương (con gái trấn thủ Chưởng cơ Trương Phúc Phan), mẹ của Thế Tông, mất năm Tân Tỵ (1721) thọ 22 tuổi, được tặng Tu dung Á phu nhân, thụy Từ Ý, táng ở núi Long Hồ (Vĩnh Phong lăng); sau được truy tôn Hiếu Ninh hoàng hậu."),
], [y(9, "tiểu dẫn", "上初誕時有瑞氣，異香滿室，及長有文武才略。初授該奇鼎盛侯，乙未陞掌奇，治邸於左銃奇居之"),
    y(9, "tiểu dẫn", "尊為節制水步諸營兼總內外平章軍國重事太傅鼎國公，時年三十，號雲泉道人"),
    y(9, "tiểu dẫn", "免境內差餘錢十之五，田租十之二，發庫錢賞給軍士"),
    y(9, "tiểu dẫn", "舊錢日耗，故命增鑄焉"),
    y(9, "năm Ất Mão (1735)", "河僊鎮總兵鄚玖卒，贈開鎮上柱國大將軍武毅公"),
    y(9, "năm Bính Thìn (1736)", "以鄚天賜（鄚玖之子）為河僊鎮都督，賜龍牌船三艘，免其徵稅，令出洋採買珍寶以納，又命開鑄錢局以通貿易"),
    y(9, "năm Bính Thìn (1736)", "又招來文學之士，開招英閣，日與講論唱和，有河僊十詠"),
    y(9, "cuối quyển", "尊諡曰大都統總國政宣光紹烈鼎寧王，寧陵于定門"),
    y(9, "cuối quyển", "甲子六年，追尊為宣光紹烈濬哲靜淵經文緯武孝寧王"),
    y(8, "cuối quyển", "辛巳，皇長子鼎盛侯元妃張氏（即孝寧皇后，鎮守掌奇張福攀之女）薨，壽二十有二，贈修容亞夫人，諡慈懿，建山墳于隆湖（社名）山（即永豐陵）")])

sections("nguyen.the-tong", [
    ("Xuất thân", "Con trưởng của Túc Tông, mẹ là Hiếu Ninh hoàng hậu họ Trương (con gái trấn thủ Chưởng cơ Trương Phúc Phan). Ban đầu ông được phong Chưởng dinh Tiền thủy dinh Chính hầu, dựng phủ ở Tiền dực cơ, xã Dương Xuân."),
    ("Nối ngôi", "Mùa hạ tháng 4 năm Mậu Ngọ (1738), ngày Nhâm Dần, Túc Tông mất; ông 25 tuổi, theo di mệnh quần thần tôn làm Tiết chế thủy bộ chư dinh kiêm tổng nội ngoại bình chương quân quốc trọng sự Thái bảo Hiểu quận công, hiệu Từ Tế đạo nhân."),
    ("Sự nghiệp theo năm", "- Năm Kỷ Mùi (1739): mùa xuân tháng Giêng ngày Tân Mùi, chính phủ (phủ Phú Xuân) xây xong. Chân Lạp Nặc Bồn xâm Hà Tiên; Mạc Thiên Tứ vừa nhận trấn, đem quân đánh, vợ ông là Nguyễn thị dẫn các phụ nữ tải lương nuôi quân; thắng trận, được thưởng Thiên Tứ làm Đô đốc tướng quân, ban áo bào đỏ, vợ làm phu nhân.\n- Năm Đinh Sửu (1757): Chân Lạp có loạn, ông cho Nặc Tôn làm quốc vương Chân Lạp, sai Thiên Tứ cùng binh năm dinh hộ tống về nước; Nặc Tôn dâng đất Tầm Phong Long; Thiên Tứ dâng lên triều, ông cho thuộc Hà Tiên quản hạt.\n- Năm Canh Thìn (1760): thế tử Hạo mất, được tặng Thái bảo quận công; hoàng tử thứ hai (Hưng Tổ), 28 tuổi, sáng sủa anh dũng, ông muốn lập làm người kế vị.\n- Năm Nhâm Ngọ (1762): ngày Kỷ Dậu tháng Giêng, thế tôn (tức Thế Tổ Cao hoàng đế — Gia Long) ra đời, là con của nguyên phi của hoàng tử thứ hai."),
    ("Qua đời và lăng tẩm", "Mùa hạ tháng 5 năm Ất Dậu (1765), ngày Giáp Ngọ, ông mất, ở ngôi 27 năm, thọ 52 tuổi. Quần thần dâng thụy Càn Cương Uy Đoán Thần Nghị Thánh Du Nhân Từ Duệ Trí Hiếu Võ vương, táng ở núi La Khê. Năm Gia Long thứ 5 (1806) truy tôn hoàng đế, miếu hiệu Thế Tông, lăng Trường Thái."),
], [y(10, "tiểu dẫn", "母孝寧皇后張氏。初封前水營掌營正侯，治邸於陽春前翼奇"),
    y(10, "tiểu dẫn", "尊為節制水步諸營兼總內外平章軍國重事太保曉郡公，時年二十五，號慈濟道人"),
    y(10, "năm Kỷ Mùi (1739)", "己未元年（黎永佑五年，清乾隆四年）春正月辛未，正府成"),
    y(10, "năm Kỷ Mùi (1739)", "真臘匿盆侵河僊"),
    y(10, "năm Kỷ Mùi (1739)", "特授天賜都督將軍，賜紅袍冠帶，阮氏為夫人"),
    y(10, "năm Đinh Sửu (1757)", "乃敕封匿尊為真臘國王，令天賜與五營將士護送歸國"),
    y(10, "năm Đinh Sửu (1757)", "匿尊乃獻尋楓龍之地"),
    y(10, "năm Đinh Sửu (1757)", "天賜獻于朝，上介隸歸河僊管轄"),
    y(10, "năm Canh Thìn (1760)", "庚辰二十二年春二月，世子昊薨，贈太保郡公"),
    y(10, "năm Canh Thìn (1760)", "皇二子（即興祖孝康皇帝，母元妃張氏）年二十八，穎慧英果，上欲立為嗣"),
    y(10, "năm Nhâm Ngọ (1762)", "壬午二十四年春正月己酉，世孫（即世祖高皇帝）生"),
    y(10, "cuối quyển", "群臣合同上尊諡曰乾剛威斷神毅聖猷仁慈睿智孝武王，寧陵于羅溪山")])

sections("nguyen.hung-to", [
    ("Xuất thân", "Con thứ hai của Thế Tông, mẹ là nguyên phi Trương thị. Năm Canh Thìn (1760), khi thế tử Hạo mất, ông 28 tuổi, thông minh anh dũng; Thế Tông muốn lập làm người kế vị, sai Nội hữu Trương Văn Hạnh làm thầy dạy nho học, Huấn đạo Lê Cao Kỷ làm Thị giảng để phụ đạo, và cho cùng đại thần bàn việc quân quốc."),
    ("Biến cố năm 1765", "Thế tử Hạo mất, hoàng tôn Dương còn nhỏ, trưởng tử Chương cũng mất, nên theo thứ tự ông đáng được lập; Thế Tông sai Trương Văn Hạnh dạy dỗ để làm người kế nghiệp, ban đầu trao Chưởng cơ, thường dự bàn chính sự. Mùa hạ tháng 5 năm Ất Dậu (1765) Thế Tông mất, quyền thần Trương Phúc Loan thấy hoàng tử thứ mười sáu (Duệ Tông) còn nhỏ, cùng thái giám Chử Đức, Chưởng dinh Nguyễn Cửu Thông giả di chiếu lập lên. Ông bị Phúc Loan ghét, bị giam vào lãnh thất; Trương Văn Hạnh và Lê Cao Kỷ đều bị Loan giết."),
    ("Qua đời và lăng tẩm", "Ông uất ức rồi ốm; mùa thu tháng 9 năm Ất Dậu (1765), chưa kịp về phủ thì mất, thọ 33 tuổi, táng ở xã Cư Chính (huyện Hương Trà). Năm Mậu Tuất (1778), Thế Tổ nhiếp chính ở Gia Định truy tôn Từ Tường Đạm Bạc Khoan Dụ Ôn Hòa Hiếu Khang vương; năm Gia Long thứ 5 (1806) truy tôn hoàng đế; năm thứ 7 sửa sang sơn lăng, đặt tên Cơ Thánh; năm Minh Mạng thứ 2 (1821) phong ngọn núi là Hưng Nghiệp sơn và dâng miếu hiệu Hưng Tổ."),
    ("Gia quyến", "Vợ là Hiếu Khang hoàng hậu họ Nguyễn (con gái Diễn quốc công Nguyễn Phúc Trung). Hai người sinh ba con trai và một con gái: Đông Hải quận vương, Thế Tổ (Gia Long), Thông Hóa quận vương, công chúa Long Thành (Ngọc Tú)."),
], [y(10, "năm Canh Thìn (1760)", "命內右該奇張文幸為傅儒學，訓導黎高紀為侍講以輔導之，使與大臣參議軍國事務"),
    y(11, "năm Ất Dậu (1765)", "初皇九子昊以貴立為世子，既薨，皇孫暘尚幼，長子暲又薨"),
    y(11, "năm Ất Dậu (1765)", "世宗孝武皇帝使內右張文幸傅之欲為嗣，初授掌奇，常參朝政"),
    y(11, "năm Ất Dậu (1765)", "權臣張福巒（張福攀之子）利其少，密與太監褚德（缺姓）、掌營阮久通矯遺命立之"),
    y(11, "năm Ất Dậu (1765)", "內右張文幸、侍講黎高紀皆為巒所殺"),
    y(11, "năm Ất Dậu (1765)", "戊戌世祖攝政元年，追尊為慈祥澹泊寬裕溫和孝康王。嘉隆五年，追尊為仁明謹厚寬裕溫和孝康皇帝；七年修築山陵，名基聖陵。明命二年，封其山為興業山")])

sections("nguyen.gia-long", [
    ("Xuất thân", "Con thứ ba của Hưng Tổ, mẹ là Hiếu Khang hoàng hậu họ Nguyễn; sinh năm Nhâm Ngọ (1762), ngày Kỷ Dậu tháng Giêng, được sử gọi là thế tôn của Thế Tông. Năm Ất Dậu (1765) cha mất, ông mới 4 tuổi, sống ở phủ riêng. Lớn lên ông thông minh sớm thành, được Duệ Tông rất quý trọng, cho ở trong cung."),
    ("Sự nghiệp theo năm", "- Năm Quý Tỵ (1773): giặc Tây Sơn nổi dậy.\n- Năm Giáp Ngọ (1774): mùa đông, quân Trịnh sang xâm lấn; ông theo Duệ Tông vào Quảng Nam (khi ấy 13 tuổi).\n- Năm Ất Mùi (1775): mùa xuân, vào Gia Định, được trao Chưởng sử, coi quân Tả dực; mỗi khi có việc quân, Duệ Tông bàn với ông, thường nói trúng, các tướng đều quy tâm.\n- Năm Đinh Dậu (1777): mùa thu tháng 9, quân giặc đuổi gấp, Duệ Tông tuẫn nạn; ông thoát được một mình, đi thuyền đậu ở sông Khoa (Khoa Giang, thuộc huyện Long Xuyên), định đi biển tránh giặc ban đêm thì có cá sấu bơi ngang trước thuyền ngăn ba lần nên không đi tiếp. Mùa đông tháng 10, ông khởi binh ở Long Xuyên, tiến đến Sa Đích (thuộc An Giang); tháng 11 đánh phá tướng giặc ở Long Hồ; tháng 12 tiến chiếm Sài Côn.\n- Năm Mậu Tuất (1778): mùa xuân tháng Giêng, đóng ở Sài Côn, Đỗ Thanh Nhân cùng các tướng tôn ông làm Đại nguyên soái nhiếp quốc chính (khi ấy 17 tuổi); ông dâng tôn thụy cho Duệ Tông và cha là Hiếu Khang vương, dựng tông miếu, xây lăng Duệ Tông.\n- Năm Kỷ Hợi (1779): mùa xuân tháng 3, mẹ được đón đến Gia Định.\n- Năm Canh Tý (1780): mùa xuân tháng Giêng, ngày Quý Mão, lên ngôi vương ở Sài Côn, dùng ấn \"Đại Việt quốc Nguyễn chúa Vĩnh Trấn chi bảo\"; tháng 3, hoàng trưởng tử Cảnh sinh."),
    ("Qua đời", "Mùa đông tháng 12 năm Gia Long thứ 18 (1819), ngày Đinh Mùi, ông mất. Các quyển sau của Chính biên kỷ 1 (thống nhất đất nước, lên ngôi hoàng đế, thụy hiệu, lăng tẩm) chưa có nguyên văn trên Wikisource, sẽ bổ sung."),
    ("Gia quyến", "Vợ: Thừa Thiên Cao hoàng hậu họ Tống (nguyên phi, lấy năm 1778), sinh Chiêu (mất sớm) và Cảnh (Anh Duệ hoàng thái tử); Thuận Thiên Cao hoàng hậu họ Trần, sinh Minh Mạng (1791), Kiến An vương Đán và Thiệu Hóa quận vương Giản. Mẹ: Hiếu Khang hoàng hậu."),
], [c("bio", "cb", 1, "tiểu dẫn Thế Tổ", "及長，聰睿夙成，睿宗深器重之，居之宮中"),
    c("bio", "cb", 1, "tiểu dẫn Thế Tổ", "癸巳，西山賊起。甲午冬，鄭人來侵，帝隨睿宗幸廣南"),
    c("bio", "cb", 1, "tiểu dẫn Thế Tổ", "乙未春，南幸嘉定，授掌使，將左翊軍"),
    c("bio", "cb", 1, "tiểu dẫn Thế Tổ", "每有軍事，睿宗與帝謀，多奇中，諸將皆屬心焉"),
    c("bio", "cb", 1, "năm Đinh Dậu (1777)", "有鱷魚横過舟前，阻之者三，乃止"),
    c("bio", "cb", 1, "năm Đinh Dậu (1777)", "冬十月，帝擧兵龍川，進至沙的"),
    c("bio", "cb", 1, "năm Đinh Dậu (1777)", "十二月，進克柴棍"),
    c("bio", "cb", 1, "năm Mậu Tuất (1778)", "帝率諸將上睿宗尊諡曰聰明寬厚英敏惠和孝定王，皇考尊諡曰慈祥澹泊寬裕温和孝康王"),
    c("bio", "cb", 1, "năm Mậu Tuất (1778)", "立宗廟，建睿宗陵及新政王山墳"),
    c("bio", "cb", 1, "năm Kỷ Hợi (1779)", "己亥二年，（黎景興四十年，清乾隆四十四年。）春三月，慈駕至嘉定"),
    c("bio", "cb", 1, "năm Canh Tý (1780)", "文書行下曰旨傳，差派曰旨差，用大越國阮主永鎮之寶")])

def cb(vol, where, quote):
    return c("bio", "cb", vol, where, quote)


sections("nguyen.minh-mang", [
    ("Xuất thân", "Con thứ tư của Gia Long, mẹ là Thuận Thiên Cao hoàng hậu họ Trần; sinh năm Tân Hợi (1791), năm thứ 12 sau khi Gia Long nối ngôi vương. Sử chép trước đó hoàng hậu mơ thấy thần nhân dâng một ấn đỏ như mặt trời, khi ông sinh quả ứng điềm ấy."),
    ("Lên ngôi", "Mùa hạ tháng 6 ngày Kỷ Mùi năm Gia Long thứ 15 (1816), ông được lập làm hoàng thái tử, ở điện Thanh Hòa. Mùa đông tháng 12 ngày Đinh Mùi năm Gia Long thứ 18 (1819), Gia Long mất, quần thần dâng tờ khuyên tiến; ông xúc động khóc mãi, các đại thần ba lần mời mới nhận. Mùa xuân tháng Giêng ngày Mậu Ngọ (mồng 1) năm Canh Thìn (1820), ông lên ngôi hoàng đế ở điện Thái Hòa, đặt niên hiệu Minh Mạng, đại xá, ban chiếu khắp trong ngoài."),
    ("Qua đời", "Ngày 19 tháng 12 năm Minh Mạng thứ 21 (1840) ông bệnh nặng; ngày 28 cho gọi hoàng trưởng tử Trưởng Khánh công vào hầu, nắm tay trối cho nối ngôi, rồi mất ngay hôm đó. Quần thần tâu xin Từ Thọ cung (Hoàng thái hậu) và dâng tờ khuyên tiến; hoàng trưởng tử lên ngôi, đặt niên hiệu Thiệu Trị. (Tuổi thọ, lăng tẩm chưa có nguyên văn trên Wikisource.)"),
    ("Gia quyến", "Vợ đầu là Tá Thiên Nhân hoàng hậu họ Hồ (chọn năm 1806), mất sớm sau khi sinh Thiệu Trị; ngoài ra có các bà gia phi Phạm thị, trang tần Trần thị, hiền phi Ngô thị, thục tần Nguyễn Khắc thị, tiệp dư Lê thị, an tần Hồ thị, có con được sử chép. Con trai trưởng là Thiệu Trị; sử chép nhiều hoàng tử khác, nổi bật là Miên Định (Thọ Xuân vương), Miên Thẩm (Tùng Thiện vương), Miên Trinh (Tuy Lý vương)."),
], [cb(2, "tiểu dẫn Thánh Tổ", "初夢神人獻璽一，紅色如日，帝生，寔應其兆"),
    cb(2, "tiểu dẫn Thánh Tổ", "乙卯，以登尊祗告郊廟社稷。丙辰，詣皇仁殿拜受傳國金寶、萬年嗣位袍"),
    cb(2, "tiểu dẫn Thánh Tổ", "羣臣奉箋勸進，帝哀慟不已，諸大臣再三敦請，乃從之"),
    cb(2, "tiểu dẫn Thánh Tổ", "春正月戊午朔，帝即皇帝位于太和殿，建元，大赦，頒詔中外"),
    cb(3, "tiểu dẫn Hiến Tổ", "二十一年十二月十九日，聖躬不豫，宣召入侍"),
    cb(3, "tiểu dẫn Hiến Tổ", "羣臣具本奏知慈壽宮，既奉俞旨，上箋勸進。乃即位繼大統")])

sections("nguyen.thieu-tri", [
    ("Xuất thân", "Con trưởng của Minh Mạng, mẹ là Tá Thiên Nhân hoàng hậu họ Hồ; sinh ngày Nhâm Tý 11 tháng 5 năm Đinh Mão (Gia Long 6, 1807) ở xã Xuân Lộc phía đông kinh thành (sau lập chùa Diệu Đế ở chỗ này). Mười ba ngày sau khi sinh mẹ mất, ông khóc ra máu không dứt; Thuận Thiên Cao hoàng hậu nuôi trong cung, Gia Long đến xem, mừng nói: \"Đứa trẻ đỏ hỏn khóc ra máu, thiên tính chứa đựng, sau này tất có thể vẹn hiếu\", rồi ban tên theo bộ Nhật."),
    ("Trước khi lên ngôi", "Đầu niên hiệu Minh Mạng, ông ra học ở tòa nhà do Minh Mạng đặt tên là Chỉ Thiện đường (theo câu \"Chỉ ư chí thiện\" của Đại học). Tháng Giêng năm Minh Mạng thứ 11 (1830) ông được phong Trưởng Khánh công; tháng 8 năm thứ 17 (1836) nhận ấn thư kiêm nhiếp chức Tả tôn chính Tôn nhân phủ, định chương trình, chính phổ hệ, bố giáo lệnh, thứ tự tước lộc."),
    ("Lên ngôi", "Ngày 28 tháng 12 năm Minh Mạng 21 (1840), ông được Minh Mạng nắm tay trối cho nối ngôi, rồi quần thần dâng tờ khuyên tiến; ông lên ngôi. Mùa xuân tháng Giêng năm Tân Sửu (1841), lấy niên hiệu Thiệu Trị (từ ngày 20 tháng Giêng; trước đó vẫn tính là năm Minh Mạng 22)."),
    ("Qua đời", "Tháng 9 năm Thiệu Trị thứ 7 (1847) ông bệnh; ngày Quý Tỵ (17), ông phê sẵn di chiếu cho hoàng tử thứ hai (Phúc Tuy công) nối ngôi, giao Trương Đăng Quế, Võ Văn Giải, Nguyễn Tri Phương, Lâm Duy Hiệp làm phụ chính. Ngày 27 ngày Quý Mão ông mất, quần thần tuyên di chiếu ở điện Cần Chính và dâng tờ khuyên tiến. (Tuổi thọ, lăng tẩm chưa có nguyên văn trên Wikisource.)"),
    ("Gia quyến", "Vợ là Nghi Thiên Chương hoàng hậu họ Phạm (về sau tôn Từ Dụ thái hoàng thái hậu), mẹ của Tự Đức. Sử còn chép An Phong công Hồng Bảo tuy lớn hơn nhưng là con thứ (庶出), ít học, chỉ ham chơi nên không được nối ngôi."),
], [cb(3, "tiểu dẫn Hiến Tổ", "越十三日，后崩，泣血不止。順天高皇后育之宮中，世祖高皇帝臨視之，喜曰"),
    cb(3, "tiểu dẫn Hiến Tổ", "赤孩泣血，天性所鍾，他日必能全孝"),
    cb(3, "tiểu dẫn Hiến Tổ", "抱見，御批以日字部錫名焉"),
    cb(3, "tiểu dẫn Hiến Tổ", "明命初，出堂讀書，聖祖仁皇帝諭以大學治國平天下之道，在「止於至善」。因以「止善」名其堂"),
    cb(3, "tiểu dẫn Hiến Tổ", "十七年八月，受璽書兼攝尊人府左尊正，定章程，正譜系，布教令，序爵祿"),
    cb(4, "tiểu dẫn Dực Tông", "十七日癸巳，預批遺詔，以帝嗣位，顧命良臣張登桂、大臣武文解、阮知方、林維浹充輔政大臣"),
    cb(4, "tiểu dẫn Dực Tông", "二十七日癸卯，憲祖章皇帝崩，羣臣宣遺詔（詔文已奉載第三紀）于勤政殿，上箋勸進"),
    cb(4, "tiểu dẫn Dực Tông", "辰安豐公洪保雖長而庶出，又寡學徒事嬉遊")])

# ══ Đợt 3: Tự Đức ═════════════════════════════════════════════════
DT = "tiểu dẫn Dực Tông"
P(key="nguyen.tu-duc", full_name="Nguyễn Dực Tông (Tự Đức)", gender="M", parents="u.thieu-tri--nghi-thien",
  nickname="Nguyễn Phúc Thì; Nguyễn Phúc Hồng Nhậm",
  birth={"lunar_year": 1829, "lunar_month": 8, "lunar_day": 25}, death={"lunar_year": 1883, "lunar_month": 6, "lunar_day": 16},
  burial_place="Khiêm Cung (điện Hòa Khiêm), Khiêm lăng",
  posthumous_name="Kế Thiên Hanh Vận Chí Thành Đạt Hiếu Thể Kiện Đôn Nhân Khiêm Cung Minh Lược Duệ Văn Anh hoàng đế",
  titles=[{"title": "Phúc Tuy công (Thiệu Trị 3)", "from_year": 1843}],
  reigns=[{"dynasty": "Nhà Nguyễn", "ordinal": 4, "role": "emperor", "temple_name": "Dực Tông", "start_year": 1847, "end_year": 1883,
           "era_names": [{"name": "Tự Đức", "from_year": 1848}]}],
  bio="Con thứ hai của Thiệu Trị, mẹ là Nghi Thiên Chương hoàng hậu (Từ Dụ), sinh ngày 25 tháng 8 năm Kỷ Sửu (1829). Năm Thiệu Trị 3 (1843) phong Phúc Tuy công. Tháng 9 năm Thiệu Trị 7 (1847) Thiệu Trị mất, ông nối ngôi, lấy năm sau (Mậu Thân, 1848) làm Tự Đức nguyên niên. Mất ngày 16 tháng 6 năm Tự Đức 36 (1883), ở ngôi 36 năm; sử chép ông chọn nuôi trong cung các hoàng tử để nối nghiệp. (Tuổi thọ, thụy hiệu đầy đủ ngày an táng chưa có nguyên văn trên Wikisource.)",
  citations=[c("existence", "cb", 4, DT, "翼宗繼天亨運至誠達孝體健敦仁謙恭明略睿文英皇帝，諱時，字洪任"),
             c("nickname", "cb", 4, DT, "翼宗繼天亨運至誠達孝體健敦仁謙恭明略睿文英皇帝，諱時，字洪任", "Nguyễn Phúc Thì; Nguyễn Phúc Hồng Nhậm", note="Họ Phúc theo Tiền biên Q.2; phiên âm 時 do người soạn."),
             c("parents", "cb", 4, DT, "憲祖章皇帝第二子也，母慈裕博惠康壽太太皇太后范登氏"),
             c("birth", "cb", 4, DT, "聖誕己丑年八月二十五日丙戌（聖祖仁皇帝明命十年，清道光九年）", "âm 1829-8-25"),
             c("death", "cb", 5, "tiểu dẫn Giản Tông", "十六日甲子，翼宗英皇帝崩", "âm 1883-6-16", note="Tự Đức 36 (câu trước: 三十六年癸未夏六月)."),
             c("burial_place", "cb", 5, "tiểu dẫn Giản Tông", "秋八月初三日庚戌，奉安翼宗英皇帝梓宮于謙宮和謙殿", "Khiêm Cung (điện Hòa Khiêm), Khiêm lăng",
               note="Khiêm lăng: xem Liệt truyện nhị tập Q.4, mục Lệ Thiên Anh hoàng hậu."),
             c("posthumous_name", "cb", 4, DT, "翼宗繼天亨運至誠達孝體健敦仁謙恭明略睿文英皇帝",
               "Kế Thiên Hanh Vận Chí Thành Đạt Hiếu Thể Kiện Đôn Nhân Khiêm Cung Minh Lược Duệ Văn Anh hoàng đế"),
             c("title:0", "cb", 4, DT, "紹治三年正月，冊封福綏公"),
             c("reign:0", "cb", 4, DT, "己酉卽皇帝位於太和殿以明年戊申爲嗣德元年頒恩詔于天下"),
             c("reign:0", "cb", 5, "tiểu dẫn Giản Tông", "十六日甲子，翼宗英皇帝崩"),
             c("bio", "cb", 4, DT, "帝仁孝而聰敏好學"),
             c("bio", "cb", 5, "tiểu dẫn Giản Tông", "三十六年癸未夏六月，聖躬不豫")])
P(key="nguyen.le-thien-anh", full_name="Lệ Thiên Anh hoàng hậu", gender="F",
  birth={"lunar_year": 1828, "lunar_month": 5}, death={"lunar_year": 1902, "lunar_month": 4}, lifespan=75,
  burial_place="Khiêm Thọ lăng (bên trái Khiêm lăng)",
  posthumous_name="Lệ Thiên Phụ Thánh Trang Ý Thuận Hiếu Cần Thứ Ôn Từ Hiền Minh Tĩnh Thọ Anh hoàng hậu",
  titles=[{"title": "Trung phi (Tự Đức 14)"}, {"title": "Khiêm hoàng hậu (tên cung Khiêm)"}, {"title": "Trang Ý hoàng thái hậu, sau tôn Trang Ý Thuận Hiếu thái hoàng thái hậu"}],
  bio="Họ Võ, người Lệ Thủy, Quảng Bình; con gái Cần chính điện đại học sĩ, Lệ quốc công Võ Xuân Cẩn. Sinh tháng 5 năm Minh Mạng 9 (1828). Năm Thiệu Trị 3 (1843) được tuyển vào hầu ở tiềm để của Tự Đức. Mất tháng 4 năm Thành Thái 14 (1902), thọ 75 tuổi, táng ở Khiêm Thọ lăng, bên trái Khiêm lăng.",
  citations=[c("existence", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "翼宗儷天英皇后姓武氏，廣平麗水人，父御前大臣太子太保東閣大學士特進金紫榮祿大夫封麗國公春謹"),
             c("birth", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "以明命九年戊子夏五月生", "âm 1828-5"),
             c("death", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "十四年夏四月薨，壽七十有五", "âm 1902-4", note="Thành Thái 14 (sau đoạn 成泰元年)."),
             c("lifespan", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "十四年夏四月薨，壽七十有五", "75"),
             c("burial_place", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "于謙陵之左山萬萬年吉局，上陵名曰謙壽陵", "Khiêm Thọ lăng (bên trái Khiêm lăng)"),
             c("posthumous_name", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "恭上尊諡曰儷天輔聖莊懿順孝勤恕温慈賢明靜壽英皇后",
               "Lệ Thiên Phụ Thánh Trang Ý Thuận Hiếu Cần Thứ Ôn Từ Hiền Minh Tĩnh Thọ Anh hoàng hậu"),
             c("title:0", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "十四年冬，改封爲忠妃"),
             c("title:1", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "尊爲謙皇后，炤與典故亦符"),
             c("title:2", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "尊上徽稱曰莊懿皇太后"),
             c("bio", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "紹治三年，選侍我翼宗英皇帝潛邸")])
U("u.tu-duc--le-thien-anh", "nguyen.tu-duc", "nguyen.le-thien-anh", 1, [c("union", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "紹治三年，選侍我翼宗英皇帝潛邸")])

sections("nguyen.tu-duc", [
    ("Xuất thân", "Con thứ hai của Thiệu Trị, mẹ là Nghi Thiên Chương hoàng hậu họ Phạm (về sau tôn Từ Dụ thái hoàng thái hậu), sinh ngày Bính Tuất 25 tháng 8 năm Kỷ Sửu (Minh Mạng 10, 1829) ở phủ cũ Trưởng Khánh. Sử chép bà từng mơ thấy một thần nhân áo rộng đai dài, đầu bạc mày trắng, cầm một tờ giấy vàng chữ son có dấu ấn cùng một chuỗi minh châu trao cho; khi ông sinh ra thật ứng điềm ấy. Ông nhân hiếu và thông minh ham học; Thiệu Trị cho là giống mình nên đặc biệt quý mến."),
    ("Lên ngôi", "Tháng Giêng năm Thiệu Trị 3 (1843) ông được phong Phúc Tuy công. Lúc ấy An Phong công Hồng Bảo tuy lớn hơn nhưng là con thứ, ít học, chỉ ham chơi. Tháng 9 năm Thiệu Trị 7 (1847) Thiệu Trị ốm; ngày Quý Tỵ (17) ông phê sẵn di chiếu cho ông nối ngôi, giao Trương Đăng Quế, Võ Văn Giải, Nguyễn Tri Phương, Lâm Duy Hiệp làm phụ chính. Ngày 27 (Quý Mão) Thiệu Trị mất, quần thần tuyên di chiếu, dâng tờ khuyên tiến, ông lên ngôi. Ngày Kỷ Dậu (tháng 10) ông lên ngôi ở điện Thái Hòa, lấy năm sau (Mậu Thân, 1848) làm Tự Đức nguyên niên, ban ân chiếu khắp nước."),
    ("Qua đời và lăng tẩm", "Mùa hạ tháng 6 năm Quý Mùi (Tự Đức 36, 1883) ông bệnh. Ngày Nhâm Tuất 14, ông để di chiếu cho hoàng trưởng tử Thụy quốc công (tức Dục Đức) nối ngôi, và dặn nhận một người con nuôi nữa (sau là vua Kiến Phúc) làm hoàng tam tử, dặn Dục Đức giữ tình anh em. Ngày Giáp Tý 16 ông mất; vua nối ngôi vào cung chịu tang mới ba ngày thì bị phụ chính Nguyễn Văn Tường, Tôn Thất Thuyết phế truất, rồi lập Lãng quốc công (sau gọi là Phế đế). Ngày Canh Tuất 3 tháng 8, linh cữu được phụng an ở điện Hòa Khiêm trong Khiêm cung (Khiêm lăng)."),
    ("Gia quyến", "Mẹ: Nghi Thiên Chương hoàng hậu. Vợ: Lệ Thiên Anh hoàng hậu họ Võ (tuyển vào hầu năm Thiệu Trị 3, sau tôn Khiêm hoàng hậu, Trang Ý thái hoàng thái hậu). Sử chép ông chọn nuôi trong cung hoàng trưởng tử (Dục Đức) cùng hai hoàng tử khác (hoàng nhị tử, hoàng tam tử) làm con; việc này được ghi ở các mục Dục Đức, Hiệp Hòa, Kiến Phúc, Đồng Khánh về sau."),
], [cb(4, DT, "初夢一神人寬衣博帶，白首皤眉，捧持黃紙朱書璽跡一幅，竝明珠一串授之，帝生寔應其兆"),
    cb(4, DT, "憲祖章皇帝以為肖己，眷注特異"),
    cb(4, DT, "誕生于原長慶府邸"),
    cb(4, DT, "七年九月，聖躬不豫。十七日癸巳，預批遺詔，以帝嗣位，顧命良臣張登桂、大臣武文解、阮知方、林維浹充輔政大臣"),
    cb(4, DT, "二十七日癸卯，憲祖章皇帝崩，羣臣宣遺詔（詔文已奉載第三紀）于勤政殿，上箋勸進，乃即位繼大統"),
    cb(5, "tiểu dẫn Giản Tông", "十四日壬戌，遺詔皇長子瑞國公（即今恭宗惠皇帝）嗣統，遺囑以帝承歡謹畏，準充為皇三子"),
    cb(5, "tiểu dẫn Giản Tông", "而囑嗣君以友愛篤厚，始終如一"),
    cb(5, "tiểu dẫn Giản Tông", "辰嗣君入恤宅纔三日，為輔政大臣阮文祥、尊室說廢之，而迎立朗國公"),
    cb(5, "tiểu dẫn Giản Tông", "秋八月初三日庚戌，奉安翼宗英皇帝梓宮于謙宮和謙殿"),
    c("bio", "lt2", 4, "Lệ Thiên Anh hoàng hậu", "于謙陵之左山萬萬年吉局，上陵名曰謙壽陵")])

if BAD:
    for b in BAD:
        print("KHÔNG CÓ TRONG NGUYÊN VĂN:", b)
    sys.exit(1)

data = {
    "clan": {"key": "nguyen", "name": "Nhà Nguyễn (1558–1945)", "category": "royal",
             "description": "Gia phả các chúa Nguyễn và vua nhà Nguyễn theo Đại Nam thực lục, Đại Nam liệt truyện. Đợt 1: từ tổ tiên đến Gia Long; đợt 2: Minh Mạng, Thiệu Trị và một số hoàng tử; đợt 3: Tự Đức. Mỗi dữ kiện có trích dẫn nguyên văn; xem dòng \"Theo:\" cuối tiểu sử."},
    "persons": persons, "unions": unions, "resting_places": [], "heritage": [], "events": [],
    "same_person_links": [],
}
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(persons)} người, {len(unions)} hôn nhân")

# Mọi người cùng một bộ mục tiểu sử (mục thiếu thông tin để trống) — xem normalize_bio.py
import os, subprocess
subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "normalize_bio.py"), OUT], check=True)
