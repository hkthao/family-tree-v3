#!/usr/bin/env python3
"""Lượt 2 của codemod: chuỗi "…" tiếng Việt đứng trong mã (không phải mức module).

  python3 scripts/i18n-wrap2.py [--dry] tệp…

Bọc `"Việt"` → t`Việt` ở: `?? "x"`, `|| "x"`, `? "x" :`, `: "x"`, `return "x"`, `push("x")`,
`label = "x",` (tham số mặc định), `emptyHint="x"` và các thuộc tính nhãn khác, đối số hàm.
Bỏ qua: mức module, so sánh (`=== "x"`, startsWith/includes/slice), comment, import.
"""
import importlib.util, re, sys, pathlib

spec = importlib.util.spec_from_file_location("w1", pathlib.Path(__file__).with_name("i18n-wrap.py"))
w1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(w1)

ATTRS2 = r"(?:emptyHint|ctaLabel|labelOn|labelOff|cancelLabel|confirmLabel|saveLabel|empty|helper|filterPlaceholder|label|title|description|placeholder|hint|aria-label|subtitle)"
LIT = re.compile(r'"([^"\n\\]*)"')
CMP_BEFORE = re.compile(r'(===|!==|==|!=|startsWith\(|endsWith\(|includes\(|slice\(|indexOf\(|case\s*|Set\(\[|\bin\s*)$')


def plain_label(s):  # nhãn ngắn không dấu
    return s in {"Nam"}


def conv(line):
    def lit(m):
        s = m.group(1)
        before = line[:m.start()].rstrip()
        if CMP_BEFORE.search(before):
            return m.group(0)
        if before.endswith(("import", "from", "className=", "className:", "key:", "id:", "to=", "href=", "type=", "value=")):
            return m.group(0)
        if not (w1.ok_text(s) or plain_label(s)):
            return m.group(0)
        return f"t`{s}`"
    new = line
    # thuộc tính JSX dạng attr="VN"
    new = re.sub(rf'\b({ATTRS2})="([^"\n\\]*)"', lambda m: f"{m.group(1)}={{t`{m.group(2)}`}}" if w1.ok_text(m.group(2)) else m.group(0), new)
    # tham số mặc định:  label = "VN",
    m = re.fullmatch(r'(\s+\w+\s*=\s*)"([^"\n\\]*)"(,?)', new)
    if m and w1.ok_text(m.group(2)):
        return f"{m.group(1)}t`{m.group(2)}`{m.group(3)}"
    # ?? / || / ternary / return / push / hàm / gán / phần tử mảng
    pat = re.compile(r'(\?\?|\|\||\?|:|\breturn|\.push\(|\(|=|,|\[)\s*("[^"\n\\]*")')
    out, last = [], 0
    for mm in pat.finditer(new):
        lm = LIT.fullmatch(mm.group(2))
        s = lm.group(1)
        pre = new[:mm.start(2)].rstrip()
        if CMP_BEFORE.search(pre[:-len(mm.group(1))].rstrip() + "") and mm.group(1) in ("(", "="):
            continue
        # object key trong dữ liệu: bỏ qua nếu ngay trước là khoá `word:` kiểu value/label đã xử lý ở lượt 1
        if not (w1.ok_text(s) or (plain_label(s) and mm.group(1) in ("?", ":"))):
            continue
        # tránh `key: "x"` của hằng cấu hình (khoá không nhãn)
        if mm.group(1) == ":" and re.search(r"\b(value|key|id|to|href|type|kind|tone|variant|className|name|icon|size|role|scope)\s*$", new[:mm.start()]):
            continue
        out.append((mm.start(2), mm.end(2), f"t`{s}`"))
    for a, b, rep in reversed(out):
        new = new[:a] + rep + new[b:]
    return new


def process(path, dry):
    src = open(path, encoding="utf-8").read()
    lines = src.split("\n")
    mod = w1.module_level_ranges(lines)
    in_mod = lambda i: any(a <= i <= b for a, b in mod)
    changed, res = 0, []
    for i, line in enumerate(lines):
        st = line.strip()
        if st.startswith(("//", "*", "/*", "{/*", "import")) or not (w1.is_vi(line) or '"Nam"' in line) or in_mod(i):
            res.append(line); continue
        new = conv(line)
        if new != line:
            changed += 1
        res.append(new)
    out = "\n".join(res)
    if changed and 'from "@lingui/core/macro"' not in out:
        m = list(re.finditer(r"^import .*?;\s*$|^} from .*?;\s*$", out, re.M))
        pos = m[-1].end() if m else 0
        out = out[:pos] + '\nimport { t } from "@lingui/core/macro";' + out[pos:]
    elif changed and not re.search(r'import \{[^}]*\bt\b[^}]*\} from "@lingui/core/macro"', out):
        out = re.sub(r'import \{ ([^}]*) \} from "@lingui/core/macro";', lambda m: 'import { ' + m.group(1) + ', t } from "@lingui/core/macro";', out, count=1)
    if changed and not dry:
        open(path, "w", encoding="utf-8").write(out)
    return changed

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    tot = 0
    for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
        c = process(f, dry); tot += c
        if c: print(f"{f}: {c}")
    print("Tổng:", tot)
