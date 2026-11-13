#!/usr/bin/env python3
"""Dịch theo lô có đánh số, có kiểm tra chỗ trống (placeholder).

  python3 scripts/i18n-batch.py snap en          # chụp danh sách chuỗi CHƯA dịch (đánh số cố định)
  python3 scripts/i18n-batch.py show 0 120       # in "số|câu tiếng Việt" của lô [0,120)
  python3 scripts/i18n-batch.py apply en f.txt   # f.txt gồm các dòng "số|bản dịch"

Kiểm tra mỗi bản dịch: tập `{biến}`, `{0}`, `<0>`/`</0>` phải TRÙNG với câu gốc (dịch xong mà mất / đổi
chỗ trống thì giao diện hiện sai), và không được để trống. Dòng lỗi bị bỏ qua và in ra để dịch lại.
Thuật ngữ gia phả phải theo docs/glossary-i18n.md.
"""
import json
import re
import sys

SNAP = "/tmp/i18n-snap.json"
PH = re.compile(r"\{[A-Za-z0-9_.]+\}|</?\d+>")


def unesc(s):
    return s.replace('\\n', "\n").replace('\\"', '"').replace("\\\\", "\\")


def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def read_po(locale):
    return open(f"src/locales/{locale}/messages.po", encoding="utf-8").read()


PRIORITY = [
    r"^src/components/(?!admin|gallery|treeCanvas|ai)",
    r"^src/pages/clan/(Dashboard|People|PersonDetail|Tree\.|Events|NewPerson|EditPerson|AddChild|AddParent|AddSpouse|Relations|Todo|Settings|Members|Today)",
    r"^src/pages/(Account|Clans|NewClan|Share|JoinClan)",
    r"^src/pages/clan/",
    r"^src/pages/",
]


def rank(path):
    for i, pat in enumerate(PRIORITY):
        if re.search(pat, path):
            return i
    return len(PRIORITY)


def missing_with_files(locale):
    items = []
    for b in read_po(locale).split("\n\n"):
        m = re.search(r'^msgid "((?:[^"\\]|\\.)*)"\nmsgstr ""$', b, re.M)
        if m and m.group(1):
            files = re.findall(r"^#: (\S+)", b, re.M)
            first = min(files, key=rank) if files else "?"
            items.append((rank(first), first, unesc(m.group(1))))
    items.sort(key=lambda x: (x[0], x[1], x[2]))
    return items


def missing(locale):
    return [x[2] for x in missing_with_files(locale)]


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "snap":
        items = missing_with_files(a[1])
        ids = [x[2] for x in items]
        json.dump(ids, open(SNAP, "w", encoding="utf-8"), ensure_ascii=False)
        json.dump([x[1] for x in items], open(SNAP + ".files", "w", encoding="utf-8"), ensure_ascii=False)
        print(f"{len(ids)} chuỗi chưa dịch ({a[1]})")
    elif a[0] == "show":
        ids = json.load(open(SNAP, encoding="utf-8"))
        files = json.load(open(SNAP + ".files", encoding="utf-8"))
        last = None
        for i in range(int(a[1]), min(int(a[2]), len(ids))):
            if files[i] != last:
                last = files[i]
                print(f"# {last}")
            print(f"{i}|{ids[i]}")
    elif a[0] == "apply":
        locale, path = a[1], a[2]
        ids = json.load(open(SNAP, encoding="utf-8"))
        batch, bad = {}, []
        for ln in open(path, encoding="utf-8").read().split("\n"):
            if not ln.strip():
                continue
            num, _, tr = ln.partition("|")
            try:
                i = int(num)
            except ValueError:
                bad.append((ln[:60], "thiếu số thứ tự"))
                continue
            if not (0 <= i < len(ids)):
                bad.append((ln[:60], "số ngoài phạm vi"))
                continue
            src = ids[i]
            if not tr.strip():
                bad.append((src[:60], "bản dịch trống"))
                continue
            if sorted(PH.findall(src)) != sorted(PH.findall(tr)):
                bad.append((src[:70], f"lệch chỗ trống: gốc {PH.findall(src)} ≠ dịch {PH.findall(tr)}"))
                continue
            batch[src] = tr
        text = read_po(locale)
        done = 0
        blocks = []
        for b in text.split("\n\n"):
            m = re.search(r'^msgid "((?:[^"\\]|\\.)*)"\nmsgstr ""$', b, re.M)
            if m and m.group(1) and unesc(m.group(1)) in batch:
                b = b[: m.start()] + f'msgid "{m.group(1)}"\nmsgstr "{esc(batch[unesc(m.group(1))])}"' + b[m.end():]
                done += 1
            blocks.append(b)
        open(f"src/locales/{locale}/messages.po", "w", encoding="utf-8").write("\n\n".join(blocks))
        print(f"đã điền {done} chuỗi; {len(bad)} dòng lỗi")
        for s, why in bad[:25]:
            print(f"  ! {s} — {why}")


main()
