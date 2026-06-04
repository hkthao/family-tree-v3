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

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.clanStats(clan.id, userId),
    queryFn: () => getClanStats(clan.id),
    enabled: !!userId,
  });
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId),
    queryFn: () => getTreeData(clan.id),
    enabled: !!userId,
  });
  const { data: events } = useQuery({
    queryKey: queryKeys.events(clan.id, userId),
    queryFn: () => listEvents(clan.id),
    enabled: !!userId,
  });
  const { data: anniversaries } = useQuery({
    queryKey: queryKeys.anniversaries(clan.id, userId),
    queryFn: () => listAnniversaryCandidates(clan.id),
    enabled: !!userId,
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

      {stats && stats.total_persons === 0 ? (
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
      ) : stats ? (
        <>
          <section
            aria-label="Thống kê dòng họ"
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            <StatTile label="Tổng số người" value={stats.total_persons} highlight />
            <StatTile label="Số đời" value={stats.max_generation ?? "—"} />
            <StatTile label="Nam" value={stats.males} />
            <StatTile label="Nữ" value={stats.females} />
            <StatTile label="Còn sống" value={stats.living} />
            <StatTile label="Đã mất" value={stats.deceased} muted />
          </section>

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
              <PdfActionTile clan={clan} />
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
