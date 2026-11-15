import { t } from "@lingui/core/macro";

/** Chấm + chữ "Mới" nhấp nháy nhẹ (tắt khi người dùng chọn giảm chuyển động). */
export function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold leading-[1.4] text-primary-foreground shadow-sm ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-70 motion-safe:animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-foreground" />
      </span>
      {t`Mới`}
    </span>
  );
}
