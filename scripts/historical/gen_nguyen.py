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
CB = {k: load(f"cb/cb_{h}_q1.txt") for k, h in {1: "一", 2: "二", 3: "三", 4: "四"}.items()}
LT1 = {n: load(f"lt1/lt1_{n:02d}.txt") for n in (1, 2)}
LT2 = {n: load(f"lt2/lt2_{n:02d}.txt") for n in (1, 2, 5, 6)}
TEXT = {"tb": TB, "cb": CB, "lt": LT1, "lt2": LT2}
BAD = []


def c(field, src, vol, where, quote, value=None, note=None):
    """src: tb (Tiền biên) | cb (Chính biên, vol = số kỷ, quyển 1) | lt (Liệt truyện sơ tập) | lt2 (nhị tập)."""
    if re.sub(r"\s+", "", quote) not in TEXT[src][vol]:
        BAD.append((src, vol, quote))
    code, loc = {"tb": lambda: ("DNTL", f"Tiền biên Q.{vol}"),
                 "cb": lambda: ("DNTL", f"Chính biên, Đệ {'nhất nhị tam tứ'.split()[vol - 1]} kỷ, Q.1"),
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


if BAD:
    for b in BAD:
        print("KHÔNG CÓ TRONG NGUYÊN VĂN:", b)
    sys.exit(1)

data = {
    "clan": {"key": "nguyen", "name": "Nhà Nguyễn (1558–1945)", "category": "royal",
             "description": "Gia phả các chúa Nguyễn và vua nhà Nguyễn theo Đại Nam thực lục, Đại Nam liệt truyện. Đợt 1: từ tổ tiên đến Gia Long; đợt 2: Minh Mạng, Thiệu Trị và một số hoàng tử. Mỗi dữ kiện có trích dẫn nguyên văn; xem dòng \"Theo:\" cuối tiểu sử."},
    "persons": persons, "unions": unions, "resting_places": [], "heritage": [], "events": [],
    "same_person_links": [],
}
json.dump(data, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(persons)} người, {len(unions)} hôn nhân")
