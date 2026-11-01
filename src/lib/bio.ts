/**
 * Tách / chuẩn hoá tiểu sử có mục — thuần TypeScript (không React) để PDF, CSV,
 * GEDCOM và Zalo dùng chung với giao diện web.
 */
/**
 * Tiểu sử có cấu trúc: dòng "## Tiêu đề" là một mục, dòng "- …" là một ý trong
 * danh sách, còn lại là đoạn văn. Tiểu sử thường (không có "##") hiện như văn
 * bản cũ, nên người dùng nhập tay không bị đổi cách hiển thị.
 */
export type BioBlock =
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

export function parseBio(src: string): BioBlock[] {
  const out: BioBlock[] = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const h = /^##\s+(.+)$/.exec(t);
    const li = /^[-•]\s+(.+)$/.exec(t);
    const last = out[out.length - 1];
    if (h) out.push({ kind: "h", text: h[1] });
    else if (li) {
      if (last?.kind === "ul") last.items.push(li[1]);
      else out.push({ kind: "ul", items: [li[1]] });
    } else if (last?.kind === "p") last.text += "\n" + t;
    else out.push({ kind: "p", text: t });
  }
  // Mục không có nội dung (tiêu đề đứng liền tiêu đề khác hoặc cuối bài) thì ẩn.
  return out.filter((b, i) => b.kind !== "h" || (out[i + 1] && out[i + 1].kind !== "h"));
}

/**
 * Tiểu sử dạng văn bản thường (cho PDF, thẻ in…): bỏ dấu "##", bỏ mục trống;
 * "Tóm lược" giữ nguyên đoạn đầu, mục khác thành "Tiêu đề: nội dung"; ý "- …" thành "• …".
 */
export function bioToPlainText(src: string | null | undefined): string {
  if (!src) return "";
  if (!/^##\s/m.test(src)) return src;
  const lines: string[] = [];
  let heading = "";
  for (const b of parseBio(src)) {
    if (b.kind === "h") {
      heading = b.text;
      continue;
    }
    const body = b.kind === "ul" ? b.items.map((x) => `• ${x}`).join("\n") : b.text;
    lines.push(heading && heading !== "Tóm lược" ? `${heading}: ${body}` : body);
    heading = "";
  }
  return lines.join("\n");
}

