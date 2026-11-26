import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  IconArrowRight,
  IconAward,
  IconGrave,
  IconMapPin,
  IconPuzzle,
  IconTree,
} from "@/components/icons";
import { ProvinceMap } from "@/components/ProvinceMap";
import { UpcomingEventList } from "@/components/UpcomingEventList";
import { Button } from "@/components/ui/button";
import { HERITAGE_CATEGORY_LABEL } from "@/lib/queries/heritage";
import { HONOR_CATEGORY_LABEL } from "@/lib/queries/honor";
import { RESTING_PLACE_KIND_LABEL } from "@/lib/queries/restingPlaces";
import {
  fetchSiteEvents,
  fetchSiteGraves,
  fetchSiteHeritage,
  fetchSiteHonor,
  fetchSiteInfo,
  fetchSiteStats,
  fetchSiteMap,
  fetchSiteMosaic,
  fetchSitePosts,
} from "@/lib/queries/site-parts";
import { shareUpcoming } from "@/lib/shareUpcoming";
import { sitePagePath, type SitePageKey } from "@/lib/siteSections";
import { cn } from "@/lib/utils";

import { coverFallbackClass, formatPostDate, postTypeLabel } from "./postUi";
import { PostCover } from "./SiteBoard";
import { useSite } from "./siteContext";

