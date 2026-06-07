import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import {
  convertPartsAcrossCalendars,
  type CalendarDateValue,
  type CalendarMode,
} from "@/lib/personDates";
import { formatLunarDate, solarStringToLunar } from "@/lib/lunarDate";
import { dateFromParts, formatPartialDate } from "@/lib/partialDate";

interface Props {
  /** Visible legend, e.g. "Ngày sinh". */
  label: string;
  /** id prefix; each sub-input gets `${idPrefix}-year` etc. */
  idPrefix: string;
  value: CalendarDateValue;
  onChange: (next: CalendarDateValue) => void;
  helperText?: string;
}

/**
 * Calendar-aware date input. A tab strip lets the user pick which
 * calendar they're typing in (Dương = Gregorian, Âm = Vietnamese
 * lunar). The 3 sub-fields stay the same — only the interpretation
 * changes. A "Tháng nhuận" checkbox appears in lunar mode for the
 * rare leap-month case (e.g., nhuận tháng 4).
 *
 * Below the inputs a preview line shows the same date in the OTHER
 * calendar so users orienting by tombstone vs almanac can sanity
 * check. The preview is read-only — typing always goes through the
 * active calendar.
 *
 * Switching tabs re-derives the parts in the new calendar when the
 * conversion is possible (full ymd input). On partial input the
 * inputs reset blank so the user doesn't see a stale value in the
 * wrong calendar.
 */
export function CalendarDateInput({
  label,
  idPrefix,
  value,
  onChange,
  helperText,
}: Props) {
  const isLunar = value.mode === "lunar";

  function setMode(nextMode: CalendarMode) {
    if (nextMode === value.mode) return;
    const converted = convertPartsAcrossCalendars(
      value.parts,
      value.mode,
      value.isLeap,
    );
    if (converted) {
      onChange({
        mode: nextMode,
        parts: converted.parts,
        isLeap: converted.isLeap,
      });
    } else {
      // Couldn't convert — keep mode change but reset the parts so the
      // user knows to re-enter rather than mis-read.
      onChange({
        mode: nextMode,
        parts: { year: "", month: "", day: "" },
        isLeap: false,
      });
    }
  }

  // Preview text — show the same date in the other calendar to help
  // the user orient.
  const preview = useMemo(() => buildPreview(value), [value]);

  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-medium">{label}</legend>
      {helperText && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}

      <SegmentedControl ariaLabel="Chọn lịch">
        <SegmentedButton
          active={!isLunar}
          onClick={() => setMode("solar")}
          className="px-3 h-9 min-w-[72px]"
        >
          Dương
        </SegmentedButton>
        <SegmentedButton
          active={isLunar}
          onClick={() => setMode("lunar")}
          className="px-3 h-9 min-w-[72px]"
        >
          Âm
        </SegmentedButton>
      </SegmentedControl>

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
            value={value.parts.day}
            onChange={(e) =>
              onChange({
                ...value,
                parts: { ...value.parts, day: e.target.value },
              })
            }
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
            value={value.parts.month}
            onChange={(e) =>
              onChange({
                ...value,
                parts: { ...value.parts, month: e.target.value },
              })
            }
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
            value={value.parts.year}
            onChange={(e) =>
              onChange({
                ...value,
                parts: { ...value.parts, year: e.target.value },
              })
            }
            placeholder="vd 1980"
          />
        </div>
      </div>

      {isLunar && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.isLeap}
            onChange={(e) => onChange({ ...value, isLeap: e.target.checked })}
            className="h-5 w-5 accent-primary shrink-0"
          />
          <span>Tháng nhuận</span>
        </label>
      )}

      {preview && (
        <p className="text-xs text-muted-foreground">{preview}</p>
      )}
    </fieldset>
  );
}

function buildPreview(v: CalendarDateValue): string {
  // For solar mode: show the lunar equivalent when full ymd.
  if (v.mode === "solar") {
    if (!v.parts.year || !v.parts.month || !v.parts.day) return "";
    let solar;
    try {
      solar = dateFromParts(v.parts);
    } catch {
      return "";
    }
    if (!solar.date || solar.precision !== "day") return "";
    const lun = solarStringToLunar(solar.date);
    if (!lun) return "";
    return `= ${formatLunarDate(lun)}`;
  }

  // Lunar mode: show the Gregorian equivalent.
  if (!v.parts.year || !v.parts.month || !v.parts.day) return "";
  const conv = convertPartsAcrossCalendars(v.parts, "lunar", v.isLeap);
  if (!conv) return "";
  const solarStr = formatPartialDate({
    date: `${conv.parts.year.padStart(4, "0")}-${conv.parts.month.padStart(2, "0")}-${conv.parts.day.padStart(2, "0")}`,
    precision: "day",
  });
  return solarStr ? `= ${solarStr} dương lịch` : "";
}
