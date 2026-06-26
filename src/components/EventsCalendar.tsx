import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { formatCanChiShort, getCanChiForSolarDate } from "@/lib/lunarDate";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

interface Props {
  events: UpcomingEvent[];
  clanId: string;
  /** Sự kiện của họ (có eventId) → bấm mở chi tiết thay vì sang trang người. */
  onOpenEvent?: (eventId: string) => void;
}

const VN_MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];
const VN_WEEKDAYS = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"];

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Vietnamese weekday index — 0 = Mon, 6 = Sun. (JS Date.getDay() puts
 * Sun = 0 / Mon = 1; we shift so the first column is Monday.)
 */
function vnWeekday(d: Date): number {
  const js = d.getDay();
  return (js + 6) % 7;
}

function kindColor(kind: UpcomingEvent["kind"]): string {
  switch (kind) {
    case "birthday":
      return "bg-accent";
    case "anniversary":
      return "bg-primary";
    case "tomb_visit":
      return "bg-amber-600";
    case "custom":
      return "bg-foreground";
  }
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

export function EventsCalendar({ events, clanId, onOpenEvent }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayIso = isoOf(today);

  const [view, setView] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selected, setSelected] = useState<string | null>(todayIso);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, UpcomingEvent[]>();
    for (const e of events) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [events]);

  // Build the 6×7 grid for the current month.
  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const offset = vnWeekday(firstOfMonth); // 0..6 leading days to fill from prev month
    const start = new Date(year, month, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return d;
    });
  }, [view]);

  const dayEvents = selected ? (eventsByDay.get(selected) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold">
          {VN_MONTHS[view.getMonth()]} {view.getFullYear()}
        </h3>
        <div className="inline-flex rounded-md border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
            }
            className="h-9 px-3 text-sm hover:bg-muted/50 inline-flex items-center gap-1"
            aria-label="Tháng trước"
          >
            <IconArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              t.setDate(1);
              setView(t);
              setSelected(todayIso);
            }}
            className="h-9 px-3 text-sm border-l hover:bg-muted/50"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
            }
            className="h-9 px-3 text-sm border-l hover:bg-muted/50 inline-flex items-center gap-1"
            aria-label="Tháng sau"
          >
            <IconArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-md border bg-card p-2">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {VN_WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[11px] font-medium text-muted-foreground py-1"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const iso = isoOf(d);
            const isThisMonth = d.getMonth() === view.getMonth();
            const isToday = iso === todayIso;
            const isSelected = iso === selected;
            const dayEvts = eventsByDay.get(iso) ?? [];
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(iso)}
                aria-pressed={isSelected}
                className={`
                  relative h-14 rounded-md border text-sm flex flex-col items-stretch
                  ${isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-divider hover:bg-muted/40"}
                  ${isThisMonth ? "" : "opacity-40"}
                `}
              >
                <span
                  className={`pt-1 text-center ${
                    isToday ? "text-primary font-semibold" : ""
                  }`}
                >
                  {d.getDate()}
                </span>
                {dayEvts.length > 0 && (
                  <span className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
                    {dayEvts.slice(0, 3).map((e, ix) => (
                      <span
                        key={ix}
                        className={`h-1.5 w-1.5 rounded-full ${kindColor(e.kind)}`}
                      />
                    ))}
                    {dayEvts.length > 3 && (
                      <span className="text-[9px] text-muted-foreground leading-none">
                        +{dayEvts.length - 3}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Sinh nhật
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Ngày giỗ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground" />
          Sự kiện tuỳ chỉnh
        </span>
      </div>

      {/* Selected day's events */}
      {selected && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            {formatDateHeader(selected, todayIso)}
          </h4>
          {dayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có sự kiện ngày này.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {dayEvents.map((e) => {
                const cc = getCanChiForSolarDate(e.date);
                const inner = (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-md border bg-card hover:border-primary transition-colors">
                    <span
                      className={`h-2 w-2 rounded-full ${kindColor(e.kind)} shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {kindLabel(e.kind)}
                        {cc ? ` · ${formatCanChiShort(cc)}` : ""}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={e.key}>
                    {e.eventId && onOpenEvent ? (
                      <button
                        type="button"
                        onClick={() => onOpenEvent(e.eventId!)}
                        className="block w-full text-left"
                      >
                        {inner}
                      </button>
                    ) : e.personId ? (
                      <Link
                        to={`/clans/${clanId}/people/${e.personId}`}
                        className="block"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatDateHeader(iso: string, todayIso: string): string {
  const d = new Date(iso + "T00:00:00");
  const label = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  if (iso === todayIso) return `Hôm nay — ${label}`;
  return label;
}
