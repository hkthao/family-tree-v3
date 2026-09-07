import { pdf } from "@react-pdf/renderer";

import { ClanPosterPdf } from "@/lib/pdf/ClanPosterPdf";
import { ensurePdfFontRegistered } from "@/lib/pdf/registerFont";
import type { PosterDoc, PosterConfig } from "@/lib/poster/buildPoster";

/** Bỏ dấu + ký tự lạ để tên file tải về chạy được trên mọi máy. */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_");
}

/**
 * Kết xuất bảng gia phả thành PDF một trang khổ lớn rồi tải về.
 *
 * Nhận sẵn `doc` đã dựng thay vì tự dựng lại: đúng cái tấm người dùng
 * đang xem trước là cái được in, không phải một bản tính lại có thể
 * khác.
 */
export async function downloadClanPosterPdf(
  clanName: string,
  doc: PosterDoc,
  cfg: PosterConfig,
): Promise<{ filename: string; bytes: number }> {
  ensurePdfFontRegistered();

  const blob = await pdf(
    <ClanPosterPdf
      doc={doc}
      size={cfg.size}
      title={`Bảng gia phả ${clanName}`}
    />,
  ).toBlob();

  const today = new Date().toISOString().slice(0, 10);
  const filename = `bang-gia-pha_${slug(clanName)}_${cfg.size}_${today}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, bytes: blob.size };
}
