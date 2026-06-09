import { useEffect, useState } from "react";

import { IconX } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Chips for 1–6 ("Con cả", 2, 3, 4, 5, 6) + "Khác…" → number input
// for ≥7. Tappable one-handed on mobile; no keyboard for the 95%
// case. Empty string = "chưa rõ"; a clear pill on the right resets
// the value.

const QUICK_ORDERS = [1, 2, 3, 4, 5, 6];

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Falsy = no Label rendered; useful when the picker sits in a
   *  tighter mini-form that already labels it via context. */
  label?: string;
  /** Helper text shown below the chips. Pass null to hide. */
  helper?: string | null;
  /** DOM id for the fallback number input (when "Khác…" open). */
  inputId?: string;
}

export function BirthOrderPicker({
  value,
  onChange,
  label = "Con thứ mấy",
  helper = "Bỏ trống nếu không rõ — app xếp theo năm sinh.",
  inputId = "birth_order",
}: Props) {
  const n = Number(value);
  const hasValue = value !== "" && Number.isFinite(n) && n >= 1;
  const isOther = hasValue && n >= 7;
  const [otherOpen, setOtherOpen] = useState(isOther);

  // Reopen the input slot if the value loaded from DB / a parent
  // change pushes us into the ≥7 range.
  useEffect(() => {
    if (isOther) setOtherOpen(true);
  }, [isOther]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 min-h-[1.5rem]">
        {label ? <Label htmlFor={inputId}>{label}</Label> : <span />}
        {hasValue && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOtherOpen(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <IconX className="h-3 w-3" />
            Bỏ chọn
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ORDERS.map((k) => {
          const active = hasValue && !isOther && n === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                onChange(String(k));
                setOtherOpen(false);
              }}
              aria-pressed={active}
              className={`h-10 min-w-10 px-3 rounded-md border text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted/50"
              }`}
            >
              {k === 1 ? "Con cả" : k}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setOtherOpen(true);
            // Drop any 1–6 value so the input slot starts empty for
            // the user to type their actual number.
            if (hasValue && n < 7) onChange("");
          }}
          aria-pressed={otherOpen || isOther}
          className={`h-10 px-3 rounded-md border text-sm transition-colors ${
            otherOpen || isOther
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card hover:bg-muted/50"
          }`}
        >
          Khác…
        </button>
      </div>
      {(otherOpen || isOther) && (
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={7}
          max={50}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập số (≥ 7)"
          className="max-w-[180px] h-10"
        />
      )}
      {helper && (
        <p className="text-sm text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}
