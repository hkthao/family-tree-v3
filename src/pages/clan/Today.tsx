import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { UpcomingEventRow } from "@/components/UpcomingEventRow";
import {
  IconBell,
  IconCalendar,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { formatLunarDate, solarStringToLunar } from "@/lib/lunarDate";
import { listAnniversaryCandidates, listEvents } from "@/lib/queries/events";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";
import { upcomingFestivals } from "@/lib/festivals";

/**
 * "Hôm nay" page — at-a-glance focus on what's happening soon.
 *
 * Three time buckets:
 *   - Hôm nay (today only)
 *   - 7 ngày tới (days 1-6 ahead)
 *   - 30 ngày tới (days 7-29 ahead)
 *
 * Same data sources as the Events page (birthdays + giỗ + custom
 * events) but grouped for fast scanning instead of browsing.
 *
 * Reuses computeUpcomingEvents + computeUpcomingAnniversaries from
 * the existing lib so the cron job and this page stay aligned.
 */
export default function Today() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  // Non-members of a public clan read through the masked view (same
  // source-selection pattern as /tree, /events, Dashboard). "Hôm
  // nay" is fundamentally just a different layout of the events +
  // anniversaries data — no reason to hide it from public visitors.
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
    queryFn: () =>
      listAnniversaryCandidates(clan.id, undefined, treeSource),
    enabled: !!userId,
  });

  const upcoming = useMemo<UpcomingEvent[]>(() => {
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
      generationOffset: clan.generation_offset,
    });
    return [...a, ...b].sort((x, y) => x.daysUntil - y.daysUntil);
  }, [tree, events, anniversaries, clan.generation_offset]);

  // Lễ tết ghép ở TẦNG HIỂN THỊ, không nằm trong computeUpcomingEvents —
  // hàm đó là nguồn cho cron gửi mail, mà không ai đăng ký nhận thư nhắc
  // Trung Thu.
  const withFestivals = useMemo(() => {
    const merged = [...upcoming, ...upcomingFestivals(todayIso(), 30)];
    return merged.sort(
      (a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title, "vi"),
    );
  }, [upcoming]);

  const todayEvents = withFestivals.filter((e) => e.daysUntil === 0);
  const weekEvents = withFestivals.filter(
    (e) => e.daysUntil >= 1 && e.daysUntil <= 6,
  );
  const monthEvents = withFestivals.filter(
    (e) => e.daysUntil >= 7 && e.daysUntil <= 29,
  );

  const todayHeader = useMemo(() => formatTodayHeader(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconCalendar className="h-7 w-7" />}
        title="Hôm nay"
        description={todayHeader}
      />

      {/* Section: today — biggest header since it's the primary
          focus of the page. */}
      <Section
        title="Hôm nay"
        titleClassName="text-xl sm:text-2xl"
        emptyHint="Hôm nay không có giỗ, sinh nhật hay lễ tết nào."
        events={todayEvents}
        clanId={clan.id}
        emphasised
      />

      {/* Section: this week */}
      <Section
        title="7 ngày tới"
        emptyHint="Không có sự kiện nào trong tuần."
        events={weekEvents}
        clanId={clan.id}
      />

      {/* Section: this month */}
      <Section
        title="30 ngày tới"
        emptyHint="Không có sự kiện nào trong tháng."
        events={monthEvents}
        clanId={clan.id}
      />

      <div className="rounded-md border bg-card p-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        {effectiveRole(clan) !== null ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconBell className="h-4 w-4" />
            <span>Bật nhắc qua email ở trang Sự kiện hoặc trên từng người.</span>
          </div>
        ) : (
          <div className="text-muted-foreground">
            Bạn đang xem dòng họ ở chế độ công khai.
          </div>
        )}
        <Link
          to={`/clans/${clan.id}/events`}
          className="text-sm text-primary hover:underline whitespace-nowrap"
        >
          Xem toàn bộ lịch →
        </Link>
      </div>
    </div>
  );
}

// ─── Section helper ───────────────────────────────────────────────

function Section({
  title,
  titleClassName,
  events,
  clanId,
  emptyHint,
  emphasised,
}: {
  title: string;
  titleClassName?: string;
  events: UpcomingEvent[];
  clanId: string;
  emptyHint: string;
  emphasised?: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={`font-semibold ${titleClassName ?? "text-lg"}`}>
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {events.length === 0 ? "—" : `${events.length} sự kiện`}
        </span>
      </div>
      {events.length === 0 ? (
        <Alert>
          <AlertDescription>{emptyHint}</AlertDescription>
        </Alert>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.key}>
              <UpcomingEventRow
                event={e}
                clanId={clanId}
                emphasised={emphasised}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Date header (today's solar + lunar) ─────────────────────────

function formatTodayHeader(): string {
  const now = new Date();
  const solarIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const solar = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lunar = solarStringToLunar(solarIso);
  const lunarText = formatLunarDate(lunar);
  return lunarText ? `${solar} · ${lunarText}` : solar;
}


/** Hôm nay theo GIỜ MÁY người dùng — lễ tết là chuyện của lịch địa phương. */
function todayIso(): string {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
