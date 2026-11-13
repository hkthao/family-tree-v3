#!/usr/bin/env python3
"""Bọc bảng nhãn mức module `const X[: T] = { k: "Việt", ... };` bằng msg`` + lazyMessages()."""
import re, sys, pathlib
VI = re.compile(r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", re.I)
HEAD = re.compile(r"^(export )?const (\w+)(\s*:\s*([^=]+?))?\s*=\s*\{\s*$")
ENTRY = re.compile(r'^(\s+)([\w"\']+|\[[^\]]+\]):\s*"((?:[^"\\]|\\.)*)"(,?)\s*$')
changed = 0
for f in sys.argv[1:]:
    p = pathlib.Path(f); lines = p.read_text().split("\n"); out = []; i = 0; touched = False
    while i < len(lines):
        m = HEAD.match(lines[i])
        if m:
            j = i + 1; body = []
            while j < len(lines) and lines[j] != "};":
                body.append(lines[j]); j += 1
            ok = j < len(lines) and body and all(ENTRY.match(b) or not b.strip() or b.strip().startswith("//") for b in body)
            if ok and any(VI.search(b) for b in body):
                typ = m.group(4)
                out.append(f"{m.group(1) or ''}const {m.group(2)}{': ' + typ.strip() if typ else ''} = lazyMessages({{")
                for b in body:
                    e = ENTRY.match(b)
                    if e and VI.search(e.group(3)):
                        out.append(f"{e.group(1)}{e.group(2)}: msg`{e.group(3)}`{e.group(4)}")
                    else:
                        out.append(b)
                out.append(f"}}){' as ' + typ.strip() if typ else ''};")
                i = j + 1; touched = True; continue
        out.append(lines[i]); i += 1
    if touched:
        s = "\n".join(out)
        imp = 'import { msg } from "@lingui/core/macro";\nimport { lazyMessages } from "@/lib/i18n/lazy";\n'
        # đặt sau import cuối
        idx = [k for k, l in enumerate(s.split("\n")) if l.startswith("import ") or l.startswith("} from ")]
        L = s.split("\n"); L.insert(idx[-1] + 1, imp.rstrip("\n")); p.write_text("\n".join(L)); changed += 1
        print("map:", f)
print(changed, "tệp")
