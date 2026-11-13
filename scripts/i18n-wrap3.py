#!/usr/bin/env python3
"""Lượt 3: phần tử JSX có nội dung là đoạn văn xen thẻ nội tuyến/biểu thức, còn chữ Việt trần
(chưa bọc) → bọc toàn bộ nội dung vào <Trans> để giữ trật tự câu cho ngôn ngữ khác.

  python3 scripts/i18n-wrap3.py [--dry] tệp…
"""
import importlib.util, re, sys, pathlib

spec = importlib.util.spec_from_file_location("w1", pathlib.Path(__file__).with_name("i18n-wrap.py"))
w1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(w1)

OPEN = re.compile(r"^(\s*)<([A-Za-z][\w.]*)\b(?:[^<>]|=>|\{[^{}]*\})*[^/]>\s*$")
INLINE = {"strong", "b", "code", "em", "i", "span", "a", "Link", "kbd", "u", "br"}
BLOCK_HINT = re.compile(r"<(div|p|ul|ol|li|Button|Input|Label|Select|Card|form|table|img|svg|Icon\w+|Alert|section|h\d)\b")


def bare_vi(line):
    """Dòng có chữ Việt nằm ngoài t`…`, ngoài thuộc tính chuỗi, ngoài comment."""
    s = re.sub(r"t`[^`]*`", "", line)
    s = re.sub(r'="[^"]*"', "", s)
    s = re.sub(r"\{[^{}]*\}", "", s)
    s = re.sub(r"<[^<>]*>", " ", s)
    return w1.is_vi(s) and not s.strip().startswith(("//", "*", "/*"))


def process(path, dry):
    L = open(path, encoding="utf-8").read().split("\n")
    mod = w1.module_level_ranges(L)
    in_mod = lambda i: any(a <= i <= b for a, b in mod)
    edits = []  # (open_idx, close_idx, indent)
    i = 0
    while i < len(L):
        m = OPEN.match(L[i])
        if m and not in_mod(i) and "Trans" not in m.group(2):
            ind, tag = m.group(1), m.group(2)
            j = i + 1
            while j < len(L) and not re.match(rf"^{ind}</{re.escape(tag)}>", L[j]):
                if re.match(r"^\s*$", L[j]) is None and len(re.match(r"\s*", L[j]).group(0)) <= len(ind) and j > i:
                    j = -1; break
                j += 1
            if j == -1 or j >= len(L):
                i += 1; continue
            inner = L[i + 1:j]
            txt = "\n".join(inner)
            ok = (
                inner
                and any(bare_vi(x) for x in inner)
                and "<Trans" not in txt and "</Trans" not in txt
                and not BLOCK_HINT.search(txt)
                and not re.search(r"&&|\.map\(|=>|\?\s*[^?]|\bif\b", re.sub(r"t`[^`]*`", "", txt))
                and not any(x.strip().startswith(("//", "{/*")) for x in inner)
            )
            if ok:
                edits.append((i, j, ind))
                i = j + 1; continue
        i += 1
    for i, j, ind in reversed(edits):
        L.insert(j, f"{ind}  </Trans>")
        L.insert(i + 1, f"{ind}  <Trans>")
    out = "\n".join(L)
    if edits and 'from "@lingui/react/macro"' not in out:
        m = list(re.finditer(r"^import .*?;\s*$|^} from .*?;\s*$", out, re.M))
        pos = m[-1].end() if m else 0
        out = out[:pos] + '\nimport { Trans } from "@lingui/react/macro";' + out[pos:]
    if edits and not dry:
        open(path, "w", encoding="utf-8").write(out)
    return len(edits)


if __name__ == "__main__":
    dry = "--dry" in sys.argv
    tot = 0
    for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
        c = process(f, dry); tot += c
        if c: print(f"{f}: {c}")
    print("Tổng:", tot)
