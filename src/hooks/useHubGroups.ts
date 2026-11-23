import type { ReactNode } from "react";

import { useNavSections } from "@/hooks/useNavSections";
import { unaccent } from "@/lib/unaccent";

/** Một ô/dòng của hub: liên kết (`to`) hoặc hành động (`onClick`). */
export interface HubTile {
  key: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  badge?: string | number;
  isNew?: boolean;
  to?: string;
  onClick?: () => void;
}

export interface HubGroup {
  id: string;
  label: string;
  hint?: string;
  tiles: HubTile[];
}

/** Lọc nhóm theo từ khoá (gõ không dấu cũng được); nhóm hết mục thì bỏ. */
export function filterHubGroups(groups: HubGroup[], q: string): HubGroup[] {
  const needle = unaccent(q.trim());
  if (!needle) return groups;
  return groups
    .map((g) => ({
      ...g,
      tiles: g.tiles.filter((x) => unaccent(x.label).includes(needle)),
    }))
    .filter((g) => g.tiles.length > 0);
}

/**
 * Các nhóm tính năng của hub "Tất cả tính năng" (lõi dòng họ → cộng đồng & di sản → công cụ & quản trị
 * → chung). MỘT nguồn cho trang hub và ngăn kéo "Tính năng" mở từ thanh đầu trang — hai nơi không lệch
 * nhau về mục nào hiện, badge, quyền. Nhóm Hệ thống (tìm kiếm, ngôn ngữ, sáng/tối) do từng nơi tự thêm.
 */
export function useHubGroups(): HubGroup[] {
  const { sections } = useNavSections();
  return ["clan-core", "clan-community", "clan-work", "global"]
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({
      id: s.id,
      label: s.label,
      hint: s.hint,
      tiles: s.items.map((i) => ({
        key: i.to,
        label: i.label,
        hint: i.hint,
        icon: i.icon,
        badge: i.badge,
        isNew: i.isNew,
        to: i.to,
      })),
    }))
    .filter((g) => g.tiles.length > 0);
}
