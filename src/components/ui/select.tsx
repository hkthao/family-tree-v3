import * as React from "react";

import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Icon trong ô, sát mép trái. Xem docs/design-language.md. */
  icon?: React.ReactNode;
}

/**
 * `<select>` gốc, bọc lại cho khớp Input về chiều cao, viền và focus ring.
 *
 * Cố tình KHÔNG dùng dropdown tự vẽ: select gốc cho ra bánh xe chọn của
 * hệ điều hành trên điện thoại — to, quen tay, và dùng được với người
 * lớn tuổi hơn hẳn một danh sách tự dựng.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, icon, children, ...props }, ref) => {
    const field = (
      <select
        className={cn(
          "flex h-12 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          icon && "pl-10",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );

    return (
      <div className="relative w-full">
        {icon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {field}
        {/* appearance-none bỏ mũi tên mặc định → tự vẽ lại, nếu không ô
            trông như ô nhập thường và người dùng không biết bấm được. */}
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
