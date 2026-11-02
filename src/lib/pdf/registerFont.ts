import { Font } from "@react-pdf/renderer";

import { readNameFontId } from "@/lib/tree/nameFonts";

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

/** Họ font tiêu đề theo lựa chọn "Font" đang lưu của người dùng (mặc định Playfair). */
export function pdfSerifFamily(): string {
  const id = readNameFontId();
  return `NameFont_${id in pdfAssets.nameFonts ? id : "playfair"}`;
}

/** Style fontFamily cho tiêu đề — gọi lúc dựng để theo lựa chọn hiện tại. */
export function serifStyle(): { fontFamily: string } {
  return { fontFamily: pdfSerifFamily() };
}
