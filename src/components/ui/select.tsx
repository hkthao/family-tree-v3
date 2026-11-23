import * as React from "react";

import { splitFieldClasses } from "@/components/ui/field-layout";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
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
    // Xem field-layout.ts: class chiều ngang thuộc về khung bọc, nếu
    // không mũi tên và icon sẽ trôi ra xa ô khi ô bị giới hạn bề ngang.
    const split = splitFieldClasses(className);
    const field = (
      <select
        className={cn(
          "flex h-12 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          icon && "pl-10",
          split.field,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );

    return (
      <div className={cn("relative w-full", split.wrapper)}>
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };

export interface OptionSelectProps<T extends string> {
  /** Nhãn hiện trên ô; bỏ trống thì chỉ có `ariaLabel` cho trình đọc màn hình. */
  label?: string;
  ariaLabel: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  icon?: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * Chọn một trong vài lựa chọn loại trừ nhau trong FORM (chế độ thêm, vai trò, loại giao dịch…)
 * — thay cho dải nút tab: một ô gọn, đồng nhất với các ô chọn khác, không rớt dòng trên điện
 * thoại. Dải nút (SegmentedControl) chỉ còn dùng để đổi cách XEM (lọc, tab trang).
 */
export function OptionSelect<T extends string>({
  label,
  ariaLabel,
  value,
  onChange,
  options,
  icon,
  className,
  id,
}: OptionSelectProps<T>) {
  const autoId = React.useId();
  const selectId = id ?? autoId;
  const field = (
    <Select
      id={selectId}
      aria-label={label ? undefined : ariaLabel}
      icon={icon}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </Select>
  );
  if (!label) return field;
  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>{label}</Label>
      {field}
    </div>
  );
}
