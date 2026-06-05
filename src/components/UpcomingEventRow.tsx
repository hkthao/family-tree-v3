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
      className={`flex items-center justify-between gap-3 p-3 rounded-md border bg-card hover:border-primary transition-colors ${
        emphasised ? "border-primary/40 shadow-sm" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex-shrink-0 text-center ${
            emphasised ? "w-14" : "w-12"
          }`}
        >
          <div className="text-xs text-muted-foreground">Th {month}</div>
          <div
            className={`font-semibold leading-none ${
              emphasised ? "text-2xl text-primary" : "text-xl"
            }`}
          >
            {day}
          </div>
        </div>
        <div className="min-w-0">
          <p
            className={`font-medium truncate ${
              emphasised ? "text-base" : ""
            }`}
          >
            {event.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {kindLabel(event.kind)}
            {event.subtitle ? ` • ${event.subtitle}` : ""}
          </p>
          {canChi && (
            <p className="text-[11px] text-muted-foreground/80 truncate">
              {formatCanChiShort(canChi)}
            </p>
          )}
        </div>
      </div>
      {!emphasised && (
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
      )}
    </div>
  );

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
    case "custom":
      return "Sự kiện";
  }
}
