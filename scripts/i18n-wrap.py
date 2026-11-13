#!/usr/bin/env python3
"""Codemod bọc chuỗi tiếng Việt vào macro Lingui `t` — xem docs/plan-da-ngon-ngu.md §5.

  python3 scripts/i18n-wrap.py [--dry] src/pages/clan/Foo.tsx [...]

Bọc (chỉ chuỗi MỘT DÒNG, không có ${}, không có dấu ` hay \\, có chữ cái tiếng Việt):
  - thuộc tính JSX:        placeholder="Tìm…"        →  placeholder={t`Tìm…`}
  - thuộc tính đối tượng:  label: "Lưu"              →  label: t`Lưu`
  - văn bản JSX một dòng:  <Button>Lưu</Button>      →  <Button>{t`Lưu`}</Button>
  - dòng văn bản đứng giữa hai thẻ trên các dòng riêng.
  - nhánh của toán tử ba ngôi: `a ? "X" : "Y"` hoặc dòng bắt đầu bằng `?` / `:`.

KHÔNG bọc (liệt kê ra để xử lý tay):
  - chuỗi ở MỨC MODULE (hằng số/mảng/đối tượng ngoài hàm): `t` chạy lúc nạp module nên đóng băng
    tiếng Việt, đổi ngôn ngữ không có tác dụng. Chuyển sang hàm, hoặc dùng `msg` + `i18n._()`.
  - đoạn văn nhiều dòng, chuỗi có biến (`${}` / nối chuỗi), số nhiều.
  - dòng comment.

Sau khi chạy: `npm run typecheck`, `npm test`, đọc `git diff`, rồi `npm run i18n:extract`.
"""
import re
import sys

VN = "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ"
VN_RE = re.compile(f"[{VN}{VN.upper()}]")
# Từ tiếng Việt không dấu thường gặp trong nhãn ngắn.
PLAIN_WORDS = {"ten", "ho", "email", "xem", "luu", "huy", "xoa", "sua", "them", "tim", "nam", "nu"}

ATTRS = r"(?:placeholder|title|aria-label|ariaLabel|alt|label|helperText|description|subtitle|emptyLabel|filterPlaceholder|filterLabel|hint|unit|tip)"
OBJ_KEYS = r"(?:label|title|subtitle|description|desc|placeholder|hint|helperText|emptyLabel|tooltip|ariaLabel|confirmLabel|text|unit|tip)"


def is_vi(s: str) -> bool:
    return bool(VN_RE.search(s))


def ok_text(s: str) -> bool:
    return (
        bool(s.strip())
        and is_vi(s)
        and "`" not in s
        and "${" not in s
        and "\\" not in s
        and not re.search(r"&[a-zA-Z#0-9]+;", s)  # thực thể HTML (&amp;…): JSX giải mã, template literal thì không
        and "{" not in s
        and "}" not in s
    )


def module_level_ranges(lines):
    """Chỉ số dòng nằm trong khai báo cấp module KHÔNG phải hàm (hằng số dữ liệu)."""
    ranges, i, n = [], 0, len(lines)
    while i < n:
        line = lines[i]
        if re.match(r"^(export\s+)?(const|let|var)\s", line) or re.match(r"^export default \[|^export default \{", line):
            head = line
            # Gom tới khi cân bằng ngoặc.
            depth = 0
            j = i
            started = False
            while j < n:
                for ch in lines[j]:
                    if ch in "([{":
                        depth += 1
                        started = True
                    elif ch in ")]}":
                        depth -= 1
                if started and depth <= 0:
                    break
                # Câu lệnh không có ngoặc (`const KEY = "x";`) kết thúc ngay ở dấu ; — nếu không,
                # vòng lặp chạy tới hết tệp và coi cả phần còn lại là "mức module".
                if not started and lines[j].rstrip().endswith(";"):
                    break
                j += 1
            is_fn = bool(re.search(r"=>|function\b|\buse[A-Z]|forwardRef|memo\(|lazy\(|createContext|StyleSheet", head)) or any(
                "=>" in lines[k] for k in range(i, min(i + 3, n))
            )
            if not is_fn:
                ranges.append((i, j))
            i = j + 1
        else:
            i += 1
    return ranges


# Dòng văn bản: chữ + (tuỳ chọn) biểu thức `{x}` / `{" "}` không lồng nhau; không có thẻ, `=`, `` ` ``.
TEXT_ONLY = re.compile(r"(?:[^<>{}=\n`\\]|\{[^{}<>\n`]*\})+")


