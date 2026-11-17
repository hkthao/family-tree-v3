/** Tên file gợi ý của sổ: gia-pha_<tên không dấu>_<ngày>.pdf — dùng chung cho dựng tại máy và dựng ở máy chủ. */
export function bookFilename(clanName: string): string {
  const safe = clanName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  return `gia-pha_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`;
}
