import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { ClanDetail } from "@/lib/queries/clan-detail";

import {
  IconCalendar,
  IconCamera,
  IconCheck,
  IconDownload,
  IconGrave,
  IconGrid,
  IconHome,
  IconLink,
  IconList,
  IconPlus,
  IconScroll,
  IconTree,
  IconUpload,
} from "@/components/icons";
import { FunFactsCard } from "@/components/FunFactsCard";
import { SectionHeading } from "@/components/SectionHeading";
import { PageHeader } from "@/components/PageHeader";
import { RecentActivityPanel } from "@/components/RecentActivityPanel";
import { TodayHubCard } from "@/components/TodayHubCard";
import { RefreshButton } from "@/components/RefreshButton";
import { Button } from "@/components/ui/button";
import { VideoEmptyState } from "@/components/VideoEmptyState";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { getClanContentCounts, getClanStats } from "@/lib/queries/clan-stats";
import { getClansInlawLinks } from "@/lib/queries/clans";
import {
  listAnniversaryCandidates,
  listEvents,
} from "@/lib/queries/events";
import {
  countClanTodo,
  getClanCompletion,
  getClanTodoSummary,
  type ClanCompletion,
  type TodoCategory,
  type TodoSummaryRow,
} from "@/lib/queries/todo";
import { track } from "@/lib/analytics";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

