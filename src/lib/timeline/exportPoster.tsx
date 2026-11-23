import { createElement } from "react";

import { downloadBlob } from "@/lib/cards/exportCard";

/**
 * Xuất poster dòng thời gian ra ảnh PNG hoặc file PDF. Chụp đúng phần tử poster ĐANG HIỂN THỊ (cùng mẫu nền, kiểu xem,
 * mã QR…), kể cả phần cuộn ngang bị che: tạm mở rộng khung để chụp trọn rồi trả lại như cũ. PDF là MỘT trang có
 * kích thước đúng bằng poster (ảnh nét, không cắt), tiện in khổ lớn hoặc gửi qua Zalo.
 *
 * Ảnh từ nguồn ngoài (Wikimedia Commons, kho ảnh) phải cho phép CORS mới nhúng được; ảnh nào lỗi thì để trống chứ
 * không làm hỏng cả poster.
 */
const PIXEL_RATIO = 2;
/** 1 px CSS = 0.75 pt. */
const PT = 0.75;
/** Giới hạn cạnh trang PDF (đặc tả PDF 1.x: 14400 pt). */
const MAX_PT = 14400;
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Chụp phần tử poster thành PNG (data URL) với đủ chiều rộng, kể cả vùng đang cuộn ngang. */
async function capture(root: HTMLElement): Promise<{ dataUrl: string; w: number; h: number }> {
  const { toPng } = await import("html-to-image");
  const scrollers = [...root.querySelectorAll<HTMLElement>(".overflow-x-auto")];
  const saved = scrollers.map((el) => el.style.overflow);
  const prevWidth = root.style.width;
  try {
    const full = Math.max(root.offsetWidth, ...scrollers.map((el) => el.scrollWidth));
    root.style.width = `${full}px`;
    for (const el of scrollers) el.style.overflow = "visible";
    const w = root.offsetWidth;
    const h = root.offsetHeight;
    const dataUrl = await toPng(root, {
      pixelRatio: PIXEL_RATIO,
      cacheBust: true,
      width: w,
      height: h,
      imagePlaceholder: BLANK,
    });
    return { dataUrl, w, h };
  } finally {
    root.style.width = prevWidth;
    scrollers.forEach((el, i) => (el.style.overflow = saved[i]));
  }
}

export async function exportPosterPng(root: HTMLElement, filename: string): Promise<void> {
  const { dataUrl } = await capture(root);
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(blob, filename);
}

export async function exportPosterPdf(root: HTMLElement, filename: string): Promise<void> {
  const { dataUrl, w, h } = await capture(root);
  // Nạp react-pdf khi cần (bundle nặng) — như xuất sổ gia phả.
  const { pdf, Document, Page, Image } = await import("@react-pdf/renderer");
  let pw = w * PT;
  let ph = h * PT;
  const over = Math.max(pw, ph) / MAX_PT;
  if (over > 1) {
    pw /= over;
    ph /= over;
  }
  const doc = createElement(
    Document,
    { title: filename.replace(/\.pdf$/i, "") },
    createElement(
      Page,
      { size: [pw, ph], style: { padding: 0 } },
      createElement(Image, { src: dataUrl, style: { width: pw, height: ph } }),
    ),
  );
  const blob = await pdf(doc as never).toBlob();
  downloadBlob(blob, filename);
}

/** Tên file gọn, không dấu: "dong-thoi-gian-ho-ho". */
export function posterFilename(clanName: string, ext: "pdf" | "png"): string {
  const slug = clanName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `dong-thoi-gian${slug ? `-${slug}` : ""}.${ext}`;
}
