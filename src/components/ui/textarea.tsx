import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Icon đặt cạnh nhãn, KHÔNG đặt trong ô.
   *
   * Khác Input: chữ trong textarea xuống dòng và bắt đầu từ trên cùng,
   * nên icon nằm trong ô sẽ đè lên dòng đầu hoặc buộc phải chừa lề trái
   * cho mọi dòng — cả hai đều xấu.
   */
  icon?: React.ReactNode;
  label?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, icon, label, id, ...props }, ref) => {
    const field = (
      <textarea
        id={id}
        className={cn(
          "flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    if (!label) return field;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          {icon && (
            <span className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
              {icon}
            </span>
          )}
          {label}
        </label>
        {field}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
