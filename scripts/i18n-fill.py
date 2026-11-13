#!/usr/bin/env python3
"""Điền bản dịch vào src/locales/<mã>/messages.po từ một tệp JSON {"câu tiếng Việt": "bản dịch"}.

  python3 scripts/i18n-fill.py en path/to/batch.json

Chỉ điền mục đang TRỐNG (không ghi đè bản dịch đã có), in ra số mục đã điền và các khoá JSON
không khớp mục nào trong catalog (thường do gõ sai câu gốc). Dùng sau `npm run i18n:extract`.
Thuật ngữ gia phả phải theo docs/glossary-i18n.md.
"""
import json
import re
import sys

if len(sys.argv) != 3:
    sys.exit(__doc__)
locale, batch_path = sys.argv[1], sys.argv[2]
po_path = f"src/locales/{locale}/messages.po"
batch = json.load(open(batch_path, encoding="utf-8"))

def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

def unesc(s: str) -> str:
    return s.replace('\\n', "\n").replace('\\"', '"').replace("\\\\", "\\")

text = open(po_path, encoding="utf-8").read()
blocks = text.split("\n\n")
filled, seen = 0, set()
out = []
for b in blocks:
    m = re.search(r'^msgid "(.*)"\nmsgstr ""$', b, re.M)
    if m and m.group(1):
        key = unesc(m.group(1))
        if key in batch:
            seen.add(key)
            b = b[: m.start()] + f'msgid "{m.group(1)}"\nmsgstr "{esc(batch[key])}"' + b[m.end():]
            filled += 1
    out.append(b)
open(po_path, "w", encoding="utf-8").write("\n\n".join(out))
unmatched = [k for k in batch if k not in seen]
print(f"đã điền {filled} mục vào {po_path}")
if unmatched:
    print(f"{len(unmatched)} khoá không khớp (đã có bản dịch hoặc gõ sai):")
    for k in unmatched[:20]:
        print("  -", k)
