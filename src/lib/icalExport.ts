/**
 * Xuất lịch .ics từ trình duyệt (tải file). Phần dựng nội dung nằm ở
 * `icalBuild.ts` — thuần, không đụng DOM — để Edge Function `calendar-feed`
 * dùng chung qua bản sao trong `_shared/vendor/`.
 */

import { buildClanIcs, type BuildIcsOptions } from "@/lib/icalBuild";

export * from "@/lib/icalBuild";

/** Build the .ics + trigger a browser download. */
export function downloadClanIcs(opts: BuildIcsOptions): {
  filename: string;
  bytes: number;
} {
  const ics = buildClanIcs(opts);
  const safe = opts.clanName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `gia-pha_${safe}.ics`;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
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
