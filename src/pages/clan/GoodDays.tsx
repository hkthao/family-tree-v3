import { useMemo, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { IconSparkles } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ACTIVITIES,
  type ActivityKey,
  type DayInfo,
  findGoodDays,
} from "@/lib/almanac";

const WEEKDAYS_SHORT = [
  "CN", "T.Hai", "T.Ba", "T.Tư", "T.Năm", "T.Sáu", "T.Bảy",
];
const WEEKDAYS_FULL = [
  "Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + n));
}

type RangeMode = "7" | "30" | "90" | "custom";

const RANGE_OPTIONS: { key: RangeMode; label: string }[] = [
  { key: "7", label: "7 ngày tới" },
  { key: "30", label: "30 ngày tới" },
  { key: "90", label: "3 tháng tới" },
  { key: "custom", label: "Tùy chọn" },
];

/**
 * Trang "Xem ngày tốt" — liệt kê các NGÀY ĐẸP cho một việc lớn (cưới hỏi,
 * làm nhà, khai trương…) trong khoảng thời gian chọn (7/30/90 ngày tới hoặc
 * tùy chọn). Bố cục chữ to, nút to, badge màu rõ — dễ dùng cho người lớn tuổi.
 *
 * Ngày đẹp = tính từ lịch cổ truyền: 12 trực (việc nên/kiêng) + ngày hoàng
 * đạo. Xem src/lib/almanac.ts.
 */
export default function GoodDays() {
  const today = useMemo(() => isoOf(new Date()), []);

  const [activity, setActivity] = useState<ActivityKey | "all">("cuoi-hoi");
  const [range, setRange] = useState<RangeMode>("30");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(addDays(today, 60));

  const { startIso, endIso } = useMemo(() => {
    if (range === "custom") {
      return { startIso: customFrom, endIso: customTo };
    }
    return { startIso: today, endIso: addDays(today, Number(range) - 1) };
  }, [range, customFrom, customTo, today]);

  const results = useMemo(
    () =>
      findGoodDays(
        startIso,
        endIso,
        activity === "all" ? undefined : activity,
      ),
    [startIso, endIso, activity],
  );

  const activityLabel =
    activity === "all"
      ? "ngày tốt chung"
      : ACTIVITIES.find((a) => a.key === activity)?.label.toLowerCase();

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconSparkles className="h-7 w-7" />}
        title="Xem ngày tốt"
        description="Chọn việc và khoảng thời gian để tìm những ngày đẹp."
      />

      {/* BƯỚC 1 — Chọn việc. Nút to, có emoji, dễ bấm. */}
      <section className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">
          1. Bạn muốn xem ngày cho việc gì?
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ActivityButton
            active={activity === "all"}
            onClick={() => setActivity("all")}
            emoji="🗓️"
            label="Tất cả ngày tốt"
          />
          {ACTIVITIES.map((a) => (
            <ActivityButton
              key={a.key}
              active={activity === a.key}
              onClick={() => setActivity(a.key)}
              emoji={a.emoji}
              label={a.label}
            />
          ))}
        </div>
      </section>

      {/* BƯỚC 2 — Chọn khoảng thời gian. */}
      <section className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">
          2. Trong khoảng thời gian nào?
        </p>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`rounded-lg border px-4 py-2.5 text-base font-medium transition-colors ${
                range === r.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Từ ngày</span>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border bg-card px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Đến ngày</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border bg-card px-3 py-2 text-base"
              />
            </label>
          </div>
        )}
      </section>

      {/* KẾT QUẢ */}
      <section className="space-y-3">
        <p className="text-base">
          {results.length > 0 ? (
            <>
              Có <strong className="text-primary">{results.length}</strong> ngày
              đẹp cho <strong>{activityLabel}</strong>.
            </>
          ) : (
            <>Không tìm thấy ngày đẹp phù hợp trong khoảng này.</>
          )}
        </p>

        {results.length === 0 ? (
          <Alert>
            <AlertDescription>
              Thử mở rộng khoảng thời gian hoặc chọn việc khác. Những ngày còn
              lại là ngày bình thường hoặc nên tránh cho việc này.
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-2.5">
            {results.map((d) => (
              <GoodDayRow key={d.iso} day={d} />
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-md border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
        Ngày tốt tính theo lịch cổ truyền (12 trực chỉ việc nên/kiêng, kết hợp
        ngày hoàng đạo). Đây là thông tin tham khảo theo phong tục, không phải
        lời khuyên bắt buộc — nên cân nhắc thêm tuổi của gia chủ khi làm việc lớn.
      </p>
    </div>
  );
}

// ─── Nút chọn việc ────────────────────────────────────────────────

function ActivityButton({
  active,
  onClick,
  emoji,
  label,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:bg-muted/50"
      }`}
    >
      <span className="text-xl leading-none" aria-hidden="true">
        {emoji}
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

// ─── Một hàng ngày đẹp ────────────────────────────────────────────

function GoodDayRow({ day }: { day: DayInfo }) {
  return (
    <li className="flex items-stretch gap-3 rounded-xl border bg-card p-3">
      {/* Tờ lịch dương — số ngày to */}
      <div className="flex w-[76px] shrink-0 flex-col items-center justify-center rounded-lg border border-primary/25 bg-primary/5 py-2 text-primary">
        <span className="text-xs font-semibold uppercase tracking-wide">
          {WEEKDAYS_SHORT[day.weekday]}
        </span>
        <span className="text-3xl font-bold leading-none tabular-nums">
          {day.solar.day}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Th{day.solar.month}
        </span>
      </div>

      {/* Chi tiết */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">
            {WEEKDAYS_FULL[day.weekday]}, {day.solar.day}/{day.solar.month}/
            {day.solar.year}
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Ngày tốt
          </span>
        </div>

        <p className="mt-0.5 text-sm text-muted-foreground">
          Âm lịch {day.lunar.day}/{day.lunar.month}
          {day.lunar.leap ? " (nhuận)" : ""} · Trực {day.truc.name} · Năm{" "}
          {day.canChi.year}
        </p>

        <p className="mt-1.5 rounded-md border-l-4 border-emerald-500 bg-emerald-500/5 px-2.5 py-1.5 text-sm leading-relaxed text-foreground/90">
          <span className="font-semibold">Vì sao đẹp? </span>
          {day.reason}
        </p>

        {day.aus.goodHours.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground">Giờ tốt:</span>
            {day.aus.goodHours.map((h) => (
              <span
                key={h}
                className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-foreground/80"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
