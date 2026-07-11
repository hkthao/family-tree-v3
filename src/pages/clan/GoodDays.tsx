import type { ComponentType } from "react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import {
  IconBuildings,
  IconCalendar,
  IconFlame,
  IconGrave,
  IconHelp,
  IconHome,
  IconMapPin,
  IconScroll,
  IconSparkles,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ACTIVITIES,
  type ActivityKey,
  type DayInfo,
  findGoodDays,
} from "@/lib/almanac";

/** Icon outline cho từng loại việc (thay emoji) — dùng bộ icon của app. */
const ACTIVITY_ICON: Record<
  ActivityKey | "all",
  ComponentType<{ className?: string }>
> = {
  all: IconCalendar,
  "cuoi-hoi": IconUsers,
  "nhap-trach": IconHome,
  "dong-tho": IconBuildings,
  "khai-truong": IconWallet,
  "xuat-hanh": IconMapPin,
  "an-tang": IconGrave,
  "cung-le": IconFlame,
  "ky-ket": IconScroll,
};

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
  { key: "7", label: "7 ngày" },
  { key: "30", label: "30 ngày" },
  { key: "90", label: "3 tháng" },
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
            Icon={ACTIVITY_ICON.all}
            label="Tất cả ngày tốt"
          />
          {ACTIVITIES.map((a) => (
            <ActivityButton
              key={a.key}
              active={activity === a.key}
              onClick={() => setActivity(a.key)}
              Icon={ACTIVITY_ICON[a.key]}
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
        <div className="grid grid-cols-4 gap-2">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`whitespace-nowrap rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors sm:text-base ${
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
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <span className="shrink-0 text-muted-foreground">Từ</span>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1.5"
            />
            <span className="shrink-0 text-muted-foreground">đến</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="min-w-0 flex-1 rounded-md border bg-card px-2 py-1.5"
            />
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
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: ComponentType<{ className?: string }>;
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
      <Icon className="h-5 w-5 shrink-0" />
      <span className="leading-tight">{label}</span>
    </button>
  );
}

// ─── Một hàng ngày đẹp ────────────────────────────────────────────

function GoodDayRow({ day }: { day: DayInfo }) {
  // Giờ tốt rút gọn còn TÊN CHI ("Tý (23h–1h)" → "Tý") cho danh sách gọn.
  const goodChi = day.aus.goodHours.map((h) => h.split(" (")[0]);
  const [showWhy, setShowWhy] = useState(false);

  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3">
      {/* Tờ lịch dương — gọn */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-md bg-primary/5 py-1 text-primary">
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {WEEKDAYS_SHORT[day.weekday]}
        </span>
        <span className="text-2xl font-bold leading-none tabular-nums">
          {day.solar.day}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Th{day.solar.month}
        </span>
      </div>

      {/* Chi tiết — mỗi thông tin 1 dòng, không ô bọc */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {WEEKDAYS_FULL[day.weekday]}, {day.solar.day}/{day.solar.month}
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Ngày tốt
          </span>

          {/* Nút (?) — bấm để xem lý do vì sao là ngày tốt (tooltip). */}
          <span className="relative">
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              aria-label="Vì sao là ngày tốt?"
              aria-expanded={showWhy}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <IconHelp className="h-4 w-4" />
            </button>
            {showWhy && (
              <>
                {/* Nền trong suốt bắt click ra ngoài để đóng. */}
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setShowWhy(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  role="tooltip"
                  className="absolute left-0 top-7 z-20 w-64 rounded-lg border bg-card p-3 text-sm leading-relaxed shadow-lg"
                >
                  <span className="mb-0.5 block font-semibold text-primary">
                    Vì sao đẹp?
                  </span>
                  {day.reason}
                </div>
              </>
            )}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Âm lịch {day.lunar.day}/{day.lunar.month}
          {day.lunar.leap ? " (nhuận)" : ""} · Trực {day.truc.name} · Năm{" "}
          {day.canChi.year}
        </p>

        {goodChi.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Giờ tốt: {goodChi.join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}
