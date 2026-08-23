import * as React from "react";

import { splitFieldClasses } from "@/components/ui/field-layout";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Icon hiện trong ô, sát mép trái.
   *
   * Có prop này để việc theo quy ước (docs/design-language.md) chỉ tốn
   * một dòng, thay vì phải tự dựng wrapper `relative` + `absolute` ở
   * từng chỗ — 134 ô nhập trong repo mà mỗi chỗ tự dựng thì kiểu gì
   * cũng lệch nhau.
   *
   * Không cần đặt kích thước: component tự ép về h-4 w-4.
   */
  icon?: React.ReactNode;
  /**
   * Nút hành động nằm TRONG ô, sát mép phải.
   *
   * Chỉ dùng khi ô có **đúng một** hành động và không nằm trong card —
   * xem docs/design-language.md §Đặt hành động ở đâu. Nhiều hơn một
   * hành động thì đưa xuống `<CardFooter>`, đừng nhồi vào ô.
   *
   * Truyền vào một nút icon-only đã có `aria-label`.
   */
  action?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, action, ...props }, ref) => {
    // Class chiếm chỗ phải nằm ở khung bọc, không ở ô — xem field-layout.ts.
    const split = splitFieldClasses(className);
    const fieldCls = icon || action ? split.field : className;
    const field = (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // Chừa chỗ cho icon. Không dùng padding trái mặc định vì ô
          // không có icon vẫn phải canh như cũ.
          icon && "pl-10",
          action && "pr-12",
          fieldCls,
        )}
        ref={ref}
        {...props}
      />
    );

    if (!icon && !action) return field;

    return (
      // `w-full` mặc định để form dọc giữ nguyên như cũ; nơi nào truyền
      // class chiều ngang (w-32, flex-1, max-w-sm…) thì class đó thắng và
      // khung co đúng bằng ô — nếu không, icon/mũi tên neo theo khung sẽ
      // trôi ra xa ô.
      <div className={cn("relative w-full", split.wrapper)}>
        {icon && (
          <span
            // pointer-events-none: bấm vào icon phải focus vào ô, chứ
            // không nuốt cú chạm — trên điện thoại rất dễ chạm trúng.
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {field}
        {action && (
          // Ngược lại với icon trái: cái này PHẢI nhận được cú bấm.
          <span className="absolute right-1 top-1/2 -translate-y-1/2">
            {action}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
