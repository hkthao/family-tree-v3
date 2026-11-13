import type { ReactNode } from "react";

export type ChipTone =
  | "primary"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "rose"
  | "teal"
  | "orange"
  | "indigo";

/** Lớp màu (viền + nền nhạt + chữ) theo tông; dùng lại cho ô icon đại diện cho cùng màu với chip. */
export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  neutral: "border-border bg-muted/50 text-muted-foreground",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  violet:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  teal: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  orange:
    "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  indigo:
    "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
};

/**
 * Nhãn nhỏ bo tròn để làm nổi thuộc tính của một mục trong danh sách (loại, trạng thái,
 * số lượng…). Chỉ để hiển thị — không bấm được. Màu theo `tone` có sẵn cho cả nền sáng
 * lẫn tối; đừng chỉ dựa vào màu để truyền nghĩa, luôn kèm chữ.
 */
export function Chip({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0 ${CHIP_TONE_CLASS[tone]}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
