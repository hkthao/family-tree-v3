import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  AlmanacDisplayToggles,
  useAlmanacPrefs,
} from "@/components/AlmanacDisplayToggles";
import { IconArrowLeft, IconArrowRight, IconSparkles } from "@/components/icons";
import { describeDay } from "@/lib/almanac";
import { listCustomEntries } from "@/lib/queries/customs";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

const WEEKDAYS = [
  "Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Nhãn tương đối cho ngày đang xem, dễ hiểu cho người lớn tuổi. */
function relativeLabel(offset: number): string {
  if (offset === 0) return "Hôm nay";
  if (offset === 1) return "Ngày mai";
  if (offset === 2) return "Ngày kia";
  if (offset === -1) return "Hôm qua";
  if (offset > 0) return `${offset} ngày nữa`;
  return `${-offset} ngày trước`;
}

/**
 * Thẻ "Hôm nay" trên Trang chủ — thiết kế như TỜ LỊCH VẠN NIÊN: khối số ngày
 * dương to bên trái, âm lịch + can chi + ngày hoàng đạo/hắc đạo + giờ hoàng đạo
 * bên phải; kèm việc NÊN/KIÊNG (theo trực), giỗ/sinh nhật hôm nay + "Phong tục
 * hôm nay". Có nút ‹ ngày trước / ngày sau › để xem lịch các ngày kế tiếp.
 */
export function TodayHubCard({
  clanId,
  todayEvents,
}: {
  clanId: string;
  /** Sự kiện rơi vào HÔM NAY (daysUntil === 0) — trang cha đã tính sẵn. */
  todayEvents: UpcomingEvent[];
}) {
  // offset = số ngày lệch so với hôm nay (0 = hôm nay). Điều khiển bằng
  // nút ‹ › để xem lịch ngày kế tiếp/trước mà không rời Trang chủ.
  const [offset, setOffset] = useState(0);
  const isToday = offset === 0;
  const { prefs, toggle } = useAlmanacPrefs();
  const [showOpts, setShowOpts] = useState(false);

  const view = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const iso = isoOf(view);
  const info = describeDay(iso);
  const leap = info?.lunar.leap ? " nhuận" : "";

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
      aria-label="Lịch vạn niên"
      className="overflow-hidden rounded-xl border bg-card"
    >
      {/* Thanh điều hướng ngày — nút to, rõ chữ cho người lớn tuổi. */}
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2 py-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted active:scale-95"
          aria-label="Xem ngày hôm trước"
        >
          <IconArrowLeft className="h-5 w-5" />
          <span>Hôm trước</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">
            {relativeLabel(offset)}
          </span>
          {!isToday && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Về hôm nay
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted active:scale-95"
          aria-label="Xem ngày hôm sau"
        >
          <span>Hôm sau</span>
          <IconArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Đầu thẻ: Dương lịch (tờ lịch) + Âm lịch (chữ, có nhãn). Badge ngày
          tốt/xấu: mobile xuống hàng riêng, desktop neo góc trên-phải. */}
      <div className="relative p-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* DƯƠNG LỊCH — tờ lịch, số ngày to (ai cũng quen tờ lịch treo tường) */}
          <div className="flex w-[84px] shrink-0 flex-col items-center rounded-lg border border-primary/25 bg-primary/5 py-2.5 text-primary sm:w-[96px]">
            <span className="text-xs font-semibold uppercase tracking-wide">
              {WEEKDAYS[view.getDay()]}
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
              Âm lịch
            </p>
            {info && (
              <p className="text-lg font-bold leading-snug sm:text-2xl">
                Ngày {info.lunar.day} tháng {info.lunar.month}
                {leap}
              </p>
            )}
            {info && (
              <p className="text-sm text-muted-foreground">
                Năm {info.canChi.year}
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
            title={`Sao ${info.aus.star} · Trực ${info.truc.name}`}
          >
            {info.aus.good ? "Ngày tốt (Hoàng đạo)" : "Ngày xấu (Hắc đạo)"}
          </span>
        )}

        {/* Can chi + trực + sao 28 tú + tiết khí — thông tin phụ, chữ nhỏ mờ */}
        {info && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {[
              prefs.truc ? `Trực ${info.truc.name}` : null,
              prefs.tu ? `Sao ${info.tu.short}` : null,
              prefs.tietKhi && info.tietKhi ? `Tiết ${info.tietKhi}` : null,
              `Can chi ngày ${info.canChi.day}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
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
          ({info.tu.good ? "cát tinh" : "hung tinh"}) — {info.tu.note}
        </p>
      )}

      {/* Giờ hoàng đạo — dạng chip */}
      {info && prefs.hoangDao && info.aus.goodHours.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
          <span className="text-xs text-muted-foreground">Giờ tốt (hoàng đạo):</span>
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
      {info && prefs.truc && (info.nen.length > 0 || info.kieng.length > 0) && (
        <div className="grid gap-2 px-4 pb-3 sm:grid-cols-2">
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

      {/* Giỗ / sinh nhật + phong tục: chỉ hiển thị khi đang xem HÔM NAY. */}
      {isToday && (
        <>
          <div className="border-t px-4 py-3">
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              Hôm nay trong dòng họ
            </p>
            {todayEvents.length > 0 ? (
              <ul className="space-y-1">
                {todayEvents.map((e) => {
                  const label =
                    e.kind === "birthday"
                      ? "🎂 Sinh nhật"
                      : e.kind === "anniversary"
                        ? "🕯️ Ngày giỗ"
                        : "📌 Sự kiện";
                  const row = (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="shrink-0">{label}:</span>
                      <span className="truncate font-medium">{e.title}</span>
                    </span>
                  );
                  return (
                    <li key={e.key}>
                      {e.personId ? (
                        <Link
                          to={`/clans/${clanId}/people/${e.personId}`}
                          className="hover:text-primary"
                        >
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Không có giỗ hay sinh nhật.
              </p>
            )}
          </div>

          {tip && (
            <Link
              to={`/so-tay/${tip.id}`}
              className="group block border-t px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Phong tục hôm nay
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
          ⚙ Tuỳ chọn hiển thị {showOpts ? "▲" : "▼"}
        </button>
        {showOpts && (
          <div className="px-4 pb-3">
            <AlmanacDisplayToggles prefs={prefs} toggle={toggle} />
          </div>
        )}
      </div>

      {/* Lối vào trang "Xem ngày tốt" — tìm ngày đẹp cho việc lớn. */}
      <Link
        to={`/clans/${clanId}/xem-ngay`}
        className="group flex items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 hover:bg-muted/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <IconSparkles className="h-4 w-4 text-primary" />
          Xem ngày tốt cho việc lớn (cưới hỏi, làm nhà…)
        </span>
        <IconArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}
