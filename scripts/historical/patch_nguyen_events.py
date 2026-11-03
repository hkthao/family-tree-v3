"""Thêm sự kiện theo năm cho các chúa Nguyễn (Đại Nam thực lục Tiền biên) vào mục "Sự nghiệp theo năm" + trích dẫn.

  python3 -I scripts/historical/patch_nguyen_events.py data/historical/nguyen.json <thư-mục-nguồn>

Mỗi sự kiện: (người, năm âm lịch, lời kể, quyển Tiền biên, trích nguyên văn). Trích dẫn phải có THẬT trong quyển và nằm dưới tiêu đề năm can chi
đúng năm đã khai — sai là dừng. Chạy lại được (bỏ qua sự kiện đã có). Chạy SAU gen_nguyen + apply_tonpha + structure_json.
"""
import json
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"]
CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"]
GZ, ZZ = "甲乙丙丁戊己庚辛壬癸", "子丑寅卯辰巳午未申酉戌亥"


def canchi_vi(y):
    return f"{CAN[(y - 4) % 10]} {CHI[(y - 4) % 12]}"


def canchi_han(y):
    return GZ[(y - 4) % 10] + ZZ[(y - 4) % 12]


EVENTS = [
    ("nguyen.thai-to", 1558, "Lần đầu vào trấn Thuận Hóa, khi 34 tuổi; được người làng Tống Sơn và nghĩa dũng Thanh Hóa theo.", 1, "冬十月，上初鎮順化，時年三十四"),
    ("nguyen.thai-to", 1570, "Kiêm lãnh cả Thuận Hóa và Quảng Nam, đeo ấn Tổng trấn tướng quân, đặt quân hiệu Hùng Nghĩa.", 1, "上遂兼領順化廣南二處，佩總鎮將軍印，置軍號曰雄義營"),
    ("nguyen.thai-to", 1601, "Dựng chùa Thiên Mụ trên đồi Hà Khê.", 1, "乃建寺焉，名天姥寺"),
    ("nguyen.thai-to", 1611, "Đánh Chiêm Thành, đặt phủ Phú Yên.", 1, "初置富安府"),
    ("nguyen.hy-tong", 1614, "Đặt ba ty trong dinh chính: Xá sai (xử kiện), Tướng thần lại (thu thuế, phát lương) và Lệnh sử (tế lễ).", 2, "初置三司在內正營"),
    ("nguyen.hy-tong", 1630, "Đắp lũy Trường Dục (Quảng Bình) để chống quân Trịnh.", 2, "築長育（社名，屬廣平豐祿縣）壘"),
    ("nguyen.hy-tong", 1633, "Trịnh Tráng đem quân đánh cửa biển Nhật Lệ nhưng bị đánh tan, chết quá nửa.", 2, "鄭兵潰走，死者太半"),
    ("nguyen.than-tong", 1647, "Mở khoa thi đầu tiên: bảy người trúng chính đồ, hai mươi bốn người trúng hoa văn, đều được bổ dụng.", 3, "初開試科"),
    ("nguyen.than-tong", 1648, "Quân Trịnh sang đánh; vua sai thế tử đánh tan.", 3, "鄭人來侵，上命世子勇禮侯擊破之"),
    ("nguyen.thai-tong", 1655, "Đánh nhau liền với Trịnh; vua giận, bàn việc bắc phạt.", 4, "上大怒議北征"),
    ("nguyen.thai-tong", 1673, "Nguyên soái Nguyễn Phúc Hiệp thắng trận trở về yết kiến; vua mừng, thưởng vàng bạc và tế cáo trời đất tông miếu.", 5, "元帥協凱還至良福府謁見，上大悅"),
    ("nguyen.thai-tong", 1679, "Tướng cũ nhà Minh Dương Ngạn Địch, Hoàng Tiến, Trần Thượng Xuyên, Trần An Bình đem ba nghìn quân, năm mươi chiến thuyền đến xin làm bề tôi; được cho vào khai khẩn Đông Phố (Nam Bộ).", 5, "率兵三千餘人、戰船五十餘艘，投思容沱㶞海口"),
    ("nguyen.hien-tong", 1693, "Quân Nguyễn do Nguyễn Hữu Cảnh đánh bại vua Chiêm Thành Bà Tranh.", 7, "統兵阮有鏡等擊占城大敗之"),
    ("nguyen.the-tong", 1744, "Lên ngôi vương ở chính phủ Phú Xuân, đại xá trong nước; đã đúc ấn quốc vương.", 10, "己未，上即王位于富春正府，下詔大赦境內"),
    ("nguyen.the-tong", 1747, "Người Thanh Lý Văn Quang đánh úp trấn Biên (Đồng Nai), tự xưng Đông Phố đại vương; bị cai cơ Tống Phúc Đại dẹp.", 10, "清商李文光襲鎮邊營，該奇宋福大討平之"),
]

