import { useId } from "react";

import { IconGrid } from "@/components/icons";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import { t } from "@lingui/core/macro";

/**
 * "Cách xem" (Danh sách / Lưới / Lịch / Puzzle…) trong ngăn kéo Tuỳ chọn — MỘT ô chọn có nhãn, giống các bộ lọc khác
 * trong ngăn kéo. Không đặt nhóm nút cách xem ngoài trang hay nhóm nút trong ngăn kéo (xem docs/design-language.md).
 */
export function ViewModeSelect<T extends string>({
  value,
  onChange,
  options,
  label = t`Cách xem`,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        icon={<IconGrid />}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 w-full text-base"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
