import { Button } from "@/components/ui/button";
import { UpcomingCompactRow } from "@/components/UpcomingCompactRow";
import { weekdayName } from "@/lib/formatDate";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  AlmanacDisplayToggles,
  useAlmanacPrefs,
} from "@/components/AlmanacDisplayToggles";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconSparkles,
} from "@/components/icons";
import { describeDay } from "@/lib/almanac";
import { festivalsOn } from "@/lib/festivals";
import { listCustomEntries } from "@/lib/queries/customs";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

import { t } from "@lingui/core/macro";

import { Trans } from "@lingui/react/macro";
const COLLAPSE_KEY = "today-hub-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Nhãn tương đối cho ngày đang xem, dễ hiểu cho người lớn tuổi. */
function relativeLabel(offset: number): string {
  if (offset === 0) return t`Hôm nay`;
  if (offset === 1) return t`Ngày mai`;
  if (offset === 2) return t`Ngày kia`;
  if (offset === -1) return t`Hôm qua`;
  if (offset > 0) return t`${offset} ngày nữa`;
  return t`${-offset} ngày trước`;
}

/**
 * Thẻ "Hôm nay" trên Trang chủ — thiết kế như TỜ LỊCH VẠN NIÊN: khối số ngày
 * dương to bên trái, âm lịch + can chi + ngày hoàng đạo/hắc đạo + giờ hoàng đạo
 * bên phải; kèm việc NÊN/KIÊNG (theo trực), giỗ/sinh nhật hôm nay + "Phong tục
 * hôm nay". Có nút ‹ ngày trước / ngày sau › để xem lịch các ngày kế tiếp.
 */
