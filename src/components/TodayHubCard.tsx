import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { IconCalendar } from "@/components/icons";
import { dayAuspice } from "@/lib/almanac";
import {
  formatLunarDate,
  getCanChiForSolarDate,
  solarStringToLunar,
} from "@/lib/lunarDate";
import { listCustomEntries } from "@/lib/queries/customs";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

const WEEKDAYS = [
  "Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Thẻ "Hôm nay" trên Trang chủ — THAY ĐỔI MỖI NGÀY để tạo lý do mở app hằng
 * ngày: âm lịch + can chi + NGÀY tốt/xấu (hoàng đạo) + giờ hoàng đạo, giỗ/sinh
 * nhật hôm nay, và "Phong tục hôm nay" (1 bài Sổ tay xoay theo ngày).
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
  // Số thứ tự ngày trong năm → chọn "phong tục hôm nay" ổn định theo ngày.
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
      className="rounded-lg border bg-card p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <IconCalendar className="h-4 w-4 text-primary" />
            {WEEKDAYS[now.getDay()]}, {pad(now.getDate())}/
            {pad(now.getMonth() + 1)}/{now.getFullYear()}
          </h2>
          {lunar && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Âm lịch: {formatLunarDate(lunar)}
            </p>
          )}
        </div>
        {aus && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              aus.good
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
            title={`Sao ${aus.star}`}
          >
            {aus.good ? "Ngày Hoàng đạo" : "Ngày Hắc đạo"} · {aus.star}
          </span>
        )}
      </div>

      {cc && (
        <p className="text-sm">
          <span className="text-muted-foreground">Can chi: </span>
          Ngày {cc.day} · tháng {cc.month} · năm {cc.year}
        </p>
      )}
      {aus && aus.goodHours.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">Giờ hoàng đạo: </span>
          {aus.goodHours.join(" · ")}
        </p>
      )}

      {/* Giỗ / sinh nhật hôm nay */}
      <div className="border-t pt-3">
        {todayEvents.length > 0 ? (
          <ul className="space-y-1.5">
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
                  <span className="font-medium truncate">{e.title}</span>
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
            Hôm nay không có giỗ hay sinh nhật trong dòng họ.
          </p>
        )}
      </div>

      {/* Phong tục hôm nay */}
      {tip && (
        <Link
          to={`/so-tay/${tip.id}`}
          className="block border-t pt-3 group"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Phong tục hôm nay
          </p>
          <p className="font-medium group-hover:text-primary transition-colors">
            {tip.title}
          </p>
          {tip.short_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {tip.short_description}
            </p>
          )}
        </Link>
      )}
    </section>
  );
}
