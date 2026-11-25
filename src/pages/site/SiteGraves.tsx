import { t } from "@lingui/core/macro";

import { IconGrave, IconMapPin } from "@/components/icons";
import { RESTING_PLACE_KIND_LABEL, RESTING_PLACE_STATUS_LABEL } from "@/lib/queries/restingPlaces";
import { fetchSiteGraves } from "@/lib/queries/site-parts";

import { FilterChips, ListState, SitePageHead, SitePager } from "./SiteListParts";
import { useSiteList } from "./useSiteList";

const KINDS = ["grave", "ashes_temple", "columbarium", "scattered", "other"] as const;

/** Mộ phần & tro cốt: chỉ người đã mất, không toạ độ / địa chỉ chi tiết (xem nơi an nghỉ qua link QR của từng mộ). */
export default function SiteGraves() {
  const list = useSiteList("graves", { per: 12, filterParam: "kind", allowed: KINDS, fetcher: fetchSiteGraves });
  const { data, isLoading, error } = list.query;
  return (
    <div className="container max-w-6xl py-8 md:py-10">
      <SitePageHead title={t`Mộ phần & tro cốt`} intro={t`Nơi an nghỉ của các bậc tiền nhân trong dòng họ, để con cháu biết đường về thăm viếng.`} />
      <FilterChips
        label={t`Lọc theo loại`}
        value={list.filter}
        onChange={list.setFilter}
        options={[{ value: "", label: t`Tất cả` }, ...KINDS.map((k) => ({ value: k, label: RESTING_PLACE_KIND_LABEL[k] }))]}
      />
      <ListState loading={isLoading} error={error as Error | null} empty={!data?.items.length} emptyText={t`Chưa có nơi an nghỉ nào.`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((g) => (
            <article key={g.id} className="flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-accent">
                  <IconGrave className="h-3.5 w-3.5" />
                  {RESTING_PLACE_KIND_LABEL[g.kind as keyof typeof RESTING_PLACE_KIND_LABEL] ?? g.kind}
                </span>
                <span className="text-muted-foreground">{RESTING_PLACE_STATUS_LABEL[g.status as keyof typeof RESTING_PLACE_STATUS_LABEL] ?? g.status}</span>
              </div>
              <h3 className="clan-name line-clamp-2 min-h-[2.6em] break-words text-xl font-semibold leading-snug">{g.name ?? g.occupants.join(", ")}</h3>
              {g.location_name && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="line-clamp-2 break-words">{g.location_name}</span>
                </div>
              )}
              {g.occupants.length > 0 && (
                <div className="border-t pt-2.5 text-sm">
                  <div className="text-xs text-muted-foreground">{t`Người an nghỉ`}</div>
                  <div className="line-clamp-2 break-words font-semibold">{g.occupants.join(", ")}</div>
                </div>
              )}
            </article>
          ))}
        </div>
        <SitePager page={list.page} pages={list.pages} onPage={list.setPage} />
        <p className="mt-7 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">{t`Chỉ hiện nơi an nghỉ của người đã mất. Địa chỉ chi tiết và toạ độ không công khai trên trang này.`}</p>
      </ListState>
    </div>
  );
}
