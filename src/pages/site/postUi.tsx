import { t } from "@lingui/core/macro";

import type { SitePostType } from "@/lib/queries/site-parts";

export function postTypeLabel(type: SitePostType | string): string {
  switch (type) {
    case "news":
      return t`Tin chung`;
    case "event":
      return t`Sự kiện`;
    case "birth":
      return t`Tin vui`;
    case "death":
      return t`Tin buồn`;
    case "notice":
      return t`Thông báo`;
    default:
      return type;
  }
}

export const POST_TYPES: SitePostType[] = ["news", "event", "birth", "death", "notice"];

export const formatPostDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

/** Màu nền dự phòng khi bài không có ảnh bìa (xoay theo id để các thẻ không giống hệt nhau). */
export function coverFallbackClass(id: string): string {
  const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  return ["from-primary/80 to-primary/30", "from-accent/70 to-accent/25", "from-primary/60 to-accent/40", "from-muted-foreground/50 to-muted"][n];
}
