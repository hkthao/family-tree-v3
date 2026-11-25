import { t } from "@lingui/core/macro";

import { IconAward } from "@/components/icons";
import { HONOR_CATEGORY_LABEL } from "@/lib/queries/honor";
import { fetchSiteHonor } from "@/lib/queries/site-parts";

import { formatPostDate } from "./postUi";
import { FilterChips, ListState, SitePageHead, SitePager } from "./SiteListParts";
import { useSiteList } from "./useSiteList";

const CATEGORIES = ["donation_money", "donation_labor", "academic", "other"] as const;
const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)} đ`;

/** Bảng vàng công đức: người được vinh danh, loại, ngày, số tiền (nếu có). */
export default function SiteHonor() {
  const list = useSiteList("honor", { per: 12, filterParam: "category", allowed: CATEGORIES, fetcher: fetchSiteHonor });
  const { data, isLoading, error } = list.query;
  return (
    <div className="container max-w-6xl py-8 md:py-10">
      <SitePageHead title={t`Bảng vàng công đức`} intro={t`Tri ân những người đã góp công, góp của và làm rạng danh dòng họ.`} />
      <FilterChips
        label={t`Lọc theo loại`}
        value={list.filter}
        onChange={list.setFilter}
        options={[{ value: "", label: t`Tất cả` }, ...CATEGORIES.map((c) => ({ value: c, label: HONOR_CATEGORY_LABEL[c] }))]}
      />
      <ListState loading={isLoading} error={error as Error | null} empty={!data?.items.length} emptyText={t`Chưa có ai được vinh danh.`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data?.items.map((h) => (
            <article key={h.id} className="flex min-w-0 items-start gap-4 rounded-2xl border border-accent/50 bg-card px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <IconAward className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="clan-name line-clamp-2 break-words text-lg font-semibold leading-snug">{h.honoree_name}</h3>
                {h.note && <p className="line-clamp-2 break-words text-sm text-muted-foreground">{h.note}</p>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {[HONOR_CATEGORY_LABEL[h.category as keyof typeof HONOR_CATEGORY_LABEL] ?? h.category, h.occurred_on ? formatPostDate(h.occurred_on) : null].filter(Boolean).join(" · ")}
                </div>
              </div>
              {h.amount ? <span className="shrink-0 font-semibold tabular-nums text-primary">{vnd(h.amount)}</span> : null}
            </article>
          ))}
        </div>
        <SitePager page={list.page} pages={list.pages} onPage={list.setPage} />
      </ListState>
    </div>
  );
}
