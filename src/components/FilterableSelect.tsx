import { useMemo, useState, type ReactNode } from "react";

import { IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { unaccent } from "@/lib/unaccent";

export interface FilterableOption {
  value: string;
  label: string;
}

/**
 * `<select>` gốc kèm ô lọc gõ không dấu ngay phía trên — cho danh sách dài (tỉnh, xã/phường).
 * Giữ select gốc (bánh xe chọn của điện thoại, xem ui/select.tsx) thay vì dựng dropdown riêng;
 * ô lọc chỉ hiện khi có từ `minForFilter` lựa chọn trở lên. Enter trong ô lọc chọn kết quả đầu.
 * Giá trị đang chọn luôn nằm trong danh sách dù không khớp ô lọc.
 */
export function FilterableSelect({
  id,
  icon,
  value,
  onChange,
  options,
  emptyLabel,
  disabled,
  filterPlaceholder = "Gõ để lọc (không cần dấu)",
  filterLabel,
  minForFilter = 10,
}: {
  id?: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: FilterableOption[];
  /** Nhãn của lựa chọn rỗng (giá trị ""). */
  emptyLabel: string;
  disabled?: boolean;
  filterPlaceholder?: string;
  filterLabel: string;
  minForFilter?: number;
}) {
  const [filter, setFilter] = useState("");

  const shown = useMemo(() => {
    const q = unaccent(filter);
    if (!q) return options;
    return options.filter((o) => o.value === value || unaccent(o.label).includes(q));
  }, [options, filter, value]);

  const showFilter = options.length >= minForFilter && !disabled;

  return (
    <div className="space-y-1.5">
      {showFilter && (
        <Input
          icon={<IconSearch />}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = shown.find((o) => o.value !== value) ?? shown[0];
            if (first && filter.trim()) {
              onChange(first.value);
              setFilter("");
            }
          }}
          placeholder={filterPlaceholder}
          aria-label={filterLabel}
          className="h-10"
        />
      )}
      <Select
        id={id}
        icon={icon}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setFilter("");
          onChange(e.target.value);
        }}
      >
        <option value="">{emptyLabel}</option>
        {shown.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
