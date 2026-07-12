import type { ComponentType } from "react";
import { useMemo, useState } from "react";

import {
  AlmanacDisplayToggles,
  type AlmanacPrefs,
  useAlmanacPrefs,
} from "@/components/AlmanacDisplayToggles";
import { PageHeader } from "@/components/PageHeader";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBuildings,
  IconCalendar,
  IconFlame,
  IconGrave,
  IconHelp,
  IconHome,
  IconMapPin,
  IconScroll,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ACTIVITIES,
  type ActivityKey,
  type DayInfo,
  describeDay,
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
  const { prefs, toggle } = useAlmanacPrefs();
  const [showOpts, setShowOpts] = useState(false);

  // Lịch tháng + ngày đang xem chi tiết.
  const [selectedIso, setSelectedIso] = useState(today);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

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
        icon={<IconCalendar className="h-7 w-7" />}
        title="Lịch âm dương & xem ngày"
        description="Xem lịch âm–dương từng tháng, chi tiết ngày tốt/xấu, và tìm ngày đẹp cho việc lớn."
      />

      {/* Tuỳ chọn hiển thị — bật/tắt từng loại thông tin cho gọn. */}
      <div>
        <button
          type="button"
          onClick={() => setShowOpts((v) => !v)}
          className="text-sm text-primary hover:underline"
        >
          ⚙ Tuỳ chọn hiển thị {showOpts ? "▲" : "▼"}
        </button>
        {showOpts && (
          <div className="mt-2 rounded-lg border bg-muted/20 p-3">
            <AlmanacDisplayToggles prefs={prefs} toggle={toggle} />
          </div>
        )}
      </div>

      {/* Lịch tháng âm–dương — bấm một ngày để xem chi tiết bên dưới. */}
      <MonthCalendar
        cursor={cursor}
        setCursor={setCursor}
        selectedIso={selectedIso}
        todayIso={today}
        onSelect={setSelectedIso}
      />

      {/* Chi tiết ngày đang chọn (tốt/xấu, giờ, ngũ hành, sao…). */}
      <DayDetail iso={selectedIso} prefs={prefs} />

      {/* ─── Công cụ tìm ngày đẹp cho một việc ─────────────────── */}
      <div className="border-t pt-4">
        <h2 className="mb-1 text-lg font-semibold">Tìm ngày đẹp cho việc lớn</h2>
        <p className="text-sm text-muted-foreground">
          Chọn việc và khoảng thời gian, hệ thống liệt kê sẵn những ngày đẹp.
        </p>
      </div>

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
              <GoodDayRow key={d.iso} day={d} prefs={prefs} />
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

// ─── Lịch tháng âm–dương ──────────────────────────────────────────

const CAL_WEEKDAYS = ["T.Hai", "T.Ba", "T.Tư", "T.Năm", "T.Sáu", "T.Bảy", "CN"];

