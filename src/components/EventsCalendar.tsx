import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import {
  formatCanChiShort,
  formatLunarDate,
  getCanChiForSolarDate,
  solarStringToLunar,
} from "@/lib/lunarDate";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

import { t } from "@lingui/core/macro";
interface Props {
  events: UpcomingEvent[];
  clanId: string;
  /** Sự kiện của họ (có eventId) → bấm mở chi tiết thay vì sang trang người. */
  onOpenEvent?: (eventId: string) => void;
  /** Trang dòng họ công khai: không dẫn sang trang người trong app. */
  readOnly?: boolean;
}

const VN_MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];
const VN_WEEKDAYS = [
  ["T2", "Thứ hai"],
  ["T3", "Thứ ba"],
  ["T4", "Thứ tư"],
  ["T5", "Thứ năm"],
  ["T6", "Thứ sáu"],
  ["T7", "Thứ bảy"],
  ["CN", "CN"],
] as const;

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
    case "festival":
      return "bg-rose-500";
  }
}

function kindLabel(k: UpcomingEvent["kind"]): string {
  switch (k) {
    case "birthday":
      return t`Sinh nhật`;
    case "anniversary":
      return t`Ngày giỗ`;
    case "festival":
      return t`Lễ, tết`;
    case "tomb_visit":
      return t`Tảo mộ / Chạp họ`;
    case "custom":
      return t`Sự kiện`;
  }
}

export function EventsCalendar({
  events,
  clanId,
  onOpenEvent,
  readOnly,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const todayIso = isoOf(today);

  const [view, setView] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selected, setSelected] = useState<string | null>(todayIso);
  const [panelOpen, setPanelOpen] = useState(false);

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
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i,
      );
      return d;
    });
  }, [view]);

  const dayEvents = selected ? (eventsByDay.get(selected) ?? []) : [];
  const selectedLunar = selected
    ? formatLunarDate(solarStringToLunar(selected))
    : undefined;

  return (
    <div className="space-y-4">
      {/* Lịch tháng kiểu tờ lịch: thanh tiêu đề tháng (mũi tên + Hôm nay), hàng thứ, ô có ngày dương (to), ngày âm (nhỏ, giữa), can chi ngày. */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 bg-primary px-2 py-2 text-primary-foreground">
          <button
            type="button"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/15"
            aria-label={t`Tháng trước`}
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
            <h3 className="truncate text-center text-sm font-bold uppercase tracking-wide sm:text-base">
              {VN_MONTHS[view.getMonth()]} {view.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                t.setDate(1);
                setView(t);
                setSelected(todayIso);
              }}
              className="shrink-0 rounded-md border border-white/40 px-2 py-0.5 text-xs hover:bg-white/15"
            >
              {t`Hôm nay`}
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/15"
            aria-label={t`Tháng sau`}
          >
            <IconArrowRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 bg-primary/85 text-primary-foreground">
          {VN_WEEKDAYS.map(([short, long], i) => (
            <div
              key={long}
              className={`py-1.5 text-center text-[11px] font-bold uppercase tracking-wide sm:text-xs ${i === 6 ? "text-amber-200" : ""}`}
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{long}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border">
          {cells.map((d, i) => {
            const iso = isoOf(d);
            const isThisMonth = d.getMonth() === view.getMonth();
            const isToday = iso === todayIso;
            const isSelected = iso === selected;
            const isSunday = i % 7 === 6;
            const dayEvts = eventsByDay.get(iso) ?? [];
            const lunar = solarStringToLunar(iso);
            const canChi = getCanChiForSolarDate(iso);
            const lunarLabel = lunar
              ? lunar.day === 1
                ? `${lunar.day}/${lunar.month}${lunar.isLeap ? "n" : ""}`
                : String(lunar.day)
              : "";
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelected(iso);
                  setPanelOpen(true);
                }}
                aria-pressed={isSelected}
                aria-label={`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`}
                className={`relative flex min-h-[3.75rem] flex-col items-center px-1 pb-1 pt-0.5 text-left sm:min-h-[5.25rem] ${
                  isToday
                    ? "bg-primary/10"
                    : isThisMonth
                      ? "bg-card hover:bg-muted/40"
                      : "bg-muted/30"
                } ${isSelected ? "z-10 outline outline-2 -outline-offset-2 outline-primary" : ""} ${isThisMonth ? "" : "opacity-50"}`}
              >
                <span className="flex w-full items-start justify-between">
                  <span
                    className={`text-base font-bold leading-tight sm:text-lg ${
                      isToday || isSunday ? "text-primary" : ""
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {dayEvts.length > 0 && (
                    <span className="mt-1 flex items-center gap-0.5">
                      {dayEvts.slice(0, 3).map((e, ix) => (
                        <span
                          key={ix}
                          className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${kindColor(e.kind)}`}
                        />
                      ))}
                      {dayEvts.length > 3 && (
                        <span className="text-[9px] leading-none text-muted-foreground">
                          +{dayEvts.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] leading-tight sm:text-xs ${
                    lunar?.day === 1
                      ? "font-semibold text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {lunarLabel}
                </span>
                {canChi && (
                  <span className="mt-auto hidden text-center text-[10px] leading-tight text-muted-foreground sm:block">
                    {canChi.day}
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
          {t`Sinh nhật`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {t`Ngày giỗ`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground" />
          {t`Sự kiện tuỳ chỉnh`}
        </span>
      </div>

      {/* Chi tiết ngày bấm: ngăn kéo bên phải (không đẩy trang dài ra, dễ đọc trên điện thoại). */}
      <SidePanel
        open={panelOpen && !!selected}
        onClose={() => setPanelOpen(false)}
        title={selected ? formatDateHeader(selected, todayIso) : ""}
        subtitle={selectedLunar}
        guard={false}
      >
        {dayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t`Không có sự kiện ngày này.`}
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
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel(e.kind)}
                      {cc ? ` · ${formatCanChiShort(cc)}` : ""}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={e.key}>
                  {e.eventId && onOpenEvent && !readOnly ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPanelOpen(false);
                        onOpenEvent(e.eventId!);
                      }}
                      className="block w-full text-left"
                    >
                      {inner}
                    </button>
                  ) : e.personId && !readOnly ? (
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
      </SidePanel>
    </div>
  );
}

function formatDateHeader(iso: string, todayIso: string): string {
  const d = new Date(iso + "T00:00:00");
  const label = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  if (iso === todayIso) return t`Hôm nay — ${label}`;
  return label;
}