export default function Dashboard() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  // Todo + completion RPCs are member-only (they raise 42501 for
  // anyone not in clan_members). Skip the queries entirely for
  // non-member visitors of a public clan — they shouldn't see the
  // progress tile anyway, and the 403s pollute the console.
  const isMember = effectiveRole(clan) !== null;
  const [searchParams, setSearchParams] = useSearchParams();
  const showWelcome = searchParams.get("welcome") === "1" && isMember;
  function dismissWelcome() {
    const n = new URLSearchParams(searchParams);
    n.delete("welcome");
    setSearchParams(n, { replace: true });
  }

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.clanStats(clan.id, userId),
    queryFn: () => getClanStats(clan.id),
    enabled: !!userId,
  });
  // Số phòng ký ức / mộ phần / di sản — member-only (RLS trả 0 cho người ngoài).
  const { data: contentCounts } = useQuery({
    queryKey: ["clan-content-counts", clan.id, userId],
    queryFn: () => getClanContentCounts(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });
  // Non-members of a public clan need the masked view; raw `persons`
  // RLS would return zero rows for them. Same pattern as /tree.
  const treeSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId, treeSource),
    queryFn: () => getTreeData(clan.id, treeSource),
    enabled: !!userId,
  });
  const { data: events } = useQuery({
    queryKey: queryKeys.events(clan.id, userId),
    queryFn: () => listEvents(clan.id),
    enabled: !!userId,
  });
  const { data: anniversaries } = useQuery({
    queryKey: [
      ...queryKeys.anniversaries(clan.id, userId),
      treeSource,
    ] as const,
    queryFn: () => listAnniversaryCandidates(clan.id, undefined, treeSource),
    enabled: !!userId,
  });
  const { data: completion } = useQuery({
    queryKey: queryKeys.clanCompletion(clan.id, userId),
    queryFn: () => getClanCompletion(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });
  const { data: todoSummary } = useQuery({
    queryKey: queryKeys.clanTodoSummary(clan.id, userId),
    queryFn: () => getClanTodoSummary(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });
  const { data: inlawMap } = useQuery({
    queryKey: ["clan-inlaw-links", [clan.id]],
    queryFn: () => getClansInlawLinks([clan.id]),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
  const inlaws = inlawMap?.get(clan.id) ?? [];

  const { data: todoCount } = useQuery({
    queryKey: queryKeys.clanTodoCount(clan.id, userId),
    queryFn: () => countClanTodo(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });

  // Bumped to a year so the calendar (below) has data across months.
  // The flat "next 5" list still slices the top of this list.
  const upcoming: UpcomingEvent[] = useMemo(() => {
    if (!tree || !events || !anniversaries) return [];
    const today = new Date();
    const a = computeUpcomingEvents({
      today,
      daysAhead: 365,
      persons: tree.persons,
      events,
    });
    const b = computeUpcomingAnniversaries({
      today,
      daysAhead: 365,
      anniversaries,
      generationOffset: clan.generation_offset,
    });
    return [...a, ...b].sort((x, y) => x.daysUntil - y.daysUntil);
  }, [tree, events, anniversaries, clan.generation_offset]);
  const upcomingTop5 = upcoming.slice(0, 5);
  const todayEvents = upcoming.filter((e) => e.daysUntil === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<IconHome className="h-7 w-7" />}
        title="Tổng quan"
        description={`Trang chủ của ${clan.name}.`}
        actions={
          <RefreshButton
            clanId={clan.id}
            cachedVersion={clan.data_version}
            compact
          />
        }
      />

      {showWelcome && (
        <section
          aria-label="Chào mừng"
          className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
        >
          <div>
            <p className="font-semibold">
              Chào mừng bạn đến với dòng họ {clan.name}! 🎉
            </p>
            <p className="text-sm text-muted-foreground">
              Hai bước để cùng vun đắp gia phả: cho biết bạn là ai trong cây,
              rồi bổ sung người thân của mình.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link
                to={`/clans/${clan.id}/tree?view=lineage`}
                onClick={() => {
                  track("onboarding_lineage_click");
                  dismissWelcome();
                }}
              >
                <IconTree className="h-4 w-4 mr-1.5" />
                Tôi là ai trong cây?
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={dismissWelcome}>
              Để sau
            </Button>
          </div>
        </section>
      )}

      {clan.description && <ClanDescription text={clan.description} />}

      {inlaws.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <IconLink className="h-4 w-4 text-primary" />
            Đã kết thông gia với {inlaws.length} dòng họ
          </h2>
          <div className="flex flex-wrap gap-2">
            {inlaws.map((c) => (
              <Link
                key={c.clan_id}
                to={`/clans/${c.clan_id}`}
                className="inline-flex items-center rounded-full border bg-muted/40 px-3 py-1 text-sm hover:border-primary transition-colors"
              >
                {c.clan_name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {/* Empty-state check uses the tree query (which goes through the
          masked view for non-members of public clans) — `stats` runs
          as security_invoker so it'd return 0 for non-members even
          when the clan has people, producing a misleading "no one in
          this clan yet" message on real, populated public clans. */}
      {tree && tree.persons.length === 0 ? (
        canEdit ? (
          <VideoEmptyState
            videoId="them-thuy-to"
            title="Chưa có ai trong dòng họ"
            description="Bắt đầu bằng cách thêm Thuỷ tổ. Xem video 1 phút bên dưới rồi vào trang Thêm người."
            ctaLabel="Thêm Thuỷ tổ"
            ctaTo={`/clans/${clan.id}/people/new`}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Chưa có ai trong dòng họ</CardTitle>
              <CardDescription>
                Quản trị/biên tập viên sẽ thêm thành viên trước.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : tree && tree.persons.length > 0 ? (
        <>
          {/* Thẻ "Hôm nay" — đổi mỗi ngày (âm lịch, ngày tốt/xấu, giỗ/sinh
              nhật hôm nay, phong tục hôm nay) → tạo lý do mở app hằng ngày. */}
          <TodayHubCard clanId={clan.id} todayEvents={todayEvents} />

          {/* Sự kiện sắp tới — ưu tiên cao: nhắc giỗ/sinh nhật sắp đến. */}
          {upcomingTop5.length > 0 && (
            <section aria-label="Sự kiện sắp tới" className="space-y-2">
              <SectionHeading
                icon={<IconCalendar />}
                title="Sự kiện sắp tới"
                action={
                  <Link
                    to={`/clans/${clan.id}/events`}
                    className="text-sm text-primary hover:underline"
                  >
                    Xem tất cả →
                  </Link>
                }
              />
              {/* Desktop: 2 cột cho gọn (mỗi sự kiện 1 hàng phí chỗ ngang). */}
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {upcomingTop5.map((e) => (
                  <UpcomingRow key={e.key} event={e} clanId={clan.id} />
                ))}
              </ul>
            </section>
          )}

          {/* Thao tác nhanh — điều hướng chính, đưa lên cao. */}
          <section aria-label="Thao tác nhanh" className="space-y-2">
            <SectionHeading icon={<IconGrid />} title="Thao tác nhanh" />
            {/* Ô NGANG gọn (icon + chữ cùng dòng): 2 cột mobile / 4 cột desktop
                → thấp hơn hẳn ô vuông cũ, tiết kiệm diện tích. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ActionTile
                to={`/clans/${clan.id}/people`}
                icon={<IconList />}
                title="Danh bạ"
              />
              <ActionTile
                to={`/clans/${clan.id}/tree`}
                icon={<IconTree />}
                title="Phả hệ"
              />
              <ActionTile
                to={`/clans/${clan.id}/graves`}
                icon={<IconGrave />}
                title="Mộ phần"
              />
              <ActionTile
                to={`/clans/${clan.id}/board`}
                icon={<IconScroll />}
                title="Bảng tin"
              />
              {isMember && (
                <>
                  <ActionTile
                    to={`/clans/${clan.id}/memory-room`}
                    icon={<IconCamera />}
                    title="Phòng ký ức"
                  />
                  <ActionTile
                    to={`/clans/${clan.id}/todo`}
                    icon={<IconCheck />}
                    title="Việc làm"
                    badge={todoCount}
                  />
                  <ActionTile
                    to={`/clans/${clan.id}/inlaws`}
                    icon={<IconLink />}
                    title="Thông gia"
                  />
                </>
              )}
              {canEdit && (
                <>
                  <ActionTile
                    to={`/clans/${clan.id}/people/new`}
                    icon={<IconPlus />}
                    title="Thêm người"
                  />
                  <ActionTile
                    to={`/clans/${clan.id}/import`}
                    icon={<IconUpload />}
                    title="Nhập Excel"
                  />
                </>
              )}
              {/* PDF export is member-only — bulk-downloading the whole
                  clan book is owner territory, not for non-member
                  public-clan visitors. */}
              {isMember && <PdfActionTile clan={clan} />}
            </div>
          </section>

          {/* Tiến độ hoàn thiện — nhắc bổ sung thông tin. */}
          {completion && completion.total > 0 && (
            <CompletionTile
              clanId={clan.id}
              completion={completion}
              summary={todoSummary ?? []}
            />
          )}

          {/* Thống kê dòng họ — GỘP GỌN 9 card thành 1 thẻ, đưa xuống dưới
              (thông tin thứ yếu). Người: số lớn + tách Nam/Nữ/Còn sống/Đã mất;
              kho tư liệu: hàng nút nhỏ bấm được. */}
          {(() => {
            const useStatsRpc = isMember && stats && stats.total_persons > 0;
            const counts = useStatsRpc
              ? {
                  total: stats!.total_persons,
                  maxGen: stats!.max_generation,
                  males: stats!.males,
                  females: stats!.females,
                  living: stats!.living,
                  deceased: stats!.deceased,
                }
              : {
                  total: tree.persons.length,
                  maxGen: tree.persons.reduce<number | null>(
                    (m, p) =>
                      p.generation == null
                        ? m
                        : m == null || p.generation > m
                          ? p.generation
                          : m,
                    null,
                  ),
                  males: tree.persons.filter((p) => p.gender === "M").length,
                  females: tree.persons.filter((p) => p.gender === "F").length,
                  living: tree.persons.filter((p) => p.is_living).length,
                  deceased: tree.persons.filter((p) => !p.is_living).length,
                };
            return (
              <section
                aria-label="Thống kê dòng họ"
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-semibold text-primary tabular-nums">
                    {counts.total}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    thành viên · {counts.maxGen ?? "—"} đời
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
                  <MiniStat label="Nam" value={counts.males} />
                  <MiniStat label="Nữ" value={counts.females} />
                  <MiniStat label="Còn sống" value={counts.living} />
                  <MiniStat label="Đã mất" value={counts.deceased} />
                </div>
                {isMember && contentCounts && (
                  <div className="grid grid-cols-3 gap-2 border-t pt-3">
                    <ResourceLink
                      to={`/clans/${clan.id}/memory-room`}
                      label="Phòng ký ức"
                      value={contentCounts.memory_rooms}
                    />
                    <ResourceLink
                      to={`/clans/${clan.id}/graves`}
                      label="Mộ phần & tro cốt"
                      value={contentCounts.resting_places}
                    />
                    <ResourceLink
                      to={`/clans/${clan.id}/heritage`}
                      label="Di sản văn hoá"
                      value={contentCounts.heritage_items}
                    />
                  </div>
                )}
              </section>
            );
          })()}

          <FunFactsCard
            clan={clan}
            userId={userId}
            persons={tree.persons}
            families={tree.families}
          />

          {effectiveRole(clan) !== null && (
            <RecentActivityPanel clanId={clan.id} />
          )}
        </>
      ) : null}
    </div>
  );
}

/** Số nhỏ + nhãn cùng dòng — cho thẻ thống kê gộp gọn. */
function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

/** Ô kho tư liệu bấm được (nhỏ gọn): số + nhãn, trong thẻ thống kê. */
function ResourceLink({
  to,
  label,
  value,
}: {
  to: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center rounded-md border bg-muted/20 px-2 py-2 text-center hover:border-primary hover:bg-muted/40 transition-colors"
    >
      <span className="text-lg font-semibold tabular-nums leading-none">
        {value}
      </span>
      <span className="mt-1 text-xs text-muted-foreground leading-tight">
        {label}
      </span>
    </Link>
  );
}

function ActionTile({
  to,
  icon,
  title,
  badge,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  /** Optional badge số đếm (vd. todo count). 0/undefined → không hiển thị. */
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="group relative flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 hover:border-primary hover:bg-muted/30 transition-colors"
    >
      <span
        className="text-primary shrink-0 [&>svg]:h-5 [&>svg]:w-5"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-sm font-medium leading-tight truncate">{title}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-1 right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1 tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function PdfActionTile({ clan }: { clan: ClanDetail }) {
  return (
    <ExportPdfTile clan={clan} />
  );
}

function ExportPdfTile({ clan }: { clan: ClanDetail }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setErr(null);
    try {
      const { downloadClanBookPdf } = await import("@/lib/pdf/exportClanBook");
      await downloadClanBookPdf(clan, { tree: true, detail: true });
      track("export", { kind: "clan_book_pdf", from: "dashboard" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={err ?? undefined}
      className="group relative flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 hover:border-primary hover:bg-muted/30 transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      <span
        className="text-primary shrink-0 [&>svg]:h-5 [&>svg]:w-5"
        aria-hidden="true"
      >
        <IconDownload />
      </span>
      <span className="text-sm font-medium leading-tight truncate">
        {busy ? "Đang xuất…" : "Xuất PDF"}
      </span>
    </button>
  );
}

function UpcomingRow({
  event,
  clanId,
}: {
  event: UpcomingEvent;
  clanId: string;
}) {
  const dt = new Date(event.date + "T00:00:00");
  const day = dt.getDate();
  const month = dt.getMonth() + 1;
  const countdown =
    event.daysUntil === 0
      ? "Hôm nay"
      : event.daysUntil === 1
        ? "Ngày mai"
        : `Còn ${event.daysUntil} ngày`;

  // Strip the kind prefix from the title so the redesigned row can
  // present "person name (top)" + "kind label (subtitle)" without
  // repeating "Sinh nhật" 5 times down the column. For custom events
  // the title doesn't have a prefix, so it's left intact.
  let mainText = event.title;
  if (event.kind === "birthday" && mainText.startsWith("Sinh nhật ")) {
    mainText = mainText.slice("Sinh nhật ".length);
  } else if (event.kind === "anniversary" && mainText.startsWith("Giỗ ")) {
    mainText = mainText.slice("Giỗ ".length);
  }

  const kindLabel =
    event.kind === "birthday"
      ? "Sinh nhật"
      : event.kind === "anniversary"
        ? "Ngày giỗ"
        : "Sự kiện";

  const stampColor =
    event.kind === "birthday"
      ? "bg-primary/10 text-primary"
      : event.kind === "anniversary"
        ? "bg-muted text-muted-foreground"
        : "bg-accent/15 text-accent";

  const inner = (
    <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card hover:border-primary transition-colors">
      <div
        className={`shrink-0 w-12 text-center rounded-md py-1 ${stampColor}`}
      >
        <div className="text-xs uppercase tracking-wider leading-none">
          Th{month}
        </div>
        <div className="text-lg font-semibold leading-tight">{day}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{mainText}</p>
        <p className="text-xs text-muted-foreground truncate">
          {kindLabel}
          {event.subtitle ? ` · ${event.subtitle}` : ""}
        </p>
      </div>
      <span
        className={`text-xs whitespace-nowrap shrink-0 ${
          event.daysUntil === 0
            ? "text-primary font-semibold"
            : event.daysUntil <= 7
              ? "text-accent font-medium"
              : "text-muted-foreground"
        }`}
      >
        {countdown}
      </span>
    </div>
  );

  return (
    <li>
      {event.personId ? (
        <Link to={`/clans/${clanId}/people/${event.personId}`} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

/**
 * Clan description block. Long family histories (multi-paragraph)
 * push the rest of the dashboard below the fold on mobile, so we
 * clamp to ~3 lines + a "Xem thêm" toggle. Desktop (sm+) shows
 * the whole text — there's plenty of vertical room.
 */
function ClanDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <p
        className={`text-muted-foreground whitespace-pre-line ${
          expanded ? "" : "line-clamp-3 sm:line-clamp-none"
        }`}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="mt-1 text-sm text-primary hover:underline sm:hidden"
      >
        {expanded ? "Thu gọn" : "Xem thêm"}
      </button>
    </div>
  );
}

// Short hint surfaced after the percentage — "Còn 12 người thiếu
// năm sinh →". Phrasing is intentionally inclusive ("còn") not
// accusatory ("bạn còn thiếu"). Picks the single biggest gap; the
// /todo page handles the rest.
const CATEGORY_CTA: Record<TodoCategory, string> = {
  missing_parents: "thiếu cha/mẹ",
  missing_dates: "thiếu năm sinh/mất",
  dead_end: "có thể còn thiếu con",
  missing_media: "thiếu ảnh / âm lịch",
};

function CompletionTile({
  clanId,
  completion,
  summary,
}: {
  clanId: string;
  completion: ClanCompletion;
  summary: TodoSummaryRow[];
}) {
  const { percent, complete, total } = completion;
  if (percent === null) return null;
  const tone =
    percent >= 90
      ? "bg-emerald-500"
      : percent >= 50
        ? "bg-primary"
        : "bg-amber-500";

  // Largest open gap → headline CTA. Skip soft categories when a
  // hard one exists so we don't say "thiếu ảnh" while parents are
  // still missing.
  const HARD_ORDER: TodoCategory[] = ["missing_parents", "missing_dates"];
  const counts = new Map<TodoCategory, number>(
    summary.map((r) => [r.category, r.count]),
  );
  const top =
    HARD_ORDER.map((c) => ({ category: c, count: counts.get(c) ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)[0] ??
    [...summary].sort((a, b) => b.count - a.count).find((r) => r.count > 0);

  return (
    <Link
      to={`/clans/${clanId}/todo`}
      aria-label="Mở trang Việc cần làm để bổ sung thông tin"
      className="block rounded-lg border bg-card p-4 sm:p-5 space-y-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-medium">Họ ta đã hoàn thành</h3>
        <span className="text-2xl sm:text-3xl font-semibold tabular-nums">
          {percent}%
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full ${tone} transition-[width] duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm">
        {top ? (
          <>
            <span className="text-muted-foreground">
              Còn{" "}
              <span className="tabular-nums">{top.count}</span> người{" "}
              {CATEGORY_CTA[top.category]}
            </span>
            <span className="text-primary"> →</span>
          </>
        ) : (
          <span className="text-muted-foreground tabular-nums">
            {complete.toLocaleString("vi-VN")} /{" "}
            {total.toLocaleString("vi-VN")} người đã đủ thông tin.
          </span>
        )}
      </p>
    </Link>
  );
}
