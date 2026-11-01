"""Chuẩn hoá tiểu sử MỌI người trong file nháp về cùng một bộ mục (chạy lại được):

  python3 -I scripts/historical/normalize_bio.py data/historical/tran.json data/historical/nguyen.json

Bộ mục cố định, đúng thứ tự: Tóm lược · Xuất thân · Lên ngôi · Sự nghiệp theo năm ·
Gia quyến · Qua đời và lăng tẩm · Sử thần nhận xét. Người nào chưa có thông tin cho
mục nào thì mục đó để TRỐNG (vẫn có tiêu đề). Tiểu sử viết một mạch (không có mục) được
đặt nguyên vào "Tóm lược". Mục cũ có tên khác được gộp vào mục chuẩn gần nhất:
  Nối ngôi / Nhường ngôi (…) / Trấn giữ … / Trước khi lên ngôi / Biến cố … → Lên ngôi
  Di huấn / Qua đời → Qua đời và lăng tẩm
Không đổi chữ nào của nội dung — chỉ sắp xếp lại, nên citations vẫn khớp.
"""
import json
import re
import sys

STANDARD = ["Tóm lược", "Xuất thân", "Lên ngôi", "Sự nghiệp theo năm", "Gia quyến",
            "Qua đời và lăng tẩm", "Sử thần nhận xét"]
ALIAS = [
    (r"^Tóm lược", "Tóm lược"), (r"^Xuất thân", "Xuất thân"),
    (r"^(Lên ngôi|Nối ngôi|Nhường ngôi|Trấn giữ|Trước khi lên ngôi|Biến cố)", "Lên ngôi"),
    (r"^Sự nghiệp", "Sự nghiệp theo năm"), (r"^Gia quyến", "Gia quyến"),
    (r"^(Qua đời|Di huấn)", "Qua đời và lăng tẩm"), (r"^Sử thần", "Sử thần nhận xét"),
]


def canon(title):
    for rx, std in ALIAS:
        if re.match(rx, title):
            return std
    raise SystemExit(f"Mục lạ chưa có chỗ trong bộ chuẩn: {title!r}")


def parse(bio):
    """→ [(tiêu đề gốc, nội dung)]; không có '## ' → toàn bộ là Tóm lược."""
    if not re.search(r"^##\s", bio, re.M):
        return [("Tóm lược", bio.strip())]
    parts = re.split(r"^##\s+(.+)$", bio.strip(), flags=re.M)
    out = [] if not parts[0].strip() else [("Tóm lược", parts[0].strip())]
    out += [(parts[i].strip(), parts[i + 1].strip()) for i in range(1, len(parts), 2)]
    return out


def normalize(bio):
    got = {s: [] for s in STANDARD}
    for title, body in parse(bio or ""):
        got[canon(title)].append((title, body))
    blocks = []
    for std in STANDARD:
        items = got[std]
        # mục gộp từ nhiều mục cũ: giữ tiêu đề cũ làm đầu đoạn (trừ mục đầu cùng tên chuẩn)
        text = "\n\n".join(
            b if (t == std or std == "Sự nghiệp theo năm" or len(items) == 1) else f"{t}: {b}" for t, b in items
        )
        blocks.append(f"## {std}\n{text}".rstrip())
    return "\n\n".join(blocks)


for path in sys.argv[1:]:
    data = json.load(open(path, encoding="utf8"))
    n = 0
    for p in data["persons"]:
        if p.get("bio"):
            new = normalize(p["bio"])
            if new != p["bio"]:
                p["bio"] = new
                n += 1
    json.dump(data, open(path, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"{path}: chuẩn hoá {n}/{len(data['persons'])} người")
