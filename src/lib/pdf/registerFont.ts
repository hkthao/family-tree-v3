import { Font } from "@react-pdf/renderer";

import { pdfAssets } from "./pdfAssets";

let registered = false;

/**
 * Register Be Vietnam Pro for PDF rendering once. Built-in PDF fonts
 * (Helvetica, Times) don't carry Vietnamese diacritics, so we ship a
 * complete TTF (from the google/fonts repo) under /public/fonts/.
 */
export function ensurePdfFontRegistered(): void {
  if (registered) return;
  Font.register({
    family: "BeVietnamPro",
    fonts: [
      { src: pdfAssets.font400, fontWeight: 400 },
      { src: pdfAssets.font600, fontWeight: 600 },
    ],
  });
  // Font tiêu đề theo lựa chọn của cây (đều có đủ dấu tiếng Việt).
  for (const [id, [w600, w700]] of Object.entries(pdfAssets.nameFonts)) {
    Font.register({
      family: `NameFont_${id}`,
      fonts: [
        { src: w600, fontWeight: 400 },
        { src: w600, fontWeight: 600 },
        { src: w700, fontWeight: 700 },
      ],
    });
  }
  // Disable hyphenation — Vietnamese words shouldn't break mid-word.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const PDF_FONT_FAMILY = "BeVietnamPro";

/**
 * Họ font DUY NHẤT của sổ PDF: Be Vietnam Pro (font mặc định của app, đủ dấu
 * tiếng Việt). Các font serif/thư pháp bị lỗi dấu trong PDF nên không dùng.
 */
export function pdfSerifFamily(): string {
  return PDF_FONT_FAMILY;
}

/** Style fontFamily cho tiêu đề — gọi lúc dựng để theo lựa chọn hiện tại. */
export function serifStyle(): { fontFamily: string } {
  return { fontFamily: pdfSerifFamily() };
}
