import { pdf } from "@react-pdf/renderer";

import { FundReportPdf } from "@/lib/pdf/FundReportPdf";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { listFundTransactions, summarizeFund } from "@/lib/queries/clanFund";

/**
 * Lấy dữ liệu Quỹ họ, render báo cáo PDF (@react-pdf) thành Blob. Tách khỏi
 * bước tải về để Zalo Mini App (không tải kiểu trình duyệt được) dùng lại.
 */
export async function buildFundReportPdf(
  clan: ClanDetail,
): Promise<{ blob: Blob; filename: string }> {
  const txs = await listFundTransactions(clan.id);
  const summary = summarizeFund(txs);

  const blob = await pdf(
    <FundReportPdf
      clan={clan}
      txs={txs}
      summary={summary}
      generatedAt={new Date()}
    />,
  ).toBlob();

  const safe = clan.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `quy-ho_${safe}_${today}.pdf`;
  return { blob, filename };
}

/**
 * Dựng báo cáo Quỹ họ rồi tải về. Trả filename để caller hiện trong toast.
 * Style đồng nhất với Sổ gia phả.
 */
export async function downloadFundReportPdf(
  clan: ClanDetail,
): Promise<{ filename: string; bytes: number }> {
  const { blob, filename } = await buildFundReportPdf(clan);
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