def group_paragraphs(lines, in_mod):
    """Đoạn văn bản nhiều dòng giữa hai thẻ → bọc <Trans>…</Trans> (giữ nguyên chữ, Lingui tự chuẩn hoá khoảng trắng)."""
    done, i, n = {}, 0, len(lines)
    while i < n:
        st = lines[i].strip()
        if TEXT_ONLY.fullmatch(st) and ok_text(st) and not in_mod(i) and not st.startswith(("//", "*", "/*")):
            j = i
            while j + 1 < n and TEXT_ONLY.fullmatch(lines[j + 1].strip()) and lines[j + 1].strip() and not lines[j + 1].strip().startswith(("//", "*", "/*")):
                j += 1
            prev = next((lines[k].strip() for k in range(i - 1, -1, -1) if lines[k].strip()), "")
            nxt = next((lines[k].strip() for k in range(j + 1, n) if lines[k].strip()), "")
            if j > i and prev.endswith(">") and not prev.endswith("=>") and nxt.startswith("<"):
                ind = re.match(r"\s*", lines[i]).group(0)
                done[i] = f"{ind}<Trans>{lines[i].strip()}"
                for k in range(i + 1, j):
                    done[k] = lines[k]
                done[j] = f"{lines[j].rstrip()}</Trans>"
                for k in range(i, j + 1):
                    done.setdefault(k, lines[k])
                i = j + 1
                continue
        i += 1
    return done


