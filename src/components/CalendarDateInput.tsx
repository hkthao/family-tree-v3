import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import {
  canChiToYears,
  parseCanChi,
  yearToCanChi,
  type CanChi,
} from "@/lib/canChi";
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
  /**
   * Year to bias can-chi disambiguation toward (Bính Thìn matches
   * 1856/1916/1976/2036 — we pick the candidate nearest to this).
   * Pass focal's birth year for edit, or focal ± ~25 when adding a
   * child / parent. Defaults to "30 years ago", a reasonable guess
   * for adults in a gia phả.
   */
  referenceYear?: number;
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
  referenceYear,
}: Props) {
  const isLunar = value.mode === "lunar";
  // Hide the Dương/Âm tab strip + leap checkbox by default so older
  // users see only the 3 plain inputs. The toggle reveals lunar
  // controls. If the incoming value is already lunar (editing an old
  // record) we auto-expand so the user can see what's set.
  const [lunarUiOpen, setLunarUiOpen] = useState(isLunar);
  const showLunarControls = lunarUiOpen || isLunar;

  // Optional can-chi field — hidden by default. Reveals on demand
  // for users who only remember "Bính Thìn" instead of the Gregorian
  // year. The numeric year input stays primary so mobile keeps its
  // number pad.
  const [canChiUiOpen, setCanChiUiOpen] = useState(false);
  const [canChiInput, setCanChiInput] = useState("");
  // Stores the parsed pair so the chip can offer ±60y siblings
  // without re-parsing.
  const [canChi, setCanChi] = useState<CanChi | null>(null);
  const defaultReferenceYear =
    referenceYear ?? new Date().getFullYear() - 30;

  function onCanChiBlur() {
    const text = canChiInput.trim();
    if (!text) {
      setCanChi(null);
      return;
    }
    const parsed = parseCanChi(text);
    if (!parsed) return; // garbage — leave the chip / year as-is
    const years = canChiToYears(parsed);
    if (years.length === 0) return;
    let best = years[0];
    let bestDist = Math.abs(best - defaultReferenceYear);
    for (const y of years) {
      const d = Math.abs(y - defaultReferenceYear);
      if (d < bestDist) {
        best = y;
        bestDist = d;
      }
    }
    setCanChi(parsed);
    onChange({
      ...value,
      parts: { ...value.parts, year: String(best) },
    });
  }

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
      <p className="text-xs text-muted-foreground">
        Không nhớ đủ thì bỏ trống ngày, hoặc cả ngày-tháng — chỉ năm
        cũng được.
      </p>

      {showLunarControls ? (
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
      ) : (
        <button
          type="button"
          onClick={() => setLunarUiOpen(true)}
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Nhập theo lịch Âm
        </button>
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

      {/* Can-chi entry is OFF by default — the numeric keyboard is the
          right default for the common case (gõ 1976). Old users who
          only remember "Bính Thìn" can opt in. */}
      {!canChiUiOpen && !canChi ? (
        <button
          type="button"
          onClick={() => setCanChiUiOpen(true)}
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Nhập theo can-chi (Bính Thìn…)
        </button>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-canchi`} className="text-xs">
            Can-chi
          </Label>
          <Input
            id={`${idPrefix}-canchi`}
            value={canChiInput}
            onChange={(e) => setCanChiInput(e.target.value)}
            onBlur={onCanChiBlur}
            placeholder="vd: Bính Thìn"
            className="max-w-[240px]"
          />
          {canChi && /^\d+$/.test(value.parts.year) && (
            <CanChiChip
              parsed={canChi}
              pickedYear={Number(value.parts.year)}
              onPick={(y) =>
                onChange({
                  ...value,
                  parts: { ...value.parts, year: String(y) },
                })
              }
              onDismiss={() => {
                setCanChi(null);
                setCanChiInput("");
                setCanChiUiOpen(false);
              }}
            />
          )}
        </div>
      )}

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

function CanChiChip({
  parsed,
  pickedYear,
  onPick,
  onDismiss,
}: {
  parsed: CanChi;
  pickedYear: number;
  onPick: (y: number) => void;
  onDismiss: () => void;
}) {
  const label = yearToCanChi(pickedYear);
  // Surface ±1 cycle (60y) on each side of the pick so users can
  // bump to "đời trước" / "đời sau" without re-typing. Showing all
  // 4-5 candidates in [1700, now+5] would be noisy.
  const candidates = canChiToYears(parsed).filter(
    (y) => Math.abs(y - pickedYear) <= 60,
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span>
        Hiểu là <strong>{pickedYear}</strong> ({label}) — bấm để đổi đời:
      </span>
      <div className="flex flex-wrap gap-1">
        {candidates.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onPick(y)}
            aria-pressed={y === pickedYear}
            className={`px-2 py-0.5 rounded border text-xs ${
              y === pickedYear
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted/50"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        Bỏ qua
      </button>
    </div>
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
