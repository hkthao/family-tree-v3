"""Đối chiếu ngày sinh / năm trị vì các vua Nguyễn với Việt sử tân biên (Quyển 6, tr.335–336, "Bản đế hệ từ Thiệu Trị trở xuống").

  python3 -I scripts/historical/patch_nguyen_vstb.py data/historical/nguyen.json <lunar.json>

<lunar.json>: {"nguyen.tu-duc": {"year":1829,"month":8,"day":25}, ...} — ngày dương lịch của sách đã quy đổi âm bằng solarStringToLunar
(src/lib/lunarDate.ts). Chạy lại được. Ngày dương của sách ghi vào note; trích dẫn chữ lấy từ bản OCR, các dòng này đã xem lại ảnh trang 336.
Ngoài đối chiếu còn điền chỗ trống: ngày sinh Hàm Nghi và năm hết trị vì của Khải Định (1925).
"""
import json
import sys

LOC = "Quyển 6, tr.335–336, Phụ lục Bản đế hệ từ Thiệu Trị trở xuống"
ROWS = {  # key → (trích nguyên văn, ngày dương lịch của sách)
    "nguyen.tu-duc": ("sinh ngày 22-9-1829", "22-9-1829"),
    "nguyen.duc-duc": ("DỤC - ĐỨC sinh ngày 23-2-1852", "23-2-1852"),
    "nguyen.hiep-hoa": ("sinh ngày 1-11-1847, ở ngôi từ 30-7-1883 đến 29-11-1883", "1-11-1847"),
    "nguyen.kien-phuc": ("KIẾN-PHÚC sinh ngày 12-2-1869", "12-2-1869"),
    "nguyen.dong-khanh": ("ĐỒNG-KHÁNH sinh ngày 19-2-1864", "19-2-1864"),
    "nguyen.thanh-thai": ("THÀNH-THÁI sinh ngày 14-3-1879", "14-3-1879"),
    "nguyen.bao-dai": ("BẢO-ĐẠI sinh ngày 22-10-1913", "22-10-1913"),
    "nguyen.khai-dinh": ("KHẢI-ĐỊNH sinh ngày 8-10-1885, ở ngôi từ 17-5-1916 đến 6-11-1925", "8-10-1885"),
    "nguyen.ham-nghi": ("HÀM-NGHI sinh ngày 3-8 1871", "3-8-1871"),
}

path, lunar_path = sys.argv[1], sys.argv[2]
data = json.load(open(path, encoding="utf8"))
lunar = json.load(open(lunar_path, encoding="utf8"))
by = {p["key"]: p for p in data["persons"]}
n = 0
for key, (quote, solar) in ROWS.items():
    p, lu = by[key], lunar[key]
    cites = p.setdefault("citations", [])
    if any(c.get("source") == "VSTB" and c.get("field") == "birth" for c in cites):
        continue
    if not p.get("birth"):
        p["birth"] = {"lunar_year": lu["year"], "lunar_month": lu["month"], "lunar_day": lu["day"]}
    cites.append({"field": "birth", "source": "VSTB", "locator": LOC, "quote": quote,
                  "value": f"âm {lu['year']}-{lu['month']}-{lu['day']}",
                  "note": f"Sách ghi dương lịch {solar}; quy đổi âm lịch bằng solarStringToLunar."})
    n += 1
kd = by["nguyen.khai-dinh"]
r = kd["reigns"][0]
if not r.get("end_year"):
    r["end_year"] = 1925
    kd["citations"].append({"field": "reign:0", "source": "VSTB", "locator": LOC, "quote": ROWS["nguyen.khai-dinh"][0],
                            "note": "Hết trị vì 6-11-1925 dương lịch = ngày 20 tháng 9 năm Ất Sửu (1925)."})
json.dump(data, open(path, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{path}: đối chiếu thêm {n} người")
