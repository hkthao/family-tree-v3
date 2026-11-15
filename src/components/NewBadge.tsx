import { t } from "@lingui/core/macro";

/** Chấm + chữ "Mới" nhấp nháy nhẹ (tắt khi người dùng chọn giảm chuyển động). */
export function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-accent-foreground ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      {t`Mới`}
    </span>
  );
}
