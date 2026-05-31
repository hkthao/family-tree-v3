import { pdf } from "@react-pdf/renderer";

import { ClanBookPdf } from "@/lib/pdf/ClanBookPdf";
import { getClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";

export interface ExportClanBookOptions {
  tree?: boolean;
  detail?: boolean;
}

/**
 * Fetch clan data, render the React-PDF document to a Blob, and trigger
 * a browser download. Returns the suggested filename so callers can
 * surface it in toasts.
 */
export async function downloadClanBookPdf(
  clan: ClanDetail,
  options: ExportClanBookOptions = {},
): Promise<{ filename: string; bytes: number }> {
  const data = await getClanBookData(clan.id);
  const blob = await pdf(
    <ClanBookPdf clan={clan} data={data} include={options} />,
  ).toBlob();

  const safe = clan.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `gia-pha_${safe}_${today}.pdf`;

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
