import * as React from "react";

import { IconAlertTriangle, IconCheck, IconInfo } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Khung thông báo nội tuyến — MỘT kiểu duy nhất cho mọi ghi chú / cảnh báo / kết quả trong
 * trang và form. Đừng tự dựng `rounded border bg-muted/…` hay `border-amber-…` ở từng nơi.
 *
 *  - `note`    ghi chú trung tính, giải thích thêm (mặc định)
 *  - `info`    thông tin cần chú ý
 *  - `success` đã làm xong / kết quả tốt
 *  - `warning` cảnh báo, hành động có hệ quả
 *  - `danger`  lỗi
 *
 * Nền chỉ nhuộm nhẹ, chữ luôn là màu chữ chính để đọc rõ trên cả nền sáng lẫn tối; màu tông
 * dồn vào viền và icon. Thông báo ngắn có thể kèm `title` và `action` (nút/liên kết bên phải).
 */
export type CalloutTone = "note" | "info" | "success" | "warning" | "danger";

const TONE: Record<
  CalloutTone,
  {
    box: string;
    icon: string;
    Icon: (p: { className?: string }) => JSX.Element;
  }
> = {
  note: {
    box: "border-border bg-muted/40",
    icon: "text-muted-foreground",
    Icon: IconInfo,
  },
  info: {
    box: "border-sky-500/40 bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-400",
    Icon: IconInfo,
  },
  success: {
    box: "border-emerald-500/40 bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: IconCheck,
  },
  warning: {
    box: "border-amber-500/40 bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: IconAlertTriangle,
  },
  danger: {
    box: "border-destructive/50 bg-destructive/10",
    icon: "text-destructive",
    Icon: IconAlertTriangle,
  },
};

export function calloutBoxClass(tone: CalloutTone): string {
  return cn(
    "flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-relaxed text-foreground",
    TONE[tone].box,
  );
}

export interface CalloutProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  tone?: CalloutTone;
  /** Icon riêng; `false` = không icon. Mặc định theo tông. */
  icon?: React.ReactNode | false;
  title?: React.ReactNode;
  /** Nút / liên kết bên phải (vd. Khôi phục, Bỏ). */
  action?: React.ReactNode;
}

export const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  (
    { tone = "note", icon, title, action, className, children, ...props },
    ref,
  ) => {
    const { Icon, icon: iconCls } = TONE[tone];
    return (
      <div
        ref={ref}
        className={cn(calloutBoxClass(tone), className)}
        {...props}
      >
        {icon !== false && (
          <span className={cn("mt-0.5 shrink-0", iconCls)} aria-hidden="true">
            {icon ?? <Icon className="h-4 w-4" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {title && <p className="mb-0.5 font-medium">{title}</p>}
          <div className="[&_p+p]:mt-1.5">{children}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  },
);
Callout.displayName = "Callout";
