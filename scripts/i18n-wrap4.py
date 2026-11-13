#!/usr/bin/env python3
"""Lượt 4: dòng chữ Việt trần có `{biểu thức}` đơn giản, là nội dung duy nhất của một phần tử
JSX (dòng trước kết thúc `>`, dòng sau bắt đầu `<`) → {t`…${biểu thức}…`}.

  python3 scripts/i18n-wrap4.py [--dry] tệp…
"""
import importlib.util, re, sys, pathlib
spec = importlib.util.spec_from_file_location("w1", pathlib.Path(__file__).with_name("i18n-wrap.py"))
w1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(w1)
LINE = re.compile(r"(?:[^<>{}=\n`\\]|\{[^{}<>\n`]*\})+")


def process(path, dry):
    L = open(path, encoding="utf-8").read().split("\n")
    mod = w1.module_level_ranges(L)
    in_mod = lambda i: any(a <= i <= b for a, b in mod)
    n = 0
    for i, line in enumerate(L):
        st = line.strip()
        if not st or in_mod(i) or st.startswith(("//", "*", "/*", "{/*")) or not LINE.fullmatch(st):
            continue
        plain = re.sub(r"\{[^{}]*\}", "", st)
        if not w1.is_vi(plain) or "t`" in st:
            continue
        prev = next((L[k].strip() for k in range(i - 1, -1, -1) if L[k].strip()), "")
        nxt = next((L[k].strip() for k in range(i + 1, len(L)) if L[k].strip()), "")
        if not (prev.endswith(">") and not prev.endswith("=>") and nxt.startswith("<")):
            continue
        body = re.sub(r'\{" "\}', " ", st)
        body = re.sub(r"\{([^{}]*)\}", r"${\1}", body)
        if "`" in body or "\\" in body:
            continue
        ind = re.match(r"\s*", line).group(0)
        L[i] = f"{ind}{{t`{body.strip()}`}}"
        n += 1
    out = "\n".join(L)
    if n and 'from "@lingui/core/macro"' not in out:
        m = list(re.finditer(r"^import .*?;\s*$|^} from .*?;\s*$", out, re.M))
        pos = m[-1].end() if m else 0
        out = out[:pos] + '\nimport { t } from "@lingui/core/macro";' + out[pos:]
    elif n and not re.search(r'import \{[^}]*\bt\b[^}]*\} from "@lingui/core/macro"', out):
        out = re.sub(r'import \{ ([^}]*) \} from "@lingui/core/macro";', lambda m: 'import { ' + m.group(1) + ', t } from "@lingui/core/macro";', out, count=1)
    if n and not dry:
        open(path, "w", encoding="utf-8").write(out)
    return n

if __name__ == "__main__":
    dry = "--dry" in sys.argv; tot = 0
    for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
        c = process(f, dry); tot += c
        if c: print(f"{f}: {c}")
    print("Tổng:", tot)
