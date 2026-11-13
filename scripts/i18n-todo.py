#!/usr/bin/env python3
"""Đo tiến độ đa ngôn ngữ: liệt kê dòng tiếng Việt CHƯA bọc `t` / <Trans> theo từng tệp.

  python3 scripts/i18n-todo.py            # tóm tắt theo thư mục + 25 tệp nhiều nhất
  python3 scripts/i18n-todo.py -v FILE    # in từng dòng còn sót của một tệp

Bỏ qua: comment, tệp test, và các khu vực KHÔNG dịch theo plan (trang quản trị nền tảng, pháp lý,
Changelog, hướng dẫn dài, PDF, kinship/âm lịch — làm riêng ở giai đoạn sau).
"""
import os
import re
import sys
from collections import Counter

VN = "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ"
VN_RE = re.compile(f"[{VN}{VN.upper()}]")
SKIP = re.compile(r"(^src/test/|^src/pages/admin/|PrivacyPolicy|TermsOfUse|Changelog|^src/pages/docs/|^src/lib/pdf/|CustomsImport|^src/locales/|/kinship\.ts|/lunarDate\.ts|\.test\.)")

def scan():
    res = {}
    for root, _, files in os.walk("src"):
        for f in files:
            if not f.endswith((".ts", ".tsx")):
                continue
            path = os.path.join(root, f)
            if SKIP.search(path):
                continue
            lines = open(path, encoding="utf-8").read().split("\n")
            hits = []
            in_block = False
            for i, ln in enumerate(lines, 1):
                st = ln.strip()
                if in_block:
                    if "*/" in st:
                        in_block = False
                    continue
                if st.startswith("/*") and "*/" not in st:
                    in_block = True
                    continue
                code = re.sub(r"\s//\s.*$", "", ln)  # bỏ comment cuối dòng
                if st.startswith(("//", "*", "/*", "{/*")) or not VN_RE.search(code):
                    continue
                if "t`" in ln or "<Trans" in ln or "</Trans" in ln or "msg`" in ln:
                    continue
                if st.startswith(("import ", "export type", "type ")):
                    continue
                hits.append((i, st))
            if hits:
                res[path] = hits
    return res

def main():
    r = scan()
    if len(sys.argv) >= 3 and sys.argv[1] == "-v":
        for i, s in r.get(sys.argv[2], []):
            print(f"{i}: {s[:140]}")
        return
    total = sum(len(v) for v in r.values())
    by_dir = Counter()
    for p, v in r.items():
        by_dir[os.path.dirname(p)] += len(v)
    print(f"Còn {total} dòng tiếng Việt chưa bọc, trong {len(r)} tệp\n")
    for d, n in by_dir.most_common(12):
        print(f"  {n:5d}  {d}")
    print("\nTệp nhiều nhất:")
    for p, v in sorted(r.items(), key=lambda kv: -len(kv[1]))[:25]:
        print(f"  {len(v):4d}  {p}")

main()