def process(path: str, dry: bool):
    src = open(path, encoding="utf-8").read()
    lines = src.split("\n")
    mod = module_level_ranges(lines)
    in_mod = lambda idx: any(a <= idx <= b for a, b in mod)  # noqa: E731
    changed = 0
    skipped = []
    out = []
    used_trans = False
    para = group_paragraphs(lines, in_mod)
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if idx in para:
            if para[idx] != line:
                used_trans = True
                changed += 1
            out.append(para[idx])
            continue
        if stripped.startswith(("//", "*", "/*", "{/*")) or not is_vi(line):
            out.append(line)
            continue
        new = line

        def sub_attr(m):
            val = m.group(2)
            if not ok_text(val):
                return m.group(0)
            return f"{m.group(1)}={{t`{val}`}}"

        def sub_obj(m):
            val = m.group(2)
            if not ok_text(val):
                return m.group(0)
            return f"{m.group(1)}: t`{val}`"

        def sub_inline(m):
            val = m.group(2)
            if not ok_text(val) or val != val.strip():
                return m.group(0)
            return f">{{t`{val}`}}<"

        cand = new
        cand = re.sub(rf'\b({ATTRS})="([^"\n]*)"', sub_attr, cand)
        cand = re.sub(rf'\b({OBJ_KEYS}):\s*"([^"\n]*)"', sub_obj, cand)
        cand = re.sub(r'(>)([^<>{}\n]+)(<)', lambda m: sub_inline(m) if m.group(2).strip() else m.group(0), cand)

        def sub_str(m):
            return f"t`{m.group(1)}`" if ok_text(m.group(1)) else m.group(0)

        # Nhánh của toán tử ba ngôi: `cond ? "a" : "b"` trên một dòng, hoặc dòng bắt đầu bằng ? / :
        cand = re.sub(r'(?<=\?\s)"([^"\n]*)"(?=\s*:\s*")', sub_str, cand)
        cand = re.sub(r'(?<=:\s)"([^"\n]*)"(?=\s*[,;)]|\s*$)', lambda m: sub_str(m) if re.search(r'\?\s*(t`|")', cand) else m.group(0), cand)
        # `{cond ? t`…` : "…"}` — nhánh sau dấu : kết thúc bằng }.
        cand = re.sub(r'(?<=:\s)"([^"\n]*)"(?=\s*\})', sub_str, cand) if re.search(r"\?\s*(t`|\")", cand) else cand
        # Template literal một dòng có biến: `Đã thêm ${x} …` → t`Đã thêm ${x} …` (Lingui hiểu ${…}).
        def sub_tpl(m):
            body = m.group(1)
            if not (is_vi(body) and "${" in body) or "<" in body or "\\" in body:
                return m.group(0)
            return f"t`{body}`"

        cand = re.sub(r"(?<![\w`$.])`([^`\n]*)`", sub_tpl, cand)
        # Icon tự đóng + chữ ở cuối dòng:  <Icon /> Chữ
        mi = re.fullmatch(r"(\s*<[A-Za-z][^<>]*/>)\s+([^<>{}=\n`\\]+)", cand)
        if mi and ok_text(mi.group(2).strip()):
            cand = f"{mi.group(1)} {{t`{mi.group(2).strip()}`}}"
        # Đối số chuỗi của hàm báo lỗi / thông báo: setError("…"), toast.error("…"), new Error("…").
        cand = re.sub(
            r'\b(set(?:Error|Info|Message|Notice|Err|Success|Msg|Warning)|toast\.(?:success|error|info|warning|message)|new Error|alert|confirm)\(\s*"([^"\n]*)"',
            lambda m: f"{m.group(1)}(t`{m.group(2)}`" if ok_text(m.group(2)) else m.group(0),
            cand,
        )
        # Chuỗi đứng một mình trên một dòng (nhánh của biểu thức JSX do prettier xuống dòng).
        mm = re.fullmatch(r'(\s*)"([^"\n]*)"([,;]?)', cand)
        if mm and ok_text(mm.group(2)):
            cand = f"{mm.group(1)}t`{mm.group(2)}`{mm.group(3)}"
        if re.match(r'^\s*[?:]\s*"', cand):
            cand = re.sub(r'^(\s*[?:]\s*)"([^"\n]*)"', lambda m: m.group(1) + (f"t`{m.group(2)}`" if ok_text(m.group(2)) else f'"{m.group(2)}"'), cand)
        # "Chưa có tài khoản?{" "}" — chữ rồi khoảng trắng JSX, kế tiếp là một thẻ/liên kết.
        mt = re.fullmatch(r'(\s*)([^<>{}=\n`\\]+?)(\{" "\})', cand)
        if mt and ok_text(mt.group(2)):
            cand = f"{mt.group(1)}{{t`{mt.group(2)}`}}{mt.group(3)}"
        # Dòng văn bản trần giữa hai thẻ.
        if cand == new and re.fullmatch(r"[^<>{}=\n`\\]+", stripped) and ok_text(stripped):
            prev = next((lines[k].strip() for k in range(idx - 1, -1, -1) if lines[k].strip()), "")
            nxt = next((lines[k].strip() for k in range(idx + 1, len(lines)) if lines[k].strip()), "")
            if prev.endswith(">") and nxt.startswith("<") and not prev.endswith("=>"):
                cand = line.replace(stripped, f"{{t`{stripped}`}}")
        if cand != new:
            if in_mod(idx):
                skipped.append((idx + 1, stripped))
                out.append(line)
                continue
            changed += 1
            new = cand
        elif is_vi(line) and re.search(r'"[^"\n]*[%s][^"\n]*"' % (VN + VN.upper()), line) and not stripped.startswith("import"):
            # Còn chuỗi VI chưa xử lý được trên dòng này — để người xem lại.
            skipped.append((idx + 1, "(chưa bọc) " + stripped))
        out.append(new)

    result = "\n".join(out)
    if used_trans and 'from "@lingui/react/macro"' not in result:
        m = list(re.finditer(r"^import .*?;\s*$|^} from .*?;\s*$", result, re.M))
        pos = m[-1].end() if m else 0
        result = result[:pos] + '\nimport { Trans } from "@lingui/react/macro";' + result[pos:]
    if changed and re.search(r"\bt`", result) and 'from "@lingui/core/macro"' not in result:
        # Chèn import sau dòng import cuối cùng của khối đầu tệp.
        m = list(re.finditer(r"^import .*?;\s*$|^} from .*?;\s*$", result, re.M))
        pos = m[-1].end() if m else 0
        result = result[:pos] + '\nimport { t } from "@lingui/core/macro";' + result[pos:]
    if not dry and changed:
        open(path, "w", encoding="utf-8").write(result)
    return changed, skipped


def main():
    args = sys.argv[1:]
    dry = "--dry" in args
    files = [a for a in args if not a.startswith("--")]
    if not files:
        sys.exit(__doc__)
    total = 0
    for f in files:
        changed, skipped = process(f, dry)
        total += changed
        print(f"{f}: bọc {changed} chuỗi" + (" (chạy thử)" if dry else ""))
        for ln, s in skipped[:12]:
            print(f"    chưa bọc @{ln}: {s[:110]}")
        if len(skipped) > 12:
            print(f"    … và {len(skipped) - 12} dòng khác")
    print(f"Tổng: {total} chuỗi")


if __name__ == "__main__":
    main()
