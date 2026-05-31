import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Register Be Vietnam Pro for PDF rendering once. Built-in PDF fonts
 * (Helvetica, Times) don't carry Vietnamese diacritics, so we ship the
 * Vietnamese subset of Be Vietnam Pro from /public/fonts/ and reuse the
 * same UI font family for consistency between screen and print.
 */
export function ensurePdfFontRegistered(): void {
  if (registered) return;
  Font.register({
    family: "BeVietnamPro",
    fonts: [
      { src: "/fonts/be-vietnam-pro-400.woff", fontWeight: 400 },
      { src: "/fonts/be-vietnam-pro-600.woff", fontWeight: 600 },
    ],
  });
  // Disable hyphenation — Vietnamese words shouldn't break mid-word.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const PDF_FONT_FAMILY = "BeVietnamPro";