if len(sys.argv) < 3:
    sys.exit(__doc__)
path, src = sys.argv[1], sys.argv[2]


def clean(t):
    t = re.sub(r"<ref>.*?</ref>", "", t)
    t = re.sub(r"\{\{漏字\|([^|}]*)\|[^}]*\}\}", r"\1", t)
    t = re.sub(r"\{\{[*注註]\|([^}]*)\}\}", r"（\1）", t)
    return re.sub(r"\{\{[^}]*\}\}", "", t)


TB = {n: re.sub(r"\s+", "", clean(open(f"{src}/tb/tb_{n:02d}.txt", encoding="utf8").read())) for n in range(1, 13)}
HEAD = re.compile(r"([%s][%s])(?:元|[一二三四五六七八九十]+)年" % (GZ, ZZ))
bad = []
for key, y, _, vol, q in EVENTS:
    t = TB[vol]
    pos = t.find(q)
    if pos < 0:
        bad.append(f"{key} {y}: không thấy trong Tiền biên Q.{vol}: {q}")
        continue
    heads = [m for m in HEAD.finditer(t) if m.start() <= pos]
    got = heads[-1].group(1) if heads else None
    if got != canchi_han(y):
        bad.append(f"{key} {y}: trích dẫn nằm dưới năm {got}, không phải {canchi_han(y)}: {q}")
if bad:
    sys.exit("\n".join(bad))

data = json.load(open(path, encoding="utf8"))
by = {p["key"]: p for p in data["persons"]}
SEC = ["Tóm lược", "Xuất thân", "Lên ngôi", "Sự nghiệp theo năm", "Gia quyến", "Qua đời và lăng tẩm", "Sử thần nhận xét"]
added = 0
for key in sorted({e[0] for e in EVENTS}):
    p = by[key]
    parts = re.split(r"^##\s+(.+)$", p["bio"].strip(), flags=re.M)
    sec = {parts[i].strip(): parts[i + 1].strip() for i in range(1, len(parts), 2)}
    rows = []
    for line in sec.get("Sự nghiệp theo năm", "").split("\n"):
        m = re.match(r"^- Năm .*? \((\d{4})\): ", line)
        if m:
            rows.append((int(m.group(1)), line))
    for k, y, text, vol, q in EVENTS:
        if k != key:
            continue
        line = f"- Năm {canchi_vi(y)} ({y}): {text}"
        if line in [r[1] for r in rows]:
            continue
        rows.append((y, line))
        p.setdefault("citations", []).append({"field": "bio", "source": "DNTL", "locator": f"Tiền biên Q.{vol}, năm {canchi_vi(y)} ({y})", "quote": q})
        added += 1
    rows.sort(key=lambda r: r[0])
    sec["Sự nghiệp theo năm"] = "\n".join(r[1] for r in rows)
    p["bio"] = "\n\n".join(f"## {s}\n{sec.get(s, '')}".rstrip() for s in SEC)
json.dump(data, open(path, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{path}: thêm {added} sự kiện")
