import { t } from "@lingui/core/macro";
import { Link } from "react-router-dom";

import type { UpcomingEvent } from "@/lib/upcomingEvents";

/**
 * Một hàng sự kiện GỌN (ô ngày bên trái, tên + loại ở giữa, đếm ngược bên phải) — dùng trong thẻ "Hôm nay" ở
 * Tổng quan. Mỗi phần chỉ một dòng (truncate) để điện thoại màn nhỏ không bị rớt dòng.
 */
export function UpcomingCompactRow({
  event,
  clanId,
}: {
  event: UpcomingEvent;
  clanId: string;
}) {
  const dt = new Date(event.date + "T00:00:00");
  const day = dt.getDate();
  const month = dt.getMonth() + 1;
  const countdown =
    event.daysUntil === 0
      ? t`Hôm nay`
      : event.daysUntil === 1
        ? t`Ngày mai`
        : t`Còn ${event.daysUntil} ngày`;

  // Strip the kind prefix from the title so the redesigned row can
  // present "person name (top)" + "kind label (subtitle)" without
  // repeating "Sinh nhật" 5 times down the column. For custom events
  // the title doesn't have a prefix, so it's left intact.
  let mainText = event.title;
  if (event.kind === "birthday" && mainText.startsWith("Sinh nhật ")) {
    mainText = mainText.slice("Sinh nhật ".length);
  } else if (event.kind === "anniversary" && mainText.startsWith("Giỗ ")) {
    mainText = mainText.slice("Giỗ ".length);
  }

  const kindLabel =
    event.kind === "birthday"
      ? t`Sinh nhật`
      : event.kind === "anniversary"
        ? t`Ngày giỗ`
        : t`Sự kiện`;

  const stampColor =
    event.kind === "birthday"
      ? "bg-primary/10 text-primary"
      : event.kind === "anniversary"
        ? "bg-muted text-muted-foreground"
        : "bg-accent/15 text-accent";

  const inner = (
    <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card hover:border-primary transition-colors">
      <div
        className={`shrink-0 w-12 text-center rounded-md py-1 ${stampColor}`}
      >
        <div className="text-xs uppercase tracking-wider leading-none">
          Th{month}
        </div>
        <div className="text-lg font-semibold leading-tight">{day}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{mainText}</p>
        <p className="text-xs text-muted-foreground truncate">
          {kindLabel}
          {event.subtitle ? ` · ${event.subtitle}` : ""}
        </p>
      </div>
      <span
        className={`text-xs whitespace-nowrap shrink-0 ${
          event.daysUntil === 0
            ? "text-primary font-semibold"
            : event.daysUntil <= 7
              ? "text-accent font-medium"
              : "text-muted-foreground"
        }`}
      >
        {countdown}
      </span>
    </div>
  );

  return (
    <li>
      {event.personId ? (
        <Link
          to={`/clans/${clanId}/people/${event.personId}`}
          className="block"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}
