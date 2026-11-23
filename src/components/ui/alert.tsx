import * as React from "react";

import { Callout, type CalloutTone } from "@/components/ui/callout";
import { cn } from "@/lib/utils";

/**
 * Kết quả / lỗi của một thao tác (đã lưu, lỗi từ máy chủ…) — vỏ mỏng trên `Callout` để giữ cùng
 * một kiểu với mọi ghi chú trong app. Ghi chú tĩnh, cảnh báo giải thích: dùng thẳng `Callout`.
 * Có `role="alert"` nên trình đọc màn hình đọc ngay khi hiện.
 */
type AlertVariant = "default" | "destructive" | "success" | "warning";

const TONE_OF: Record<AlertVariant, CalloutTone> = {
  default: "info",
  destructive: "danger",
  success: "success",
  warning: "warning",
};

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }
>(({ variant = "default", ...props }, ref) => (
  <Callout ref={ref} role="alert" tone={TONE_OF[variant]} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
