import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Icon đặt cạnh nhãn, KHÔNG đặt trong ô.
   *
   * Khác Input: chữ trong textarea xuống dòng và bắt đầu từ trên cùng,
   * nên icon nằm trong ô sẽ đè lên dòng đầu hoặc buộc phải chừa lề trái
   * cho mọi dòng — cả hai đều xấu.
   */
  icon?: React.ReactNode;
  label?: string;
  /**
   * Mặc định true: ô tự cao theo nội dung (không cuộn trong ô), tối thiểu
   * `rows` dòng (mặc định 3). Đặt false để giữ cỡ cố định + kéo giãn tay.
   */
  autoResize?: boolean;
  /** Với autoResize: cao tối đa bấy nhiêu dòng (mặc định 10), quá thì cuộn trong ô. */
  maxRows?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      icon,
      label,
      id,
      autoResize = true,
      maxRows = 10,
      rows = 3,
      onInput,
      ...props
    },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const setRefs = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      },
      [ref],
    );

    const fit = React.useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoResize) return;
      // Về auto trước để thu lại khi xoá bớt chữ; scrollHeight tính cả padding,
      // `rows` giữ sàn tối thiểu vì height:auto của textarea = số dòng đó.
      el.style.height = "auto";
      const full = el.scrollHeight + (el.offsetHeight - el.clientHeight);
      let max = Infinity;
      if (maxRows) {
        const cs = getComputedStyle(el);
        const px = (v: string) => parseFloat(v) || 0;
        const lh = px(cs.lineHeight) || (px(cs.fontSize) || 16) * 1.5;
        const pad =
          px(cs.paddingTop) +
          px(cs.paddingBottom) +
          px(cs.borderTopWidth) +
          px(cs.borderBottomWidth);
        max = lh * maxRows + pad;
      }
      el.style.height = `${Math.min(full, max)}px`;
      el.style.overflowY = full > max ? "auto" : "hidden";
    }, [autoResize, maxRows]);

    // Chạy lại khi giá trị đổi từ ngoài (nạp dữ liệu, reset form) và khi mount.
    React.useLayoutEffect(fit, [fit, props.value]);
    React.useEffect(() => {
      if (!autoResize) return;
      // Bề rộng đổi (mở ngăn kéo, xoay màn hình) làm số dòng xuống dòng đổi theo.
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      let w = el.clientWidth;
      const ro = new ResizeObserver(() => {
        if (el.clientWidth !== w) {
          w = el.clientWidth;
          fit();
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [autoResize, fit]);

    const field = (
      <textarea
        id={id}
        rows={rows}
        onInput={(e) => {
          fit();
          onInput?.(e);
        }}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          autoResize && "resize-none overflow-hidden",
          className,
        )}
        ref={setRefs}
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
            <span
              className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4"
              aria-hidden="true"
            >
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
