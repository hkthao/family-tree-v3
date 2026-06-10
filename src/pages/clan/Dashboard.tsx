import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { ClanDetail } from "@/lib/queries/clan-detail";

import {
  IconDownload,
  IconList,
  IconPlus,
  IconTree,
  IconUpload,
} from "@/components/icons";
import { EventsCalendar } from "@/components/EventsCalendar";
import { RecentActivityPanel } from "@/components/RecentActivityPanel";
import { RefreshButton } from "@/components/RefreshButton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { getClanStats } from "@/lib/queries/clan-stats";
import {
  listAnniversaryCandidates,
  listEvents,
} from "@/lib/queries/events";
import {
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

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.clanStats(clan.id, userId),
    queryFn: () => getClanStats(clan.id),
    enabled: !!userId,
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
    });
    return [...a, ...b].sort((x, y) => x.daysUntil - y.daysUntil);
  }, [tree, events, anniversaries]);
  const upcomingTop5 = upcoming.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Tổng quan</h2>
        <RefreshButton
          clanId={clan.id}
          cachedVersion={clan.data_version}
          compact
        />
      </div>

      {clan.description && <ClanDescription text={clan.description} />}

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {/* Empty-state check uses the tree query (which goes through the
          masked view for non-members of public clans) — `stats` runs
          as security_invoker so it'd return 0 for non-members even
          when the clan has people, producing a misleading "no one in
          this clan yet" message on real, populated public clans. */}
      {tree && tree.persons.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Chưa có ai trong dòng họ</CardTitle>
            <CardDescription>
              {canEdit
                ? "Bắt đầu bằng cách thêm thuỷ tổ hoặc nhập từ Excel."
                : "Quản trị/biên tập viên sẽ thêm thành viên trước."}
            </CardDescription>
          </CardHeader>
          {canEdit && (
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to={`/clans/${clan.id}/people/new`}>
                  <IconPlus className="h-4 w-4 mr-1.5" />
                  Thêm người
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/clans/${clan.id}/import`}>
                  <IconUpload className="h-4 w-4 mr-1.5" />
                  Nhập từ Excel
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : tree && tree.persons.length > 0 ? (
        <>
          {/* Stats tiles. For members, use the get_clan_stats RPC
              (faster aggregate). For non-member visitors of public
              clans, get_clan_stats returns 0 across the board because
              it runs as security_invoker against persons-RLS — so we
              fall back to client-side counting from the masked tree
              data they already have. */}
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
                  maxGen:
                    tree.persons.reduce<number | null>(
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
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                <StatTile label="Tổng số người" value={counts.total} highlight />
                <StatTile label="Số đời" value={counts.maxGen ?? "—"} />
                <StatTile label="Nam" value={counts.males} />
                <StatTile label="Nữ" value={counts.females} />
                <StatTile label="Còn sống" value={counts.living} />
                <StatTile label="Đã mất" value={counts.deceased} muted />
              </section>
            );
          })()}

          {completion && completion.total > 0 && (
            <CompletionTile
              clanId={clan.id}
              completion={completion}
              summary={todoSummary ?? []}
            />
          )}

          {upcoming.length > 0 && (
            <section aria-label="Lịch sự kiện" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Lịch sự kiện</h3>
                <Link
                  to={`/clans/${clan.id}/events`}
                  className="text-sm text-primary hover:underline"
                >
                  Xem tất cả →
                </Link>
              </div>
              <EventsCalendar events={upcoming} clanId={clan.id} />
            </section>
          )}

          {upcomingTop5.length > 0 && (
            <section aria-label="Sự kiện sắp tới" className="space-y-2">
              <h3 className="text-lg font-semibold">Sự kiện sắp tới</h3>
              <ul className="space-y-1.5">
                {upcomingTop5.map((e) => (
                  <UpcomingRow key={e.key} event={e} clanId={clan.id} />
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Thao tác nhanh" className="space-y-2">
            <h3 className="text-lg font-semibold">Thao tác nhanh</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <ActionTile
                to={`/clans/${clan.id}/people`}
                icon={<IconList className="h-5 w-5" />}
                title="Danh bạ"
                desc="Xem & lọc thành viên"
              />
              <ActionTile
                to={`/clans/${clan.id}/tree`}
                icon={<IconTree className="h-5 w-5" />}
                title="Cây gia phả"
                desc="Sơ đồ phả hệ"
              />
              {canEdit && (
                <>
                  <ActionTile
                    to={`/clans/${clan.id}/people/new`}
                    icon={<IconPlus className="h-5 w-5" />}
                    title="Thêm người"
                    desc="Tạo bản ghi mới"
                  />
                  <ActionTile
                    to={`/clans/${clan.id}/import`}
                    icon={<IconUpload className="h-5 w-5" />}
                    title="Nhập Excel"
                    desc="Import hàng loạt"
                  />
                </>
              )}
              {/* PDF export is member-only — bulk-downloading the whole
                  clan book is owner territory, not for non-member
                  public-clan visitors. */}
              {isMember && <PdfActionTile clan={clan} />}
            </div>
          </section>

          {effectiveRole(clan) !== null && (
            <RecentActivityPanel clanId={clan.id} />
          )}
        </>
      ) : null}
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: number | string;
  highlight?: boolean;
  muted?: boolean;
}

function ActionTile({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-1 rounded-lg border bg-card p-4 hover:border-primary hover:bg-muted/30 transition-colors"
    >
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      <span className="font-medium leading-tight">{title}</span>
      <span className="text-xs text-muted-foreground">{desc}</span>
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
      className="text-left flex flex-col gap-1 rounded-lg border bg-card p-4 hover:border-primary hover:bg-muted/30 transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      <span className="text-primary" aria-hidden="true">
        <IconDownload className="h-5 w-5" />
      </span>
      <span className="font-medium leading-tight">
        {busy ? "Đang xuất…" : "Xuất sổ PDF"}
      </span>
      <span className="text-xs text-muted-foreground">
        {err ? `Lỗi: ${err.slice(0, 40)}` : "Sách gia phả PDF"}
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
        <div className="text-[10px] uppercase tracking-wider leading-none">
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

function StatTile({ label, value, highlight, muted }: StatTileProps) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${
        highlight ? "border-primary/40" : ""
      }`}
    >
      <p
        className={`text-3xl font-semibold ${
          muted ? "text-muted-foreground" : highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
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
