import type { ReactNode } from "react";

import { IconDownload, IconPlus } from "@/components/icons";
import type { DrawerSection } from "@/lib/navModel";

import { t } from "@lingui/core/macro";

/**
 * Danh mục MỌI ô có thể ghim ra "Thao tác nhanh" ở trang chủ. Nguồn là chính menu (buildSections) nên mục nào
 * hiện ở menu/hub thì ghim được, mục nào người dùng không có quyền hay tính năng đã tắt thì không có trong danh
 * sách — không ghim nhầm thứ không mở được. Thêm hai ô hành động không phải trang: "Thêm người" và "Xuất PDF".
 *
 * Khoá ô = đường dẫn con của dòng họ (`tree`, `todo`, `memory-room`…) — bền qua các lần đổi nhãn/dịch.
 */
export interface QuickEntry {
  key: string;
  /** Nhãn đầy đủ (dùng trong danh sách tuỳ chỉnh). */
  label: string;
  /** Nhãn NGẮN cho ô trên trang chủ (một dòng, không bị cắt). */
  short: string;
  icon: ReactNode;
  to?: string;
  badge?: string | number;
  /** Ô thuộc nhóm lõi: luôn đứng đầu khi người dùng chưa ghim. */
  core?: boolean;
  /** Ô hành động đặc biệt không phải liên kết. */
  special?: "pdf";
}

/** Nhóm lõi (Tổng quan là chính trang chủ nên không có ô). */
export const CORE_QUICK_KEYS = ["tree", "people", "relations", "events"] as const;

/**
 * Thứ tự ưu tiên MẶC ĐỊNH của phần không phải lõi: mức dùng thật (Umami) + giá trị hành động. Mục nằm ngoài danh
 * sách này vẫn có trong danh mục, xếp sau theo thứ tự menu.
 */
const DEFAULT_ORDER = [
  "people/new",
  "todo",
  "graves",
  "board",
  "memory-room",
  "heritage",
  "settings",
  "xem-ngay",
  "import",
  "pdf",
  "fund",
  "inlaws",
  "honor",
] as const;

function shortLabel(key: string, label: string): string {
  switch (key) {
    case "todo":
      return t`Việc làm`;
    case "graves":
      return t`Mộ phần`;
    case "heritage":
      return t`Di sản`;
    case "honor":
      return t`Bảng vàng`;
    case "inlaws":
      return t`Liên kết họ`;
    case "xem-ngay":
      return t`Xem ngày tốt`;
    default:
      return label;
  }
}

export function buildQuickCatalog(
  sections: DrawerSection[],
  opts: { clanId: string; canEdit: boolean; isMember: boolean },
): QuickEntry[] {
  const base = `/clans/${opts.clanId}/`;
  const seen = new Set<string>();
  const entries: QuickEntry[] = [];

  for (const sec of sections) {
    // Chỉ các nhóm của DÒNG HỌ này; nhóm Chung / Quản trị hệ thống không ghim ra trang chủ của dòng họ.
    if (!sec.id.startsWith("clan-")) continue;
    for (const it of sec.items) {
      const path = it.to.split("?")[0];
      if (!path.startsWith(base)) continue;
      const key = path.slice(base.length);
      if (!key || seen.has(key)) continue; // bỏ Tổng quan (đường dẫn gốc)
      seen.add(key);
      entries.push({
        key,
        label: it.label,
        short: shortLabel(key, it.label),
        icon: it.icon,
        to: path,
        badge: it.badge,
        core: (CORE_QUICK_KEYS as readonly string[]).includes(key),
      });
    }
  }

  if (opts.canEdit) {
    entries.push({
      key: "people/new",
      label: t`Thêm người`,
      short: t`Thêm người`,
      icon: <IconPlus className="h-5 w-5" />,
      to: `${base}people/new`,
    });
  }
  if (opts.isMember) {
    entries.push({
      key: "pdf",
      label: t`Xuất PDF`,
      short: t`Xuất PDF`,
      icon: <IconDownload className="h-5 w-5" />,
      special: "pdf",
    });
  }

  // Lõi theo thứ tự khai báo; phần còn lại theo DEFAULT_ORDER rồi tới thứ tự menu.
  const rank = (e: QuickEntry) => {
    if (e.core) return -1000 + CORE_QUICK_KEYS.indexOf(e.key as (typeof CORE_QUICK_KEYS)[number]);
    const i = (DEFAULT_ORDER as readonly string[]).indexOf(e.key);
    return i === -1 ? 1000 : i;
  };
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
    .map(({ e }) => e);
}
