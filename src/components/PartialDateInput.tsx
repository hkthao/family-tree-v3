import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DateParts } from "@/lib/partialDate";

interface Props {
  /** Visible label, e.g. "Ngày sinh". */
  label: string;
  /** id prefix; each sub-input gets `${idPrefix}-year` etc. */
  idPrefix: string;
  value: DateParts;
  onChange: (next: DateParts) => void;
  helperText?: string;
}

/**
 * Three-input control for partial Vietnamese-style solar dates.
 *
 * Real tombstones often give only a year, or month+year. The form
 * accepts any combination: empty → unknown; year only; year+month;
 * full date. Validation happens centrally in `dateFromParts` when the
 * caller submits.
 *
 * Layout: ngày / tháng / năm side by side, with the year input wider
 * because Vietnamese years are 4 digits and feel underweighted at 2/12.
 */
export function PartialDateInput({
  label,
  idPrefix,
  value,
  onChange,
  helperText,
}: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-medium">{label}</legend>
      {helperText && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
      <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2 max-w-md">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-day`} className="text-xs">
            Ngày
          </Label>
          <Input
            id={`${idPrefix}-day`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={value.day}
            onChange={(e) => onChange({ ...value, day: e.target.value })}
            placeholder="—"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-month`} className="text-xs">
            Tháng
          </Label>
          <Input
            id={`${idPrefix}-month`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={value.month}
            onChange={(e) => onChange({ ...value, month: e.target.value })}
            placeholder="—"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-year`} className="text-xs">
            Năm
          </Label>
          <Input
            id={`${idPrefix}-year`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={value.year}
            onChange={(e) => onChange({ ...value, year: e.target.value })}
            placeholder="vd 1980"
          />
        </div>
      </div>
    </fieldset>
  );
}
