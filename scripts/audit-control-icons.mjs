#!/usr/bin/env node
/**
 * Rà các control (Button / Input / select / textarea) thiếu icon.
 *
 * Quy ước ở docs/design-language.md: mọi control đều phải có icon để
 * người lớn tuổi nhận diện hành động bằng hình thay vì phải đọc chữ.
 *
 * Chạy:  node scripts/audit-control-icons.mjs [--json]
 *
 * Không phải mọi cảnh báo đều là lỗi — xem phần "Ngoại lệ" trong doc.
 * Script này để BIẾT còn bao nhiêu, không phải để chặn commit.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const files = globSync("src/**/*.tsx");

/** Bỏ qua control nằm trong các file này (xem doc, mục Ngoại lệ). */
const SKIP_FILES = [/^src\/components\/ui\//, /^src\/test\//];

/** Text nút mà thêm icon chỉ làm nhiễu. */
const TEXT_ONLY_OK =
  /^(Huỷ|Hủy|Đóng|Bỏ qua|Để sau|Quay lại|Không|Có|OK|Xong|Tiếp|Trước|Sau|\d+)$/i;

function attrsOf(tag) {
  return tag;
}

/**
 * Tìm vị trí đóng thẻ mở, BỎ QUA `>` nằm trong `{...}`.
 *
 * Cần thiết vì thuộc tính hay chứa arrow function: `onClick={() => x()}`.
 * Cắt ở dấu `>` đầu tiên sẽ nuốt luôn phần thân, khiến nhãn nút đọc ra
 * thành `setPickerOpen(false)}>Xong` — rồi trượt khỏi danh sách miễn trừ
 * và bị báo nhầm là thiếu icon.
 *
 * Trả về `[chỉ số ngay sau thẻ mở, có phải thẻ tự đóng không]`.
 */
function endOfOpenTag(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) {
      return [i + 1, src[i - 1] === "/"];
    }
  }
  return [src.length, true];
}

function scanButtons(src, file) {
  const out = [];
  const re = /<Button\b/g;
  let m;
  while ((m = re.exec(src))) {
    const [tagEnd, selfClosing] = endOfOpenTag(src, m.index);
    const open = src.slice(m.index, tagEnd);
    let body = "";
    if (!selfClosing) {
      const close = src.indexOf("</Button>", tagEnd);
      body = close === -1 ? "" : src.slice(tagEnd, close);
    }
    re.lastIndex = tagEnd;
    const chunk = open + body;
    if (/Icon[A-Z]/.test(chunk)) continue;
    const label = body.replace(/<[^>]*>/g, "").replace(/\{[^}]*\}/g, "").trim();
    if (TEXT_ONLY_OK.test(label)) continue;
    out.push({
      file,
      line: src.slice(0, m.index).split("\n").length,
      kind: "Button",
      label: label.slice(0, 42) || "(không có nhãn)",
    });
  }
  return out;
}

function scanSelfClosing(src, file, tag, kind) {
  const out = [];
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?>`, "g");
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split("\n").length;
    // Icon của ô nhập nằm ở phần tử ANH EM (icon trong ô), nên soi cả
    // khối 6 dòng quanh nó thay vì chỉ mỗi thẻ.
    const lines = src.split("\n");
    const around = lines.slice(Math.max(0, line - 4), line + 3).join("\n");
    if (/Icon[A-Z]/.test(around)) continue;
    const name = (m[0].match(/(?:name|id|aria-label|placeholder)="([^"]{1,40})"/) ||
      [])[1];
    out.push({ file, line, kind, label: name ?? "(không rõ)" });
  }
  return out;
}

const findings = [];
for (const file of files) {
  if (SKIP_FILES.some((re) => re.test(file))) continue;
  const src = readFileSync(file, "utf8");
  findings.push(
    ...scanButtons(src, file),
    ...scanSelfClosing(src, file, "Input", "Input"),
    ...scanSelfClosing(src, file, "select", "select"),
    ...scanSelfClosing(src, file, "textarea", "textarea"),
  );
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  const sorted = [...byFile].sort((a, b) => b[1].length - a[1].length);
  for (const [file, items] of sorted) {
    console.log(`\n${file}  (${items.length})`);
    for (const i of items) {
      console.log(`  ${String(i.line).padStart(4)}  ${i.kind.padEnd(8)} ${i.label}`);
    }
  }
  const counts = findings.reduce((a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a), {});
  console.log(
    `\nTổng: ${findings.length}  ` +
      Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join("  "),
  );
}
