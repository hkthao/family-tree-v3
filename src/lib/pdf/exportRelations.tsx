import { pdf } from "@react-pdf/renderer";

import { RelationsPdf } from "@/lib/pdf/RelationsPdf";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { RelationsReport } from "@/lib/relations";

const slug = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Dựng PDF "Tra cứu quan hệ" thành Blob (tách khỏi bước tải về để nơi khác dùng lại). */
export async function buildRelationsPdf(
  clan: ClanDetail,
  report: RelationsReport,
): Promise<{ blob: Blob; filename: string }> {
  const blob = await pdf(
    <RelationsPdf
      clan={clan}
      report={report}
      genOffset={clan.generation_offset ?? 0}
      generatedAt={new Date()}
    />,
  ).toBlob();
  const today = new Date().toISOString().slice(0, 10);
  return {
    blob,
    filename: `quan-he_${slug(report.focal.full_name)}_${today}.pdf`,
  };
}

/** Dựng rồi tải về. Trả tên file để hiện trong thông báo. */
export async function downloadRelationsPdf(
  clan: ClanDetail,
  report: RelationsReport,
): Promise<{ filename: string; bytes: number }> {
  const { blob, filename } = await buildRelationsPdf(clan, report);
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
