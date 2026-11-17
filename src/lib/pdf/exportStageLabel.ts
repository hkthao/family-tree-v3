import { t } from "@lingui/core/macro";

import type { ExportClanBookOptions } from "@/lib/pdf/exportClanBook";

type Stage = Parameters<NonNullable<ExportClanBookOptions["onProgress"]>>[0];

/** Chữ hiện trên nút khi đang xuất sổ, theo bước hiện tại. */
export function exportStageLabel(stage: Stage | null): string {
  switch (stage) {
    case "queued":
      return t`Đang chờ tới lượt…`;
    case "layout1":
    case "layout2":
      return t`Đang dàn trang…`;
    default:
      return t`Đang xuất…`;
  }
}
