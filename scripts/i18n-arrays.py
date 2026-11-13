#!/usr/bin/env python3
"""Mảng nhãn mức module `const X[: T] = [ {label: "Việt"}, ... ];` -> msg`` + lazyMessages()."""
import re, sys, pathlib
VI = re.compile(r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", re.I)
HEAD = re.compile(r"^(export )?const (\w+)(\s*:\s*([^=]+?))?\s*=\s*\[\s*$")
KEYS = r"(?:label|hint|title|description|name|note|text|placeholder|desc|short|help)"
FIELD = re.compile(r'(\b' + KEYS + r':\s*)"((?:[^"\\]|\\.)*)"')
n = 0
for f in sys.argv[1:]:
    p = pathlib.Path(f); L = p.read_text().split("\n"); out = []; i = 0; touched = False
    while i < len(L):
        m = HEAD.match(L[i])
        if m:
            j = i + 1
            while j < len(L) and L[j] != "];": j += 1
            body = L[i + 1:j]
            new = [FIELD.sub(lambda mm: mm.group(1) + "msg`" + mm.group(2) + "`" if VI.search(mm.group(2)) else mm.group(0), b) for b in body]
            if j < len(L) and new != body:
                typ = m.group(4)
                out.append(f"{m.group(1) or ''}const {m.group(2)}{': ' + typ.strip() if typ else ''} = lazyMessages([")
                out += new
                out.append(f"]){' as unknown as ' + typ.strip() if typ else ''};")
                i = j + 1; touched = True; continue
        out.append(L[i]); i += 1
    if touched:
        idx = [k for k, l in enumerate(out) if l.startswith("import ") or l.startswith("} from ")]
        s = "\n".join(out)
        add = []
        if 'from "@lingui/core/macro"' not in s: add.append('import { msg } from "@lingui/core/macro";')
        elif not re.search(r'import \{[^}]*\bmsg\b[^}]*\} from "@lingui/core/macro"', s):
            s = re.sub(r'import \{ ([^}]*) \} from "@lingui/core/macro";', lambda mm: 'import { ' + mm.group(1) + ', msg } from "@lingui/core/macro";', s, 1)
        if "lazyMessages }" not in s and "lazyMessages," not in s: add.append('import { lazyMessages } from "@/lib/i18n/lazy";')
        L2 = s.split("\n")
        if add: L2.insert((idx[-1] + 1) if idx else 0, "\n".join(add))
        p.write_text("\n".join(L2)); n += 1; print("arr:", f)
print(n, "tệp")
