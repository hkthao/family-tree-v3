"""Dựng tiểu sử có cấu trúc (bio_lib.structure) cho file JSON đã sinh — dùng khi không còn đủ nguồn để chạy lại gen_<triều>.py.

  python3 -I scripts/historical/structure_json.py data/historical/nguyen.json
Người đã có mục viết tay giữ nguyên; chỉ điền mục trống từ các trường có sẵn (cha mẹ, hôn nhân, ngày sinh/mất, trị vì, lăng).
"""
import importlib.util
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bio_lib", os.path.join(here, "bio_lib.py"))
bio_lib = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bio_lib)

for path in sys.argv[1:]:
    data = json.load(open(path, encoding="utf8"))
    bio_lib.structure(data["persons"], data["unions"])
    json.dump(data, open(path, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"{path}: dựng tiểu sử cho {len(data['persons'])} người")
