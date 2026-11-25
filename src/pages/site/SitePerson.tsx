import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { HistoricalPersonSections } from "@/components/HistoricalPersonSections";
import { IconArrowLeft, IconCalendar, IconCopy, IconGrave, IconMapPin, IconShare2, IconTree, IconUser } from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { HERITAGE_CATEGORY_LABEL } from "@/lib/queries/heritage";
import { clanHasSources } from "@/lib/queries/historical";
import { RESTING_PLACE_KIND_LABEL } from "@/lib/queries/restingPlaces";
import type { ShareViewPerson } from "@/lib/queries/share-view";
import { fetchSitePerson } from "@/lib/queries/site-parts";
import { formatLunarAnniversary, formatLunarDate } from "@/lib/lunarDate";
import { formatPartialDate } from "@/lib/partialDate";
import { shareUpcoming } from "@/lib/shareUpcoming";
import { personRelations } from "@/lib/siteRelations";
import { sitePagePath } from "@/lib/siteSections";
import { cn } from "@/lib/utils";

import { formatPostDate, postTypeLabel } from "./postUi";
import { useSite } from "./siteContext";

const initials = (name: string) => {
  const w = name.trim().split(/\s+/);
  return (w[w.length - 1] ?? "?").charAt(0).toUpperCase();
};

const lunar = (l?: { year: number | null; month: number | null; day: number | null }) =>
  l?.year ? formatLunarDate({ year: l.year, month: l.month ?? undefined, day: l.day ?? undefined, isLeap: false }) : "";

