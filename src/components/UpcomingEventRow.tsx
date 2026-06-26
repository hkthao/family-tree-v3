import type { ReactNode } from "react";
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
  /**
   * "row" (default) = ngang, cho danh sách 1 cột. "card" = dọc, đều
   * chiều cao, cho chế độ xem lưới nhiều cột.
   */
  variant?: "row" | "card";
  /**
   * Khi sự kiện là của dòng họ (custom / tảo mộ, có eventId) → bấm sẽ
   * MỞ CHI TIẾT SỰ KIỆN thay vì nhảy sang trang người liên quan.
   */
  onOpenEvent?: (eventId: string) => void;
}

/** Lớp màu cho nhãn "Còn N ngày" theo độ gấp. */
function countdownClass(daysUntil: number): string {
  return daysUntil <= 1
    ? "text-primary font-semibold"
    : daysUntil <= 7
      ? "text-accent font-medium"
      : "text-muted-foreground";
}

/**
 * One upcoming event row — used by the Events page and the Today
 * page. Calendar tile (Th/day) on the left, title + kind + cần chi
 * in the middle, countdown badge on the right. Clicking navigates
 * to the person's detail page when the event is tied to one.
 */
export function UpcomingEventRow({
  event,
  clanId,
  emphasised,
  variant = "row",
  onOpenEvent,
}: Props) {
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

  const wrap = (node: ReactNode) => {
    // Sự kiện của dòng họ (có eventId) → mở chi tiết sự kiện.
    if (event.eventId && onOpenEvent)
      return (
        <button
          type="button"
          onClick={() => onOpenEvent(event.eventId!)}
          className="block h-full w-full text-left"
        >
          {node}
        </button>
      );
    if (event.restingPlaceId)
      return (
        <Link to={`/clans/${clanId}/graves/${event.restingPlaceId}`} className="block h-full">
          {node}
        </Link>
      );
    if (event.personId)
      return (
        <Link to={`/clans/${clanId}/people/${event.personId}`} className="block h-full">
          {node}
        </Link>
      );
    return node;
  };

  // ── Card dọc (chế độ lưới) ──────────────────────────────────────
  if (variant === "card") {
    return wrap(
      <div className="flex h-full flex-col gap-2 p-4 rounded-lg border bg-card hover:border-primary transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-shrink-0 w-12 text-center rounded-md bg-muted/40 py-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Th {month}
            </div>
            <div className="text-2xl font-semibold leading-none">{day}</div>
          </div>
          <span className={`text-xs whitespace-nowrap ${countdownClass(event.daysUntil)}`}>
            {countdown}
          </span>
        </div>
        <p className="font-semibold leading-snug line-clamp-2">{event.title}</p>
        <div className="mt-auto">
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
      </div>,
    );
  }

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
        <span className={`text-sm whitespace-nowrap ${countdownClass(event.daysUntil)}`}>
          {countdown}
        </span>
      )}
    </div>
  );

  return wrap(inner);
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
