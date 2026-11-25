import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import type { SiteAccess, SitePage } from "@/lib/queries/site-parts";

import { useSite } from "./siteContext";

/**
 * Danh sách phân trang có một bộ lọc, trạng thái nằm trên URL (?page=, ?<filter>=) để Back / chia sẻ link giữ nguyên.
 * `allowed`: giá trị lọc hợp lệ (giá trị lạ bị bỏ, không gửi lên máy chủ).
 */
export function useSiteList<T>(
  part: string,
  opts: {
    per: number;
    filterParam: string;
    allowed: readonly string[];
    fetcher: (a: SiteAccess, p: { page: number; per: number; [k: string]: string | number | undefined }) => Promise<SitePage<T>>;
  },
) {
  const { access } = useSite();
  const [sp, setSp] = useSearchParams();
  const filter = opts.allowed.find((x) => x === sp.get(opts.filterParam)) ?? "";
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const query = useQuery({
    queryKey: ["site", access.token ?? access.clanId, part, filter, page, opts.per],
    queryFn: () => opts.fetcher(access, { page, per: opts.per, [opts.filterParam]: filter || undefined }),
    retry: false,
  });
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setSp(next, { replace: true });
  };
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.per)) : 1;
  return {
    query,
    filter,
    page,
    pages,
    setFilter: (v: string) => setParam({ [opts.filterParam]: v || null, page: null }),
    setPage: (p: number) => setParam({ page: p > 1 ? String(p) : null }),
  };
}
