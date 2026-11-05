import { Document, Image, Page, pdf } from "@react-pdf/renderer";

import { downloadBlob } from "@/lib/cards/exportCard";
import { fileSlug } from "@/lib/tree/exportTreePng";

const MM_TO_PT = 72 / 25.4;
const MM_TO_PX = 96 / 25.4;
/** Trần số điểm ảnh của canvas (iOS Safari ~16M; desktop chịu hơn nhưng tốn RAM). */
const MAX_PIXELS = 16_000_000;

/**
 * Chụp ảnh canvas `Konva.Stage` thành một trang PDF khổ tuỳ ý (mm).
 *
 * `render(pageWpx, pageHpx, pixelRatio)` do trang canvas cung cấp: co giãn
 * stage cho vừa trang, chụp, rồi trả stage về như cũ. Ở đây chỉ lo phần PDF:
 * quy đổi mm → pt, chọn độ phân giải, nhúng ảnh nền-đặc vào một trang.
 */
export async function exportCanvasPdf(opts: {
  pageMm: { w: number; h: number };
  filename: string;
  render: (wPx: number, hPx: number, pixelRatio: number) => string;
}): Promise<{ filename: string; bytes: number }> {
  const wPx = Math.round(opts.pageMm.w * MM_TO_PX);
  const hPx = Math.round(opts.pageMm.h * MM_TO_PX);
  const ratio = Math.min(3, Math.max(0.5, Math.sqrt(MAX_PIXELS / (wPx * hPx))));
  const dataUrl = opts.render(wPx, hPx, ratio);

  const blob = await pdf(
    <Document title={opts.filename}>
      <Page
        size={[opts.pageMm.w * MM_TO_PT, opts.pageMm.h * MM_TO_PT]}
        style={{ padding: 0 }}
      >
        <Image
          src={dataUrl}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
      </Page>
    </Document>,
  ).toBlob();

  downloadBlob(blob, opts.filename);
  return { filename: opts.filename, bytes: blob.size };
}

export function canvasPdfFilename(clanName: string, canvasName: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${fileSlug(clanName)}_${fileSlug(canvasName)}_${today}.pdf`;
}