const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)} đ`;

/** Trang chủ dòng họ: phần đầu + giới thiệu + sắp tới (giỗ, sự kiện) + bảng tin / di sản / mộ phần / bảng vàng mới nhất. */
export default function SiteHome() {
  const { base, access, data, sections } = useSite();
  const on = (k: string) => sections.includes(k);
  const key = access.token ?? access.clanId;

  const gens = data.persons
    .map((p) => p.generation)
    .filter((g): g is number => g != null);
  const offset = data.generation_offset ?? 0;
  // Thuỷ tổ: người được đánh dấu is_root (kể cả khi chưa ghi ngày mất); chưa đánh dấu thì lấy người đời nhỏ nhất, ưu tiên nam rồi
  // người sinh sớm nhất — cùng cách cây gia phả chọn người ở giữa, để trang chủ không hiện "—" khi cây vẫn có người đầu dòng.
  const root =
    data.persons.find((p) => p.is_root) ??
    [...data.persons]
      .filter((p) => p.generation != null)
      .sort(
        (a, b) =>
          (a.generation as number) - (b.generation as number) ||
          Number(b.gender === "M") - Number(a.gender === "M") ||
          (a.birth_date ?? "9999").localeCompare(b.birth_date ?? "9999"),
      )[0];

  // Số liệu cả dòng họ từ máy chủ. Chưa có (đang tải / máy chủ chưa hỗ trợ) thì dùng tạm số trong payload cây.
  const stats = useQuery({
    queryKey: ["site", key, "stats"],
    queryFn: () => fetchSiteStats(access),
    retry: false,
  });
  const total = stats.data?.total ?? data.persons.length;
  const maxGen =
    stats.data?.max_generation ?? (gens.length ? Math.max(...gens) : null);
  const generations = maxGen != null ? maxGen - offset : null;

  const info = useQuery({
    queryKey: ["site", key, "info"],
    queryFn: () => fetchSiteInfo(access),
    enabled: on("info"),
    retry: false,
  });
  const events = useQuery({
    queryKey: ["site", key, "events"],
    queryFn: () => fetchSiteEvents(access),
    enabled: on("events"),
    retry: false,
  });
  const posts = useQuery({
    queryKey: ["site", key, "posts", "", 1, "home"],
    queryFn: () => fetchSitePosts(access, { page: 1, per: 4 }),
    enabled: on("board"),
    retry: false,
  });
  const heritage = useQuery({
    queryKey: ["site", key, "heritage", 1, 4],
    queryFn: () => fetchSiteHeritage(access, { per: 4 }),
    enabled: on("heritage"),
    retry: false,
  });
  const graves = useQuery({
    queryKey: ["site", key, "graves", 1, 4],
    queryFn: () => fetchSiteGraves(access, { per: 4 }),
    enabled: on("graves"),
    retry: false,
  });
  const map = useQuery({
    queryKey: ["site", key, "map"],
    queryFn: () => fetchSiteMap(access),
    enabled: on("map"),
    retry: false,
  });
  const mosaic = useQuery({
    queryKey: ["site", key, "mosaic"],
    queryFn: () => fetchSiteMosaic(access),
    enabled: on("mosaic"),
    retry: false,
  });
  const honor = useQuery({
    queryKey: ["site", key, "honor", 1, 4],
    queryFn: () => fetchSiteHonor(access, { per: 4 }),
    enabled: on("honor"),
    retry: false,
  });

  // Giỗ tính từ người đã mất trong cây (luôn có); sự kiện chung thêm vào khi mục Sự kiện được bật.
  const upcoming = useMemo(
    () =>
      shareUpcoming({
        ...data,
        events: events.data?.items ?? data.events ?? [],
      }),
    [data, events.data],
  );
  // Lưới 3 cột: lấy 6 hoặc 3 mục cho hàng cuối không bị hụt.
  const upcomingShown = upcoming.slice(
    0,
    upcoming.length >= 6 ? 6 : upcoming.length >= 3 ? 3 : upcoming.length,
  );

  const facts = info.data
    ? (
        [
          [t`Quê gốc`, info.data.origin_place],
          [t`Từ đường`, info.data.ancestral_hall],
          [t`Giỗ tổ`, info.data.ancestor_anniversary],
          [t`Trưởng họ`, info.data.chief_name],
        ] as [string, string | null][]
      ).filter(([, v]) => !!v)
    : [];

  return (
    <>
      <section className="max-sm:px-4 max-sm:pt-4 sm:border-b sm:bg-card">
        <div className="container flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-8 py-12 max-sm:max-w-none max-sm:gap-y-6 max-sm:rounded-2xl max-sm:border max-sm:bg-card max-sm:p-5">
          <div className="min-w-0 flex-[1_1_30rem]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t`Gia phả dòng họ`}</div>
            <h1 className="clan-name my-3 break-words text-[clamp(1.875rem,5vw,3.25rem)] font-bold leading-tight [text-wrap:balance]">
              {data.clan_name ?? t`Dòng họ`}
            </h1>
            {info.data?.description && (
              <p className="mb-5 max-w-2xl whitespace-pre-line break-words text-left text-muted-foreground sm:text-justify">
                {info.data.description}
              </p>
            )}
            <Button asChild size="sm" className="px-3 text-sm">
              <Link to={sitePagePath(base, "tree")}>
                <IconTree className="mr-1.5 h-4 w-4" />
                {t`Xem cây gia phả`}
              </Link>
            </Button>
          </div>
          <div className="grid w-full max-w-md flex-[1_1_20rem] grid-cols-3 gap-2.5">
            <Stat value={String(total)} label={t`người`} />
            <Stat
              value={generations != null ? String(generations) : "—"}
              label={t`đời`}
            />
            <Stat value={root?.full_name ?? "—"} label={t`thuỷ tổ`} small />
          </div>
          {facts.length > 0 && (
            <dl className="grid w-full grid-cols-1 gap-x-8 gap-y-2 border-t pt-5 text-sm sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-muted-foreground">{k}:</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <div className="container flex max-w-6xl flex-col gap-12 py-10">
        {upcoming.length > 0 && (
          <Block
            title={t`Sắp tới trong họ`}
            more={
              on("events") ? { page: "events", label: t`Xem lịch` } : undefined
            }
          >
            <UpcomingEventList
              events={upcomingShown}
              clanId=""
              readOnly
              view="grid"
            />
          </Block>
        )}

        {on("board") && !!posts.data?.items.length && (
          <Block
            title={t`Bảng tin`}
            more={{ page: "board", label: t`Xem tất cả` }}
          >
            <Grid>
              {posts.data.items.map((p) => (
                <Link
                  key={p.id}
                  to={sitePagePath(base, "board", p.id)}
                  className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card hover:border-primary"
                >
                  <PostCover post={p} className="h-28" />
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                      {postTypeLabel(p.type)}
                    </span>
                    <span className="clan-name line-clamp-2 min-h-[2.7em] break-words font-semibold leading-snug">
                      {p.title}
                    </span>
                    <span className="mt-auto pt-1 text-xs text-muted-foreground">
                      {formatPostDate(p.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </Grid>
          </Block>
        )}

        {on("heritage") && !!heritage.data?.items.length && (
          <Block
            title={t`Di sản dòng họ`}
            more={{ page: "heritage", label: t`Tất cả di sản` }}
          >
            <Grid>
              {heritage.data.items.map((h) => (
                <Link
                  key={h.id}
                  to={sitePagePath(base, "heritage", h.id)}
                  className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card hover:border-primary"
                >
                  {h.photo_url ? (
                    <img
                      src={h.photo_url}
                      alt=""
                      loading="lazy"
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "h-28 w-full bg-gradient-to-br",
                        coverFallbackClass(h.id),
                      )}
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                      {HERITAGE_CATEGORY_LABEL[
                        h.category as keyof typeof HERITAGE_CATEGORY_LABEL
                      ] ?? h.category}
                    </span>
                    <span className="clan-name line-clamp-2 min-h-[2.7em] break-words font-semibold leading-snug">
                      {h.title}
                    </span>
                    {h.summary && (
                      <span className="line-clamp-2 break-words text-sm text-muted-foreground">
                        {h.summary}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </Grid>
          </Block>
        )}

        {on("graves") && !!graves.data?.items.length && (
          <Block
            title={t`Mộ phần & tro cốt`}
            more={{ page: "graves", label: t`Tất cả nơi an nghỉ` }}
          >
            <Grid>
              {graves.data.items.map((g) => (
                <Link
                  key={g.id}
                  to={sitePagePath(base, "graves")}
                  className="flex min-w-0 flex-col gap-1.5 rounded-2xl border bg-card p-4 hover:border-primary"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                    <IconGrave className="h-3.5 w-3.5" />
                    {RESTING_PLACE_KIND_LABEL[
                      g.kind as keyof typeof RESTING_PLACE_KIND_LABEL
                    ] ?? g.kind}
                  </span>
                  <span className="clan-name line-clamp-2 break-words font-semibold leading-snug">
                    {g.name ?? g.occupants.join(", ")}
                  </span>
                  {g.occupants.length > 0 && g.name && (
                    <span className="line-clamp-2 break-words text-sm text-muted-foreground">
                      {g.occupants.join(", ")}
                    </span>
                  )}
                  {g.location_name && (
                    <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                      <IconMapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-1 break-words">
                        {g.location_name}
                      </span>
                    </span>
                  )}
                </Link>
              ))}
            </Grid>
          </Block>
        )}

        {on("map") &&
          !!map.data &&
          Object.keys(map.data.people).length +
            Object.keys(map.data.graves).length >
            0 && (
            <Block title={t`Bản đồ dòng họ`}>
              <div className="grid grid-cols-1 items-center gap-8 rounded-2xl border bg-card p-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
                <div className="mx-auto w-full max-w-[16rem]">
                  <ProvinceMap
                    counts={map.data.people}
                    selected={null}
                    onSelect={() => {}}
                    unit={t`người`}
                    className="mx-auto h-[22rem] max-h-[22rem] w-full"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="clan-name mb-3 text-lg font-semibold">{t`Con cháu nhiều nhất ở`}</h3>
                  <ol className="space-y-2 text-sm">
                    {Object.entries(map.data.people)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([code, n], i) => (
                        <li
                          key={code}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span className="min-w-0 truncate">
                            <span className="mr-2 text-muted-foreground">
                              {i + 1}.
                            </span>
                            {map.data.province_names[code] ?? code}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{t`${n} người`}</span>
                        </li>
                      ))}
                  </ol>
                  {Object.keys(map.data.graves).length > 0 && (
                    <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
                      {t`Nơi an nghỉ của tiền nhân ở ${Object.keys(map.data.graves).length} tỉnh, thành.`}
                    </p>
                  )}
                </div>
              </div>
            </Block>
          )}

        {on("mosaic") && !!mosaic.data && mosaic.data.tiles.length > 0 && (
          <Block title={mosaic.data.title || t`Ảnh ghép đại gia đình`}>
            {mosaic.data.description && (
              <p className="-mt-2 mb-4 max-w-2xl text-muted-foreground">
                {mosaic.data.description}
              </p>
            )}
            <div
              className="grid gap-1 overflow-hidden rounded-2xl"
              style={{
                gridTemplateColumns: `repeat(${mosaic.data.cols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: mosaic.data.slots }, (_, i) => {
                const tile = mosaic.data!.tiles.find((x) => x.position === i);
                return tile?.photo_url ? (
                  <img
                    key={i}
                    src={tile.photo_url}
                    alt={tile.caption ?? ""}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-square w-full bg-muted object-cover text-transparent"
                  />
                ) : (
                  <div key={i} className="aspect-square bg-muted" />
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <IconPuzzle className="h-4 w-4" />
              {t`${mosaic.data.tiles.length} người đã góp mảnh ảnh`}
            </p>
          </Block>
        )}

        {on("honor") && !!honor.data?.items.length && (
          <Block
            title={t`Bảng vàng công đức`}
            more={{ page: "honor", label: t`Xem tất cả` }}
          >
            <Grid>
              {honor.data.items.map((h) => (
                <div
                  key={h.id}
                  className="flex min-w-0 gap-3 rounded-2xl border border-accent/50 bg-card p-4"
                >
                  <IconAward className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="clan-name line-clamp-2 break-words font-semibold leading-snug">
                      {h.honoree_name}
                    </div>
                    {h.note && (
                      <div className="line-clamp-2 break-words text-sm text-muted-foreground">
                        {h.note}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {HONOR_CATEGORY_LABEL[
                        h.category as keyof typeof HONOR_CATEGORY_LABEL
                      ] ?? h.category}
                    </div>
                    {h.amount ? (
                      <div className="mt-1 text-sm font-semibold tabular-nums text-primary">
                        {vnd(h.amount)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </Grid>
          </Block>
        )}
      </div>
    </>
  );
}

function Block({
  title,
  more,
  children,
}: {
  title: string;
  more?: { page: SitePageKey; label: string };
  children: ReactNode;
}) {
  const { base } = useSite();
  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="clan-name site-heading text-2xl font-bold">{title}</h2>
        {more && (
          <Link
            to={sitePagePath(base, more.page)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            {more.label} <IconArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

function Stat({
  value,
  label,
  small,
}: {
  value: string;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-background px-2 py-4 text-center">
      <div
        className={
          small
            ? "clan-name break-words pt-1.5 text-base font-bold leading-snug"
            : "clan-name text-3xl font-bold leading-none text-primary"
        }
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
