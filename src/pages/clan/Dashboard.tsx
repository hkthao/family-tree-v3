import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import {
  IconList,
  IconPlus,
  IconUpload,
} from "@/components/icons";
import { ExportPdfButton } from "@/components/ExportPdfButton";
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
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
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

  const upcoming: UpcomingEvent[] = useMemo(() => {
    if (!tree || !events || !anniversaries) return [];
    const today = new Date();
    const a = computeUpcomingEvents({
      today,
      daysAhead: 30,
      persons: tree.persons,
      events,
    });
    const b = computeUpcomingAnniversaries({
      today,
      daysAhead: 30,
      anniversaries,
    });
    return [...a, ...b].sort((x, y) => x.daysUntil - y.daysUntil).slice(0, 5);
  }, [tree, events, anniversaries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Tổng quan</h2>
        <RefreshButton clanId={clan.id} cachedVersion={clan.data_version} />
      </div>

      {clan.description && (
        <p className="text-muted-foreground">{clan.description}</p>
      )}

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
            <StatTile label="Số chi" value={stats.branches} />
            <StatTile label="Nam" value={stats.males} />
            <StatTile label="Nữ" value={stats.females} />
            <StatTile label="Còn sống" value={stats.living} />
            <StatTile label="Đã mất" value={stats.deceased} muted />
          </section>

          {upcoming.length > 0 && (
            <section aria-label="Sự kiện sắp tới" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sự kiện sắp tới</h3>
                <Link
                  to={`/clans/${clan.id}/events`}
                  className="text-sm text-primary hover:underline"
                >
                  Xem tất cả →
                </Link>
              </div>
              <ul className="space-y-1.5">
                {upcoming.map((e) => (
                  <UpcomingRow
                    key={e.key}
                    event={e}
                    clanId={clan.id}
                  />
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/clans/${clan.id}/people`}>
                <IconList className="h-4 w-4 mr-1.5" />
                Xem danh bạ
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/clans/${clan.id}/tree`}>
                <span className="text-base mr-1.5" aria-hidden="true">🌳</span>
                Xem cây gia phả
              </Link>
            </Button>
            {canEdit && (
              <>
                <Button asChild variant="outline">
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
              </>
            )}
            <ExportPdfButton clan={clan} />
          </div>
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

  const inner = (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-card hover:border-primary transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {day}/{month}
        </span>
        <span className="truncate">{event.title}</span>
      </div>
      <span
        className={`text-xs whitespace-nowrap ${
          event.daysUntil <= 1
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
