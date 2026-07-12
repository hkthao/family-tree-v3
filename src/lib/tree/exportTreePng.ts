import { downloadBlob, imageUrlToDataUrl } from "@/lib/cards/exportCard";

/**
 * Xuất ảnh PNG cây gia phả family-chart ĐANG HIỂN THỊ trong `containerEl`
 * (khung `.f3`, giữ nguyên người trung tâm + mức zoom hiện tại).
 *
 * html-to-image bỏ mất `<text>` của card, nên đây serialize SVG thủ công:
 * clone → NỘI TUYẾN computed style (giải var CSS + font) → NHÚNG ảnh avatar
 * thành data-URI (SVG trong <img> không tải được URL ngoài) → ẩn nút +/sửa →
 * để trình duyệt rasterize qua canvas (render text chuẩn). Tải file `filename`.
 */
const XLINK = "http://www.w3.org/1999/xlink";
const SVGNS = "http://www.w3.org/2000/svg";

/** Nền theo giao diện sáng/tối (khớp canvas PNG + nền trang). */
function bgColor(): string {
  return document.documentElement.classList.contains("dark")
    ? "#1A1612"
    : "#FBF7F0";
}

/**
 * Dựng bản SVG "xuất được" từ cây family-chart đang hiển thị: clone svg đang
 * xem → nội tuyến computed style (giải var CSS + font) → nhúng avatar thành
 * data-URI → ẩn nút +/sửa. Dùng chung cho cả xuất PNG lẫn SVG.
 */
async function buildExportSvg(
  containerEl: HTMLElement,
): Promise<{ clone: SVGSVGElement; W: number; H: number }> {
  const svg = containerEl.querySelector(
    "svg.main_svg",
  ) as SVGSVGElement | null;
  if (!svg) throw new Error("Không tìm thấy cây để xuất.");

  const rect = containerEl.getBoundingClientRect();
  const W = Math.max(1, Math.round(rect.width));
  const H = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(W));
  clone.setAttribute("height", String(H));
  clone.setAttribute("viewBox", `0 0 ${W} ${H}`);
  clone.setAttribute("xmlns", SVGNS);
  clone.setAttribute("xmlns:xlink", XLINK);

  // Nội tuyến computed style (live → clone, cùng thứ tự phần tử).
  const PROPS = [
    "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray",
    "stroke-linecap", "stroke-opacity", "opacity", "font-family", "font-size",
    "font-weight", "font-style", "text-anchor", "dominant-baseline",
    "letter-spacing", "color",
  ];
  const liveEls = svg.querySelectorAll<SVGElement>("*");
  const cloneEls = clone.querySelectorAll<SVGElement>("*");
  for (let i = 0; i < liveEls.length; i++) {
    const cs = getComputedStyle(liveEls[i]);
    const s = cloneEls[i].style;
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) s.setProperty(p, v);
    }
  }

  // Ẩn nút +/bút chì cho ảnh gọn.
  clone
    .querySelectorAll(".card_add,.card_edit,[class*='card-action']")
    .forEach((n) => n.remove());

  // Nhúng ảnh avatar/chân dung thành data-URI.
  await Promise.all(
    Array.from(clone.querySelectorAll("image")).map(async (img) => {
      const href =
        img.getAttribute("href") || img.getAttributeNS(XLINK, "href");
      if (!href || href.startsWith("data:")) return;
      const dataUrl = await imageUrlToDataUrl(
        href.startsWith("http") ? href : window.location.origin + href,
      );
      if (dataUrl) {
        img.setAttribute("href", dataUrl);
        img.setAttributeNS(XLINK, "href", dataUrl);
      }
    }),
  );

  return { clone, W, H };
}

/**
 * Xuất ảnh PNG cây gia phả family-chart ĐANG HIỂN THỊ trong `containerEl`
 * (khung `.f3`, giữ nguyên người trung tâm + mức zoom hiện tại).
 *
 * html-to-image bỏ mất `<text>` của card, nên serialize SVG thủ công (xem
 * buildExportSvg) rồi để trình duyệt rasterize qua canvas (render text chuẩn).
 */
export async function exportFamilyChartPng(
  containerEl: HTMLElement,
  filename: string,
): Promise<void> {
  const { clone, W, H } = await buildExportSvg(containerEl);
  const dark = document.documentElement.classList.contains("dark");
  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("SVG load failed"));
    image.src = svgUrl;
  });

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");
  ctx.fillStyle = dark ? "#1A1612" : "#FBF7F0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, W, H);
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/png"),
  );
  if (!blob) throw new Error("Không tạo được ảnh.");
  downloadBlob(blob, filename);
}

/**
 * Xuất VECTOR SVG cây gia phả ĐANG HIỂN THỊ — nét căng ở mọi mức phóng to,
 * mở/chỉnh sửa bằng trình đọc SVG hay phần mềm vẽ. Chèn thêm nền theo giao
 * diện sáng/tối để file mở độc lập không bị trong suốt.
 */
export async function exportFamilyChartSvg(
  containerEl: HTMLElement,
  filename: string,
): Promise<void> {
  const { clone, W, H } = await buildExportSvg(containerEl);

  const bg = document.createElementNS(SVGNS, "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(W));
  bg.setAttribute("height", String(H));
  bg.setAttribute("fill", bgColor());
  clone.insertBefore(bg, clone.firstChild);

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(clone);
  downloadBlob(
    new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
    filename,
  );
}

/** Slug hoá tên file (bỏ dấu tiếng Việt, thay ký tự lạ bằng "-"). */
export function fileSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
