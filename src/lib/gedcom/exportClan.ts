import { getClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { getClanInlawExports } from "@/lib/queries/person-links";

import { serializeClanToGedcom } from "./serialize";

/**
 * Fetch the clan + every person/family/branch, serialize to GEDCOM
 * 5.5.1, and trigger a browser download. Cross-clan in-law links
 * are embedded as `_INLAW` custom blocks per INDI (one-way export
 * preservation — see serialize.ts).
 */
export async function downloadClanGedcom(
  clan: ClanDetail,
): Promise<{ filename: string; bytes: number }> {
  const [data, inlaws] = await Promise.all([
    getClanBookData(clan.id),
    getClanInlawExports(clan.id).catch(() => []),
  ]);
  const ged = serializeClanToGedcom(clan, data, inlaws);

  const safe = clan.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `gia-pha_${safe}_${today}.ged`;

  const blob = new Blob([ged], { type: "application/x-gedcom;charset=utf-8" });
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
