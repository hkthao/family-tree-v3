/** Thẻ dọc của cây 2D (family-chart): kích thước + bố cục chữ dùng chung. */

export const TALL_NAME_LINE = 26;

/** Viết hoa chữ đầu mỗi tiếng của tên: "lê  thị hà" → "Lê Thị Hà" (cả sau "(" và "-"). */
export function titleCaseName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi")
    .replace(/(^|[\s(\-])(\p{L})/gu, (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase("vi"));
}

export type TallMetrics = {
  w: number;
  h: number;
  nameTop: number;
  nameLines: number;
  slack: number;
  imgX: number;
  imgY: number;
  textX: number;
  showAvatar: boolean;
};

/** Số dòng tên = số tiếng của tên dài nhất (2–6), để mọi thẻ cao bằng nhau. */
export function tallMetrics(
  names: string[],
  opts: { showAvatar: boolean; extraLine?: boolean },
): TallMetrics {
  const w = 108;
  const nameLines = Math.min(
    6,
    Math.max(2, ...names.map((n) => n.trim().split(/\s+/).length)),
  );
  const nameTop = opts.showAvatar ? 72 : 26;
  const content =
    nameTop + 24 + (nameLines - 1) * TALL_NAME_LINE + 30 + (opts.extraLine ? 20 : 0) + 8;
  // Hình chữ nhật đứng cân đối: cao ≥ 1,55 × rộng.
  const h = Math.max(content, Math.round(w * 1.55));
  return {
    w,
    h,
    nameTop,
    nameLines,
    slack: h - content,
    imgX: (w - 50) / 2,
    imgY: 8,
    textX: w / 2,
    showAvatar: opts.showAvatar,
  };
}

/**
 * Bố cục chữ trong thẻ dọc: mỗi tiếng tên một dòng (căn giữa, đậm, 17px), năm
 * nằm đáy thẻ. `tspans` là [tên, năm, (giỗ/thọ)] do family-chart dựng.
 */
export function layoutTallText(
  tspans: SVGTSpanElement[],
  fullName: string,
  m: TallMetrics,
): void {
  const nameTspan = tspans[0];
  if (!nameTspan) return;
  nameTspan.parentNode?.querySelectorAll(".name-extra").forEach((n) => n.remove());
  const words = titleCaseName(fullName).split(" ");
  const lines = [
    ...words.slice(0, m.nameLines - 1),
    words.slice(m.nameLines - 1).join(" "),
  ].filter(Boolean);
  const diff = (m.nameLines - lines.length) * TALL_NAME_LINE;
  nameTspan.textContent = lines[0] ?? "";
  nameTspan.setAttribute("dy", String(24 + m.slack / 2 + diff / 2));
  nameTspan.setAttribute("text-anchor", "middle");
  nameTspan.style.fontSize = "17px";
  nameTspan.style.fontWeight = "700";
  let anchor: Element = nameTspan;
  for (const ln of lines.slice(1)) {
    const t = nameTspan.cloneNode(false) as SVGTSpanElement;
    t.setAttribute("class", "name-extra");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("x", "0");
    t.setAttribute("dy", String(TALL_NAME_LINE));
    t.textContent = ln;
    // CSS chỉ định dòng thứ 2 là dòng năm (nhỏ, mờ): trả lại kiểu tên.
    t.style.fontSize = "17px";
    t.style.opacity = "1";
    t.style.fontWeight = "700";
    anchor.after(t);
    anchor = t;
  }
  const meta = tspans[1];
  if (meta) {
    meta.textContent = (meta.textContent ?? "").trim();
    meta.setAttribute("text-anchor", "middle");
    meta.setAttribute("x", "0");
    meta.setAttribute("dy", String(28 + m.slack / 2 + diff / 2));
    meta.style.fontSize = "13px";
    meta.style.opacity = "0.7";
    meta.style.fontWeight = "400";
  }
  const extra = tspans[2];
  if (extra) {
    extra.textContent = (extra.textContent ?? "").trim();
    extra.setAttribute("text-anchor", "middle");
    extra.setAttribute("x", "0");
    extra.setAttribute("dy", "20");
    extra.setAttribute("font-size", "10");
    extra.setAttribute("fill", "#8A7A66");
  }
}
