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
  // Disable hyphenation — Vietnamese words shouldn't break mid-word.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const PDF_FONT_FAMILY = "BeVietnamPro";
