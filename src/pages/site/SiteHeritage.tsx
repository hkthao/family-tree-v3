import { t } from "@lingui/core/macro";
import { Link } from "react-router-dom";

import { HERITAGE_CATEGORY_LABEL } from "@/lib/queries/heritage";
import { fetchSiteHeritage } from "@/lib/queries/site-parts";
import { sitePagePath } from "@/lib/siteSections";
import { cn } from "@/lib/utils";

import { coverFallbackClass } from "./postUi";
import { FilterChips, ListState, SitePageHead, SitePager } from "./SiteListParts";
import { useSite } from "./siteContext";
import { useSiteList } from "./useSiteList";

const CATEGORIES = ["place", "custom", "story", "artifact"] as const;

/** Di sản dòng họ: lọc theo loại, phân trang, thẻ trỏ tới trang chi tiết. */
export default function SiteHeritage() {
  const { base } = useSite();
  const list = useSiteList("heritage", { per: 12, filterParam: "category", allowed: CATEGORIES, fetcher: fetchSiteHeritage });
  const { data, isLoading, error } = list.query;
  return (
    <div className="container max-w-6xl py-8 md:py-10">
      <SitePageHead title={t`Di sản dòng họ`} intro={t`Từ đường, tục lệ, giai thoại và kỷ vật được lưu giữ qua các đời.`} />
      <FilterChips
        label={t`Lọc di sản`}
        value={list.filter}
        onChange={list.setFilter}
        options={[{ value: "", label: t`Tất cả` }, ...CATEGORIES.map((c) => ({ value: c, label: HERITAGE_CATEGORY_LABEL[c] }))]}
      />
      <ListState loading={isLoading} error={error as Error | null} empty={!data?.items.length} emptyText={t`Chưa có mục di sản nào.`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((h) => (
            <Link key={h.id} to={sitePagePath(base, "heritage", h.id)} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary">
              {h.photo_url ? (
                <img src={h.photo_url} alt="" loading="lazy" className="h-40 w-full object-cover" />
              ) : (
                <div aria-hidden="true" className={cn("h-40 w-full bg-gradient-to-br", coverFallbackClass(h.id))} />
              )}
              <div className="flex flex-1 flex-col gap-1.5 p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {HERITAGE_CATEGORY_LABEL[h.category as keyof typeof HERITAGE_CATEGORY_LABEL] ?? h.category}
                </span>
                <h3 className="clan-name line-clamp-2 min-h-[2.7em] break-words text-lg font-semibold leading-snug">{h.title}</h3>
                {h.summary && <p className="line-clamp-3 break-words text-sm text-muted-foreground">{h.summary}</p>}
              </div>
            </Link>
          ))}
        </div>
        <SitePager page={list.page} pages={list.pages} onPage={list.setPage} />
      </ListState>
    </div>
  );
}