export function TodayHubCard({
  clanId,
  events,
}: {
  clanId: string;
  /** Sự kiện 30 ngày tới (giỗ, sinh nhật, sự kiện tuỳ chỉnh, lễ tết), đã sắp theo ngày — trang cha tính sẵn. */
  events: UpcomingEvent[];
}) {
  // Ba nhóm của trang "Hôm nay" cũ, giờ là ba tab trong thẻ này.
  const todayEvents = useMemo(
    () => events.filter((e) => e.daysUntil === 0),
    [events],
  );
  const weekEvents = useMemo(
    () => events.filter((e) => e.daysUntil >= 1 && e.daysUntil <= 6),
    [events],
  );
  const monthEvents = useMemo(
    () => events.filter((e) => e.daysUntil >= 7 && e.daysUntil <= 29),
    [events],
  );
  const buckets = {
    today: todayEvents,
    week: weekEvents,
    month: monthEvents,
  } as const;
  // Mở sẵn tab đầu tiên có việc (hôm nay → 7 ngày → 30 ngày) để người dùng thấy ngay thứ cần thấy.
  const [tabPick, setTabPick] = useState<"today" | "week" | "month" | null>(
    null,
  );
  const tab: "today" | "week" | "month" =
    tabPick ??
    (todayEvents.length
      ? "today"
      : weekEvents.length
        ? "week"
        : monthEvents.length
          ? "month"
          : "today");
  const shown = buckets[tab];
  // offset = số ngày lệch so với hôm nay (0 = hôm nay). Điều khiển bằng
  // nút ‹ › để xem lịch ngày kế tiếp/trước mà không rời Trang chủ.
  const [offset, setOffset] = useState(0);
  const isToday = offset === 0;
  const { prefs, toggle } = useAlmanacPrefs();
  const [showOpts, setShowOpts] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* bỏ qua: chỉ là tiện ích nhớ trạng thái */
      }
      return !c;
    });

  const view = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const iso = isoOf(view);
  const info = describeDay(iso);
  const festivals = festivalsOn(iso);
  const leap = info?.lunar.leap ? t` nhuận` : "";

  const dayOfYear = useMemo(() => {
    const start = new Date(view.getFullYear(), 0, 0);
    return Math.floor((view.getTime() - start.getTime()) / 86_400_000);
  }, [view]);

  const { data: customs } = useQuery({
    queryKey: ["customs-published-lite"],
    queryFn: () => listCustomEntries({ includeUnpublished: false }),
    staleTime: 6 * 60 * 60 * 1000,
  });
  const tip =
    customs && customs.length ? customs[dayOfYear % customs.length] : null;

  return (
    <section
      aria-label={t`Lịch vạn niên`}
      className="overflow-hidden rounded-xl border bg-card"
    >
      {/* Header 3 cột: [ngày trước/sau] — TIÊU ĐỀ Ở GIỮA — [về hôm nay + thu gọn]. Hai cột bên bằng nhau (1fr)
          nên tiêu đề luôn cân giữa. Nút chỉ icon theo design-language (Button size="icon", có aria-label). */}
      <header
        className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1 bg-muted/30 px-2 py-1.5 sm:px-3 ${collapsed ? "" : "border-b"}`}
      >
        <div
          role="group"
          aria-label={t`Chuyển ngày`}
          className="flex items-center justify-self-start"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10"
            onClick={() => setOffset((o) => o - 1)}
            aria-label={t`Xem ngày hôm trước`}
            title={t`Hôm trước`}
          >
            <IconArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10"
            onClick={() => setOffset((o) => o + 1)}
            aria-label={t`Xem ngày hôm sau`}
            title={t`Hôm sau`}
          >
            <IconArrowRight className="h-5 w-5" />
          </Button>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          className="min-w-0 px-1 py-2 text-center"
        >
          <h3 className="truncate text-base font-semibold text-primary sm:text-lg">
            {relativeLabel(offset)}
          </h3>
        </button>
        <div className="flex items-center justify-self-end">
          {!isToday && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="shrink-0 whitespace-nowrap rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              {t`Về hôm nay`}
            </button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t`Mở rộng lịch` : t`Thu gọn lịch`}
            title={collapsed ? t`Mở rộng` : t`Thu gọn`}
          >
            {collapsed ? (
              <IconChevronDown className="h-5 w-5" />
            ) : (
              <IconChevronUp className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>

      {collapsed ? (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
        >
          <span className="min-w-0">
            <span className="font-semibold">
              {weekdayName(view.getDay())}, {view.getDate()}/
              {view.getMonth() + 1}/{view.getFullYear()}
            </span>
            {info && (
              <span className="text-muted-foreground">
                <Trans>
                  {" "}
                  · Âm {info.lunar.day}/{info.lunar.month}
                  {leap}
                </Trans>
              </span>
            )}
          </span>
        </button>
      ) : (
        <>
          {/* Đầu thẻ: Dương lịch (tờ lịch) + Âm lịch (chữ, có nhãn). Badge ngày
          tốt/xấu: mobile xuống hàng riêng, desktop neo góc trên-phải. */}
          <div className="flex items-stretch">
            <div className="relative min-w-0 flex-1 p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* DƯƠNG LỊCH — tờ lịch, số ngày to (ai cũng quen tờ lịch treo tường) */}
                <div className="flex w-[84px] shrink-0 flex-col items-center rounded-lg border border-primary/25 bg-primary/5 py-2.5 text-primary sm:w-[96px]">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {weekdayName(view.getDay())}
                  </span>
                  <span className="my-0.5 text-4xl font-bold leading-none tabular-nums sm:text-5xl">
                    {view.getDate()}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Th{view.getMonth() + 1} · {view.getFullYear()}
                  </span>
                </div>

                {/* ÂM LỊCH — ghi bằng CHỮ, có nhãn, dễ đọc */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                    {t`Âm lịch`}
                  </p>
                  {info && (
                    <p className="text-lg font-bold leading-snug sm:text-2xl">
                      {t`Ngày ${info.lunar.day} tháng ${info.lunar.month}`}
                      {leap}
                    </p>
                  )}
                  {info && (
                    <p className="text-sm text-muted-foreground">
                      {t`Năm ${info.canChi.year}`}
                    </p>
                  )}
                </div>
              </div>

              {info && prefs.hoangDao && (
                <span
                  className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium sm:absolute sm:right-4 sm:top-4 sm:mt-0 ${
                    info.aus.good
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                  title={t`Sao ${info.aus.star} · Trực ${info.truc.name}`}
                >
                  {info.aus.good
                    ? t`Ngày tốt (Hoàng đạo)`
                    : t`Ngày xấu (Hắc đạo)`}
                </span>
              )}

              {/* Can chi + trực + sao 28 tú + tiết khí — thông tin phụ, chữ nhỏ mờ */}
              {info && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {[
                    prefs.truc ? t`Trực ${info.truc.name}` : null,
                    prefs.tu ? `Sao ${info.tu.short}` : null,
                    prefs.tietKhi && info.tietKhi
                      ? t`Tiết ${info.tietKhi}`
                      : null,
                    t`Can chi ngày ${info.canChi.day}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {/* Lễ, tết — đặt TRƯỚC cảnh báo ngày kiêng: người ta mở app ngày
            rằm tháng Bảy là để thấy chữ "Vu Lan", không phải để thấy hôm
            nay có kiêng gì. */}
              {festivals.length > 0 && (
                <div className="mt-2 space-y-1">
                  {festivals.map((f) => (
                    <p key={f.key} className="text-sm">
                      <span className="font-medium text-primary">
                        🏮 {f.name}
                      </span>
                      {f.publicHoliday && (
                        <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {t`Nghỉ lễ`}
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {f.note}
                      </span>
                    </p>
                  ))}
                </div>
              )}

              {/* Cảnh báo ngày kiêng dân gian (Tam Nương / Nguyệt Kỵ) */}
              {info && prefs.kieng && info.warnings.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
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
            </div>
          </div>

          {/* Vì sao tốt/xấu — giải thích cho người đọc hiểu, viền màu rõ. */}
          {info && (
            <div
              className={`mx-4 mb-3 rounded-lg border-l-4 p-3 text-sm leading-relaxed ${
                info.aus.good
                  ? "border-emerald-500 bg-emerald-500/5 text-foreground/90"
                  : "border-amber-500 bg-amber-500/5 text-foreground/90"
              }`}
            >
              <span className="font-semibold">Vì sao? </span>
              {info.reason}
            </div>
          )}

          {/* Nhị thập bát tú (28 sao) — thông tin thêm về ngày */}
          {info && prefs.tu && (
            <p className="px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/80">
                Sao {info.tu.name}
              </span>{" "}
              ({info.tu.good ? t`cát tinh` : "hung tinh"}) — {info.tu.note}
            </p>
          )}

          {/* Giờ hoàng đạo — dạng chip */}
          {info && prefs.hoangDao && info.aus.goodHours.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
              <span className="text-xs text-muted-foreground">{t`Giờ tốt (hoàng đạo):`}</span>
              {info.aus.goodHours.map((h) => (
                <span
                  key={h}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-foreground/80"
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Việc NÊN / KIÊNG theo trực — chỉ dùng MÀU CHỮ, không viền/nền. */}
          {info &&
            prefs.truc &&
            (info.nen.length > 0 || info.kieng.length > 0) && (
              <div className="grid grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-2">
                {info.nen.length > 0 && (
                  <div>
                    <p className="mb-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {t`✓ Nên làm`}
                    </p>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {info.nen.join(" · ")}
                    </p>
                  </div>
                )}
                {info.kieng.length > 0 && (
                  <div>
                    <p className="mb-0.5 text-sm font-bold text-rose-600 dark:text-rose-400">
                      {t`✕ Nên tránh`}
                    </p>
                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                      {info.kieng.join(" · ")}
                    </p>
                  </div>
                )}
              </div>
            )}

          {/* Giỗ / sinh nhật + phong tục: chỉ hiển thị khi đang xem HÔM NAY. */}
          {isToday && (
            <>
              <div className="border-t px-3 py-3">
                <p className="mb-2 px-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {t`Sự kiện trong dòng họ`}
                </p>
                {/* Ba tab ngang đều nhau, nhãn ngắn một dòng: màn nhỏ không bị rớt dòng. */}
                <div
                  role="tablist"
                  className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1"
                >
                  {(
                    [
                      ["today", t`Hôm nay`, todayEvents.length],
                      ["week", t`7 ngày`, weekEvents.length],
                      ["month", t`30 ngày`, monthEvents.length],
                    ] as const
                  ).map(([key, label, n]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTabPick(key)}
                      className={`flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 text-sm font-medium transition-colors ${
                        tab === key
                          ? "bg-background text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                      <span
                        className={`rounded-full px-1.5 text-xs tabular-nums ${
                          n > 0
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground/70"
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  ))}
                </div>
                {shown.length > 0 ? (
                  <ul className="space-y-1.5">
                    {shown.slice(0, 6).map((e) => (
                      <UpcomingCompactRow
                        key={e.key}
                        event={e}
                        clanId={clanId}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    {tab === "today"
                      ? t`Hôm nay không có giỗ, sinh nhật hay lễ tết nào.`
                      : tab === "week"
                        ? t`Không có sự kiện nào trong tuần.`
                        : t`Không có sự kiện nào trong tháng.`}
                  </p>
                )}
                <Link
                  to={`/clans/${clanId}/events`}
                  className="mt-2 block px-1 text-right text-sm text-primary hover:underline"
                >
                  {shown.length > 6
                    ? t`Xem thêm ${shown.length - 6} sự kiện →`
                    : t`Xem toàn bộ lịch →`}
                </Link>
              </div>

              {tip && (
                <Link
                  to={`/so-tay/${tip.id}`}
                  className="group block border-t px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t`Phong tục hôm nay`}
                  </p>
                  <p className="font-medium transition-colors group-hover:text-primary">
                    {tip.title}
                  </p>
                  {tip.short_description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {tip.short_description}
                    </p>
                  )}
                </Link>
              )}
            </>
          )}

          {/* Tuỳ chọn hiển thị — bật/tắt từng loại thông tin cho gọn. */}
          <div className="border-t">
            <button
              type="button"
              onClick={() => setShowOpts((v) => !v)}
              className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              ⚙ {t`Tuỳ chọn hiển thị`} {showOpts ? "▲" : "▼"}
            </button>
            {showOpts && (
              <div className="px-4 pb-3">
                <AlmanacDisplayToggles prefs={prefs} toggle={toggle} />
              </div>
            )}
          </div>

          {/* Lối vào trang lịch — mở đúng NGÀY ĐANG XEM trên lịch tháng. */}
          <Link
            to={`/clans/${clanId}/xem-ngay?date=${iso}`}
            className="group flex items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 hover:bg-muted/40"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <IconSparkles className="h-4 w-4 text-primary" />
              {t`Mở lịch & xem chi tiết ngày này`}
            </span>
            <IconArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </>
      )}
    </section>
  );
}