function MonthCalendar({
  cursor,
  setCursor,
  selectedIso,
  todayIso,
  onSelect,
}: {
  cursor: { y: number; m: number };
  setCursor: (c: { y: number; m: number }) => void;
  selectedIso: string;
  todayIso: string;
  onSelect: (iso: string) => void;
}) {
  const { y, m } = cursor;
  const cells = useMemo(() => {
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Thứ Hai đầu tuần
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const arr: ({ iso: string; day: number; info: DayInfo | null } | null)[] =
      [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
      arr.push({ iso, day: d, info: describeDay(iso) });
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [y, m]);

  const goMonth = (delta: number) => {
    const d = new Date(y, m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const ty = Number(todayIso.slice(0, 4));
  const tm = Number(todayIso.slice(5, 7)) - 1;
  const atCurrent = y === ty && m === tm;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2 py-2">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          aria-label="Tháng trước"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">
            Tháng {m + 1}/{y}
          </span>
          {!atCurrent && (
            <button
              type="button"
              onClick={() => setCursor({ y: ty, m: tm })}
              className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Về tháng này
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => goMonth(1)}
          aria-label="Tháng sau"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <IconArrowRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b text-center text-xs font-semibold text-muted-foreground">
        {CAL_WEEKDAYS.map((w) => (
          <div key={w} className="py-1.5">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          if (!c) {
            return (
              <div
                key={`e${i}`}
                className="aspect-square border-b border-r bg-muted/10"
              />
            );
          }
          const good = c.info?.aus.good;
          const selected = c.iso === selectedIso;
          const isToday = c.iso === todayIso;
          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => onSelect(c.iso)}
              className={`relative flex aspect-square flex-col items-center justify-center border-b border-r p-0.5 transition-colors ${
                good
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "bg-rose-500/10 hover:bg-rose-500/20"
              } ${selected ? "ring-2 ring-inset ring-primary" : ""}`}
            >
              <span
                className={`text-sm font-bold leading-none tabular-nums sm:text-base ${
                  isToday ? "text-primary underline" : ""
                }`}
              >
                {c.day}
              </span>
              <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                {c.info
                  ? c.info.lunar.day === 1
                    ? `1/${c.info.lunar.month}`
                    : c.info.lunar.day
                  : ""}
              </span>
              {c.info && c.info.warnings.length > 0 && (
                <span
                  className="absolute right-1 top-1 text-rose-500"
                  title="Ngày kiêng dân gian"
                >
                  •
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/40" />
          Ngày tốt (hoàng đạo)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/40" />
          Ngày xấu (hắc đạo)
        </span>
        <span className="flex items-center gap-1">
          <span className="text-rose-500">•</span> Ngày kiêng
        </span>
      </div>
    </section>
  );
}

// ─── Chi tiết một ngày (tốt/xấu, giờ, ngũ hành, sao…) ──────────────

function DayDetail({ iso, prefs }: { iso: string; prefs: AlmanacPrefs }) {
  const info = describeDay(iso);
  if (!info) return null;
  const goodChi = info.aus.goodHours.map((h) => h.split(" (")[0]);
  const badChi = info.aus.badHours.map((h) => h.split(" (")[0]);
  const meta = [
    prefs.truc ? `Trực ${info.truc.name}` : null,
    prefs.tu ? `Sao ${info.tu.short}` : null,
    prefs.tietKhi && info.tietKhi ? `Tiết ${info.tietKhi}` : null,
    `Ngũ hành ${info.napAm}`,
  ].filter(Boolean);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      {/* Đầu: dương lịch + âm lịch to */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS_FULL[info.weekday]}
          </p>
          <p className="text-4xl font-bold leading-none tabular-nums text-primary">
            {info.solar.day}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Th{info.solar.month}/{info.solar.year} (DL)
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Âm lịch
          </p>
          <p className="text-4xl font-bold leading-none tabular-nums text-emerald-600 dark:text-emerald-400">
            {info.lunar.day}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Th{info.lunar.month}
            {info.lunar.leap ? " nhuận" : ""} · {info.canChi.year}
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {prefs.hoangDao && (
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                info.aus.good
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              {info.aus.good ? "Ngày tốt (Hoàng đạo)" : "Ngày xấu (Hắc đạo)"}
            </span>
          )}
          <p className="text-sm text-muted-foreground">
            Can chi: ngày {info.canChi.day} · tháng {info.canChi.month} · năm{" "}
            {info.canChi.year}
          </p>
          {meta.length > 0 && (
            <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
          )}
        </div>
      </div>

      {/* Cảnh báo ngày kiêng */}
      {prefs.kieng && info.warnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {info.warnings.map((w) => (
            <span
              key={w.key}
              title={w.note}
              className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400"
            >
              ⚠ {w.label}
            </span>
          ))}
        </div>
      )}

      {/* Vì sao tốt/xấu */}
      <div
        className={`rounded-lg border-l-4 p-3 text-sm leading-relaxed ${
          info.aus.good
            ? "border-emerald-500 bg-emerald-500/5"
            : "border-amber-500 bg-amber-500/5"
        }`}
      >
        <span className="font-semibold">Vì sao? </span>
        {info.reason}
      </div>

      {/* Giờ hoàng đạo / hắc đạo */}
      {prefs.hoangDao && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Giờ hoàng đạo (tốt)
            </p>
            <p className="text-sm text-foreground/80">{goodChi.join(" · ")}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
              Giờ hắc đạo (tránh)
            </p>
            <p className="text-sm text-foreground/80">{badChi.join(" · ")}</p>
          </div>
        </div>
      )}

      {/* Việc nên / kiêng theo trực */}
      {prefs.truc && (info.nen.length > 0 || info.kieng.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {info.nen.length > 0 && (
            <div>
              <p className="mb-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Nên làm
              </p>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {info.nen.join(" · ")}
              </p>
            </div>
          )}
          {info.kieng.length > 0 && (
            <div>
              <p className="mb-0.5 text-sm font-bold text-rose-600 dark:text-rose-400">
                ✕ Nên tránh
              </p>
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                {info.kieng.join(" · ")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Nhị thập bát tú */}
      {prefs.tu && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">
            Sao {info.tu.name}
          </span>{" "}
          ({info.tu.good ? "cát tinh" : "hung tinh"}) — {info.tu.note}
        </p>
      )}
    </section>
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

function GoodDayRow({ day, prefs }: { day: DayInfo; prefs: AlmanacPrefs }) {
  // Giờ tốt rút gọn còn TÊN CHI ("Tý (23h–1h)" → "Tý") cho danh sách gọn.
  const goodChi = day.aus.goodHours.map((h) => h.split(" (")[0]);
  const [showWhy, setShowWhy] = useState(false);

  // Dòng thông tin phụ ghép theo tuỳ chọn hiển thị.
  const meta = [
    `Âm lịch ${day.lunar.day}/${day.lunar.month}${day.lunar.leap ? " (nhuận)" : ""}`,
    prefs.truc ? `Trực ${day.truc.name}` : null,
    prefs.tu ? `Sao ${day.tu.short}` : null,
    prefs.tietKhi && day.tietKhi ? `Tiết ${day.tietKhi}` : null,
    `Năm ${day.canChi.year}`,
  ].filter(Boolean);

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
                  {prefs.tu && (
                    <span className="mt-1.5 block text-muted-foreground">
                      Sao {day.tu.name} (
                      {day.tu.good ? "cát tinh" : "hung tinh"}) — {day.tu.note}
                    </span>
                  )}
                </div>
              </>
            )}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>

        {prefs.hoangDao && goodChi.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Giờ tốt: {goodChi.join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}