function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      {title && <h2 className="clan-name mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="clan-name mb-3.5 text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Hồ sơ một người = trang tiểu sử cá nhân công khai (docs/plan-trang-dong-ho.md, mục 6d): đầu hồ sơ, tiểu sử, dấu mốc cuộc đời,
 * ký ức, bài viết / di sản liên quan, cột bên (thông tin cơ bản, ngày giỗ, quan hệ, nơi an nghỉ). Khối nào không có dữ liệu thì ẩn.
 * Người còn sống chỉ hiện tên + đời; mọi thứ khác (tiểu sử, nơi chốn…) chỉ của người đã mất.
 */
export default function SitePerson() {
  const { personId = "" } = useParams<{ personId: string }>();
  const { base, data, access, canContribute } = useSite();
  const toast = useToast();
  const person = data.persons.find((p) => p.id === personId);

  const { data: x, isLoading } = useQuery({
    queryKey: ["site", access.token ?? access.clanId, "person", personId],
    queryFn: () => fetchSitePerson(access, personId),
    enabled: !!person,
    retry: false,
  });
  // Trị vì / chức tước / cha mẹ nuôi của dòng họ lịch sử công khai có nguồn sử liệu (như màn Share cũ).
  const publicClan = !access.token;
  const { data: hasSources } = useQuery({
    queryKey: ["clan-has-sources", data.clan_id],
    queryFn: () => clanHasSources(data.clan_id),
    enabled: publicClan && !!person,
    staleTime: 10 * 60 * 1000,
  });
  usePageTitle(person ? `${person.full_name} — ${data.clan_name ?? ""}`.replace(/ — $/, "") : null, x?.bio ? x.bio.slice(0, 160) : null);

  const rel = useMemo(() => personRelations(data.persons, data.families, personId), [data, personId]);
  const upcoming = useMemo(() => (person && !person.is_living ? shareUpcoming(data, 400).find((e) => e.personId === personId && e.kind === "anniversary") : undefined), [data, person, personId]);
  const memories = useMemo(() => (data.community?.memories ?? []).filter((m) => m.person_id === personId), [data, personId]);

  const url = typeof window !== "undefined" ? window.location.href : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t`Đã sao chép liên kết.`);
    } catch {
      toast.error(t`Không sao chép được liên kết.`);
    }
  };
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  if (!person) {
    return (
      <div className="container max-w-2xl py-16 text-center">
        <p className="mb-4 text-muted-foreground">{t`Không tìm thấy người này trong cây.`}</p>
        <Button asChild size="sm" variant="outline" className="px-3 text-sm">
          <Link to={sitePagePath(base, "tree")}>
            <IconArrowLeft className="mr-1.5 h-4 w-4" />
            {t`Về cây gia phả`}
          </Link>
        </Button>
      </div>
    );
  }

  const off = data.generation_offset ?? 0;
  const gen = person.generation != null ? person.generation - off : null;
  const treeLink = `${sitePagePath(base, "tree")}?p=${personId}`;
  const openProfile = (id: string) => sitePagePath(base, "person", id);

  // Người còn sống: chỉ tên + đời.
  if (person.is_living) {
    return (
      <div className="container max-w-2xl py-12 text-center">
        <PersonAvatar gender={person.gender} photoUrl={null} size={96} className="mx-auto" />
        <h1 className="clan-name mt-4 break-words text-3xl font-bold">{person.full_name}</h1>
        {gen != null && <p className="mt-1 text-muted-foreground">{t`Đời ${gen}`}</p>}
        <p className="mx-auto mt-5 max-w-md rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">{t`Thông tin của người đang sống được ẩn để bảo vệ quyền riêng tư.`}</p>
        <Button asChild size="sm" variant="outline" className="mt-5 px-3 text-sm">
          <Link to={treeLink}>
            <IconTree className="mr-1.5 h-4 w-4" />
            {t`Xem trên cây`}
          </Link>
        </Button>
      </div>
    );
  }

  const profile = x?.profile !== false;
  const born = formatPartialDate({ date: person.birth_date, precision: person.birth_date_precision });
  const died = formatPartialDate({ date: person.death_date, precision: person.death_date_precision });
  const years = [person.birth_date?.slice(0, 4), person.death_date?.slice(0, 4)];
  const lifespan = years[0] || years[1] ? `${years[0] ?? "?"} – ${years[1] ?? "?"}` : "";
  const anniv = formatLunarAnniversary({ month: person.death_anniv_lunar_month ?? undefined, day: person.death_anniv_lunar_day ?? undefined });
  const alias = x?.nickname || x?.courtesy_name || x?.posthumous_name || "";
  const facts: [string, string | null | undefined][] = [
    [t`Giới tính`, person.gender === "M" ? t`Nam` : t`Nữ`],
    [t`Tên tự`, x?.courtesy_name],
    [t`Tên húy`, x?.nickname],
    [t`Tên thụy`, x?.posthumous_name],
    [t`Ngày sinh`, [born, lunar(x?.birth_lunar)].filter(Boolean).join(" · ")],
    [t`Ngày mất`, [died, lunar(x?.death_lunar)].filter(Boolean).join(" · ")],
    [t`Ngày giỗ`, anniv],
    [t`Nơi sinh`, x?.birth_place],
    [t`Nơi an táng`, x?.burial_place],
    [t`Thuộc đời`, gen != null ? t`Đời ${gen}` : null],
  ];
  const shownFacts = facts.filter(([, v]) => !!v);
  const relGroups: [string, ShareViewPerson[]][] = [
    [t`Cha mẹ`, rel.parents],
    [t`Vợ / chồng`, rel.spouses],
    [t`Con cái`, rel.children],
    [t`Anh chị em`, rel.siblings],
  ];
  const stories = memories.filter((m) => m.kind !== "photo" && !!m.body).slice(0, 4);
  const photos = memories.filter((m) => !!m.media_url && m.kind === "photo").slice(0, 8);
  const hasRelated = !!x && (x.posts.length > 0 || x.heritage.length > 0);

  return (
    <div className="container max-w-6xl py-6 md:py-8">
      <nav aria-label={t`Đường dẫn`} className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link to={base} className="hover:text-foreground">{t`Trang chủ`}</Link>
        <span aria-hidden="true">›</span>
        <Link to={sitePagePath(base, "tree")} className="hover:text-foreground">{t`Cây gia phả`}</Link>
        <span aria-hidden="true">›</span>
        <span className="text-foreground">{person.full_name}</span>
      </nav>

      {/* Đầu hồ sơ */}
      <section className="flex flex-wrap items-center gap-7 rounded-3xl border bg-card p-6 md:p-7">
        <div className="shrink-0 rounded-full border-[3px] border-accent p-1">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="h-36 w-36 rounded-full object-cover md:h-40 md:w-40" />
          ) : (
            <div aria-hidden="true" className="flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/30 font-serif text-5xl font-bold text-white/85 md:h-40 md:w-40">
              {initials(person.full_name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-[1_1_22rem]">
          <div className="mb-2.5 flex flex-wrap gap-2 text-xs">
            {gen != null && <span className="rounded-full border px-3 py-0.5 font-semibold uppercase tracking-wider text-accent">{t`Đời ${gen}`}</span>}
            <span className="rounded-full border px-3 py-0.5 text-muted-foreground">{t`Đã mất`}</span>
            <span className="rounded-full border px-3 py-0.5 text-muted-foreground">{person.gender === "M" ? t`Nam` : t`Nữ`}</span>
          </div>
          <h1 className="clan-name break-words text-[clamp(1.875rem,5vw,2.75rem)] font-bold leading-tight [overflow-wrap:anywhere]">{person.full_name}</h1>
          {(alias || lifespan) && <p className="mt-1.5 text-lg text-muted-foreground">{[alias, lifespan].filter(Boolean).join(" · ")}</p>}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild size="sm" className="px-3 text-sm">
              <Link to={treeLink}>
                <IconTree className="mr-1.5 h-4 w-4" />
                {t`Xem trên cây`}
              </Link>
            </Button>
            {canContribute && (
              <Button asChild size="sm" variant="outline" className="px-3 text-sm">
                <Link to={`${sitePagePath(base, "contribute")}?p=${personId}`}>
                  <IconUser className="mr-1.5 h-4 w-4" />
                  {t`Đóng góp về người này`}
                </Link>
              </Button>
            )}
            {canNativeShare && (
              <Button size="sm" variant="outline" className="px-3 text-sm" onClick={() => void navigator.share({ title: person.full_name, url }).catch(() => {})}>
                <IconShare2 className="mr-1.5 h-4 w-4" />
                {t`Chia sẻ hồ sơ`}
              </Button>
            )}
            <Button size="sm" variant="outline" className="px-3 text-sm" onClick={() => void copy()}>
              <IconCopy className="mr-1.5 h-4 w-4" />
              {t`Sao chép liên kết`}
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-8">
        {/* Cột chính */}
        <div className="flex min-w-0 flex-[2_1_34rem] flex-col gap-9">
          {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}
          {x && !profile && (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">{t`Người quản lý dòng họ chưa mở phần tiểu sử chi tiết cho đường dẫn này.`}</p>
          )}

          {x?.bio && (
            <Section title={t`Tiểu sử`}>
              <div className="whitespace-pre-line break-words text-justify font-serif text-lg leading-8">{x.bio}</div>
            </Section>
          )}

          {publicClan && hasSources && (
            <HistoricalPersonSections personId={person.id} bio={null} birthDate={person.birth_date} deathDate={person.death_date} clanId={data.clan_id} only="reign" onPersonClick={(id) => void (window.location.href = openProfile(id))} />
          )}

          {x && x.milestones.length > 0 && (
            <Section title={t`Dấu mốc cuộc đời`}>
              <ol className="ml-1 flex flex-col gap-5 border-l-2 pl-[22px]">
                {x.milestones.map((m, i) => (
                  <li key={`${m.year}-${i}`} className="relative">
                    {/* Chấm: 16px (tính cả viền), tâm trùng giữa đường kẻ 2px — left = 1 − 8 − 24 = −31px. */}
                    <span aria-hidden="true" className="absolute -left-[31px] top-1.5 box-border h-4 w-4 rounded-full border-[3px] border-background bg-accent" />
                    <div className="font-serif text-lg font-bold text-accent">{m.year}{m.era ? ` · ${m.era}` : ""}</div>
                    <div className="font-semibold">{m.title}</div>
                    {m.body && <div className="whitespace-pre-line text-sm text-muted-foreground">{m.body}</div>}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {photos.length > 0 && (
            <Section title={t`Hình ảnh & tư liệu`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {photos.map((m) => (
                  <img key={m.id} src={m.media_url!} alt={m.body ?? ""} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" />
                ))}
              </div>
            </Section>
          )}

          {(stories.length > 0 || canContribute) && (
            <Section title={t`Ký ức gia đình`}>
              <div className="flex flex-col gap-3">
                {stories.map((m) => (
                  <blockquote key={m.id} className="rounded-2xl border bg-card px-5 py-4">
                    <p className="mb-2 line-clamp-4 break-words font-serif text-[17px] leading-7">{m.body}</p>
                    <footer className="text-sm text-muted-foreground">{[m.author_name, m.author_relation].filter(Boolean).join(" · ") || t`Người thân`}</footer>
                  </blockquote>
                ))}
              </div>
              {canContribute && (
                <Link to={`${sitePagePath(base, "contribute")}?p=${personId}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                  {t`Bạn nhớ điều gì về người này? Góp một câu chuyện →`}
                </Link>
              )}
            </Section>
          )}

          {hasRelated && (
            <Section title={t`Bài viết & di sản liên quan`}>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {x!.posts.map((p) => (
                  <Link key={p.id} to={sitePagePath(base, "board", p.id)} className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4 hover:border-primary">
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">{postTypeLabel(p.type)}</span>
                    <span className="clan-name line-clamp-2 break-words font-semibold leading-snug">{p.title}</span>
                    <span className="text-xs text-muted-foreground">{formatPostDate(p.created_at)}</span>
                  </Link>
                ))}
                {x!.heritage.map((h) => (
                  <Link key={h.id} to={sitePagePath(base, "heritage", h.id)} className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4 hover:border-primary">
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">{HERITAGE_CATEGORY_LABEL[h.category as keyof typeof HERITAGE_CATEGORY_LABEL] ?? h.category}</span>
                    <span className="clan-name line-clamp-2 break-words font-semibold leading-snug">{h.title}</span>
                    {h.role_note && <span className="line-clamp-1 text-xs text-muted-foreground">{h.role_note}</span>}
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Cột bên */}
        <aside className="flex min-w-0 flex-[1_1_18rem] flex-col gap-4 lg:max-w-sm">
          {shownFacts.length > 0 && (
            <Card title={t`Thông tin cơ bản`}>
              <dl className="flex flex-col gap-2.5 text-sm">
                {shownFacts.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-t pt-2.5 first:border-t-0 first:pt-0">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-words text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {upcoming && (
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-90">{t`Ngày giỗ sắp tới`}</div>
              <div className="clan-name my-1.5 text-2xl font-bold">{anniv || upcoming.date}</div>
              <div className="text-sm">{upcoming.daysUntil === 0 ? t`Hôm nay` : t`Còn ${upcoming.daysUntil} ngày`} · {upcoming.date.split("-").reverse().join("/")}</div>
              <Link to={sitePagePath(base, "events")} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-background px-3.5 text-sm font-semibold text-primary">
                <IconCalendar className="h-4 w-4" />
                {t`Xem lịch giỗ`}
              </Link>
            </div>
          )}

          {relGroups.some(([, ps]) => ps.length > 0) && (
            <Card title={t`Quan hệ`}>
              <div className="flex flex-col">
                {relGroups
                  .filter(([, ps]) => ps.length > 0)
                  .map(([label, ps]) => (
                    <div key={label} className="border-t py-2.5 first:border-t-0 first:pt-0">
                      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
                      <div className="flex flex-col gap-1.5">
                        {ps.map((r) => (
                          <Link key={r.id} to={openProfile(r.id)} className="flex min-h-11 items-center gap-2.5 rounded-xl border px-3 hover:border-primary">
                            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-sm font-bold text-primary-foreground">{initials(r.full_name)}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{r.full_name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {[r.generation != null ? t`Đời ${r.generation - off}` : null, r.is_living ? null : t`Đã mất`].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {x && x.graves.length > 0 && (
            <Card>
              {x.graves.map((g) => (
                <Link key={g.id} to={sitePagePath(base, "graves")} className="block">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                    <IconGrave className="h-3.5 w-3.5" />
                    {t`Nơi an nghỉ`}
                  </div>
                  <div className="clan-name mt-1.5 line-clamp-2 break-words text-lg font-semibold">{g.name ?? RESTING_PLACE_KIND_LABEL[g.kind as keyof typeof RESTING_PLACE_KIND_LABEL] ?? g.kind}</div>
                  {g.location_name && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <IconMapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-1 break-words">{g.location_name}</span>
                    </div>
                  )}
                </Link>
              ))}
            </Card>
          )}

          <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {t`Trang này chỉ hiện thông tin công khai của người đã mất. Người còn sống chỉ hiện tên và đời, các thông tin khác được ẩn.`}
          </p>
        </aside>
      </div>
    </div>
  );
}

