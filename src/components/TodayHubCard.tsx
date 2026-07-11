import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { dayAuspice } from "@/lib/almanac";
import { getCanChiForSolarDate, solarStringToLunar } from "@/lib/lunarDate";
import { listCustomEntries } from "@/lib/queries/customs";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

const WEEKDAYS = [
  "Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Thẻ "Hôm nay" trên Trang chủ — thiết kế như TỜ LỊCH VẠN NIÊN: khối số ngày
 * dương to bên trái, âm lịch + can chi + ngày hoàng đạo/hắc đạo + giờ hoàng đạo
 * bên phải; kèm giỗ/sinh nhật hôm nay + "Phong tục hôm nay". Thay đổi mỗi ngày
 * → tạo lý do mở app hằng ngày.
 */
export function TodayHubCard({
  clanId,
  todayEvents,
}: {
  clanId: string;
  /** Sự kiện rơi vào HÔM NAY (daysUntil === 0) — trang cha đã tính sẵn. */
  todayEvents: UpcomingEvent[];
}) {
  const now = new Date();
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const lunar = solarStringToLunar(iso);
  const cc = getCanChiForSolarDate(iso);
  const aus = dayAuspice(iso);
  const leap = lunar?.isLeap ? " nhuận" : "";

  const dayOfYear = useMemo(() => {
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  }, [now]);

  const { data: customs } = useQuery({
    queryKey: ["customs-published-lite"],
    queryFn: () => listCustomEntries({ includeUnpublished: false }),
    staleTime: 6 * 60 * 60 * 1000,
  });
  const tip =
    customs && customs.length ? customs[dayOfYear % customs.length] : null;

  return (
    <section
      aria-label="Hôm nay"
      className="overflow-hidden rounded-xl border bg-card"
    >
      {/* Đầu thẻ: hai lịch song song, có NHÃN rõ (Dương lịch / Âm lịch) cho
          người lớn tuổi dễ hiểu. */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* DƯƠNG LỊCH — tờ lịch, số ngày to (ai cũng quen tờ lịch treo tường) */}
          <div className="flex w-[100px] shrink-0 flex-col items-center rounded-lg border border-primary/25 bg-primary/5 py-2.5 text-primary">
            <span className="text-xs font-semibold uppercase tracking-wide">
              {WEEKDAYS[now.getDay()]}
            </span>
            <span className="my-0.5 text-5xl font-bold leading-none tabular-nums">
              {now.getDate()}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Tháng {now.getMonth() + 1} · {now.getFullYear()}
            </span>
          </div>

          {/* ÂM LỊCH — ghi bằng CHỮ, có nhãn, dễ đọc */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
              Âm lịch
            </p>
            {lunar && (
              <p className="text-xl font-bold leading-snug sm:text-2xl">
                Ngày {lunar.day} tháng {lunar.month}
                {leap}
              </p>
            )}
            {cc && (
              <p className="text-sm text-muted-foreground">Năm {cc.year}</p>
            )}
          </div>

          {aus && (
            <span
              className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-medium ${
                aus.good
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
              title={`Sao ${aus.star}`}
            >
              {aus.good ? "Ngày tốt (Hoàng đạo)" : "Ngày xấu (Hắc đạo)"}
            </span>
          )}
        </div>

        {/* Can chi — thông tin phụ, chữ nhỏ mờ ở dưới */}
        {cc && (
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            Can chi: Ngày {cc.day} · tháng {cc.month} · năm {cc.year}
          </p>
        )}
      </div>

      {/* Giờ hoàng đạo — dạng chip */}
      {aus && aus.goodHours.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
          <span className="text-xs text-muted-foreground">Giờ tốt (hoàng đạo):</span>
          {aus.goodHours.map((h) => (
            <span
              key={h}
              className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-foreground/80"
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {/* Giỗ / sinh nhật hôm nay */}
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

      {/* Phong tục hôm nay */}
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
    </section>
  );
}
