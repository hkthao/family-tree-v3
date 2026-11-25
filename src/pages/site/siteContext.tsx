import { createContext, useContext } from "react";

import type { ShareViewPayload } from "@/lib/queries/share-view";
import type { SiteAccess } from "@/lib/queries/site-parts";
import type { SitePageKey } from "@/lib/siteSections";

/** Ngữ cảnh dùng chung của trang dòng họ (khung + các trang con). */
export interface SiteCtx {
  /** Gốc đường dẫn: `/share/:token` hoặc `/xem/clans/:id`. */
  base: string;
  access: SiteAccess;
  /** Payload gốc (cây + thống kê); các phần khác tải riêng bằng `part=`. */
  data: ShareViewPayload;
  /** Khoá clans.share_sections đang bật. */
  sections: string[];
  canContribute: boolean;
  /** Link tập trung (QR người / mộ / di sản): chỉ một mục menu, không tìm kiếm, không chuyển sang phần khác. */
  focus?: SitePageKey;
}

const Ctx = createContext<SiteCtx | null>(null);
export const SiteProvider = Ctx.Provider;

export function useSite(): SiteCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite phải nằm trong ClanSiteRoot");
  return v;
}
