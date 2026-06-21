import { Link } from "react-router-dom";

import {
  formatCanChiShort,
  getCanChiForSolarDate,
} from "@/lib/lunarDate";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

interface Props {
  event: UpcomingEvent;
  clanId: string;
  /**
   * When true, render at full prominence (used for "Hôm nay" rows on
   * the Today page). Bumps the calendar tile, adds a subtle accent
   * border, and removes the countdown badge (always "Hôm nay").
   */
  emphasised?: boolean;
}

/**
 * One upcoming event row — used by the Events page and the Today
 * page. Calendar tile (Th/day) on the left, title + kind + cần chi
 * in the middle, countdown badge on the right. Clicking navigates
 * to the person's detail page when the event is tied to one.
 */
export function UpcomingEventRow({ event, clanId, emphasised }: Props) {
  const dt = new Date(event.date + "T00:00:00");
  const day = dt.getDate();
  const month = dt.getMonth() + 1;
  const countdown =
    event.daysUntil === 0
      ? "Hôm nay"
      : event.daysUntil === 1
        ? "Ngày mai"
        : `Còn ${event.daysUntil} ngày`;
  const canChi = getCanChiForSolarDate(event.date);

  const inner = (
    <div
      className={`flex items-center justify-between gap-3 p-3 sm:p-4 rounded-md border bg-card hover:border-primary transition-colors ${
        emphasised ? "border-primary/40 shadow-sm bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div
          className={`flex-shrink-0 text-center rounded-md ${
            emphasised
              ? "w-16 py-1 bg-primary/10"
              : "w-14"
          }`}
        >
          <div className="text-xs text-muted-foreground">Th {month}</div>
          <div
            className={`font-semibold leading-none ${
              emphasised
                ? "text-3xl text-primary mt-0.5"
                : "text-2xl"
            }`}
          >
            {day}
          </div>
        </div>
        <div className="min-w-0">
          <p
            className={`font-semibold line-clamp-2 ${
              emphasised ? "text-lg" : "text-base"
            }`}
          >
            {event.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {kindLabel(event.kind)}
            {event.subtitle ? ` • ${event.subtitle}` : ""}
          </p>
          {canChi && (
            <p className="text-xs text-muted-foreground/80 truncate">
              {formatCanChiShort(canChi)}
            </p>
          )}
        </div>
      </div>
      {!emphasised && (
        <span
          className={`text-sm whitespace-nowrap ${
            event.daysUntil <= 1
              ? "text-primary font-semibold"
              : event.daysUntil <= 7
                ? "text-accent font-medium"
                : "text-muted-foreground"
          }`}
        >
          {countdown}
        </span>
      )}
    </div>
  );

  if (event.restingPlaceId) {
    return (
      <Link to={`/clans/${clanId}/graves/${event.restingPlaceId}`} className="block">
        {inner}
      </Link>
    );
  }
  if (event.personId) {
    return (
      <Link to={`/clans/${clanId}/people/${event.personId}`} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function kindLabel(k: UpcomingEvent["kind"]): string {
  switch (k) {
    case "birthday":
      return "Sinh nhật";
    case "anniversary":
      return "Ngày giỗ";
    case "tomb_visit":
      return "Tảo mộ / Chạp họ";
    case "custom":
      return "Sự kiện";
  }
}
