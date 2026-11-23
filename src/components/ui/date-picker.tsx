import { useEffect, useId, useRef, useState } from "react";

import { IconCalendar } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/rich-select";
import { Select } from "@/components/ui/select";
import {
  daysInMonth,
  isoToVi,
  maskViDate,
  parseIso,
  todayIso,
  toIso,
  viToIso,
} from "@/lib/isoDate";
import { cn } from "@/lib/utils";

import { t } from "@lingui/core/macro";

/**
 * Ô chọn NGÀY (dương lịch) viết riêng thay cho `<input type="date">` gốc: lịch gốc theo ngôn ngữ
 * máy (hiện tiếng Anh, lệch kiểu với các ô khác). Giá trị vẫn là "yyyy-mm-dd" như ô gốc, nên
 * đổi qua lại không phải sửa chỗ lưu. Gõ tay "ngày/tháng/năm" (tự chèn dấu "/") hoặc bấm vào ô để mở lịch.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  placeholder = t`ngày/tháng/năm`,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  /** "yyyy-mm-dd" — ngày sớm nhất / muộn nhất được chọn. */
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(isoToVi(value));
  const sel = parseIso(value);
  const today = parseIso(todayIso())!;
  const [view, setView] = useState({
    y: (sel ?? today).y,
    m: (sel ?? today).m,
  });

  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max);

  // Giá trị đổi từ ngoài (nạp dữ liệu, chọn trên lịch) → cập nhật ô gõ; đang gõ dở thì giữ nguyên.
  useEffect(() => {
    if (value !== (viToIso(text) ?? "")) setText(isoToVi(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  function type(raw: string) {
    const masked = maskViDate(raw);
    setText(masked);
    const iso = viToIso(masked);
    const next = iso && inRange(iso) ? iso : "";
    if (next !== value) onChange(next);
    if (next)
      setView({ y: Number(next.slice(0, 4)), m: Number(next.slice(5, 7)) });
  }

  // Bấm / vào ô là mở lịch (không có nút riêng); gõ tay vẫn được khi lịch đang mở.
  function openCalendar() {
    if (open) return;
    setView({ y: (sel ?? today).y, m: (sel ?? today).m });
    setOpen(true);
  }

  function pick(iso: string) {
    setText(isoToVi(iso));
    onChange(iso);
    setOpen(false);
  }

  function shift(delta: number) {
    setView((v) => {
      const idx = v.y * 12 + (v.m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });
  }

  const invalid = text.length === 10 && !viToIso(text);
  const lead = (new Date(view.y, view.m - 1, 1).getDay() + 6) % 7; // Thứ 2 là cột đầu
  const dim = daysInMonth(view.y, view.m);
  const cells: { iso: string; day: number; outside: boolean }[] = [];
  for (let i = 0; i < Math.ceil((lead + dim) / 7) * 7; i++) {
    const dt = new Date(view.y, view.m - 1, 1 - lead + i);
    cells.push({
      iso: toIso({
        y: dt.getFullYear(),
        m: dt.getMonth() + 1,
        d: dt.getDate(),
      }),
      day: dt.getDate(),
      outside: dt.getMonth() + 1 !== view.m,
    });
  }
  const minYear = Math.min(view.y, today.y - 100);
  const maxYear = Math.max(view.y, today.y + 20);
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  const weekdays = [t`T2`, t`T3`, t`T4`, t`T5`, t`T6`, t`T7`, t`CN`];

  return (
    <div className="relative" ref={rootRef}>
      <Input
        id={inputId}
        icon={<IconCalendar />}
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(invalid && "border-destructive", className)}
        placeholder={placeholder}
        value={text}
        onChange={(e) => type(e.target.value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onFocus={openCalendar}
        onClick={openCalendar}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {invalid && (
        <p className="mt-1 text-sm text-destructive">
          {t`Ngày không hợp lệ hoặc ngoài khoảng cho phép.`}
        </p>
      )}
      {open && (
        <div
          role="dialog"
          aria-label={t`Chọn ngày`}
          className="absolute left-0 z-30 mt-1 w-80 max-w-full rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              aria-label={t`Tháng trước`}
              onClick={() => shift(-1)}
              className="inline-flex h-10 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
            >
              ‹
            </button>
            <div className="min-w-0 flex-1">
              <RichSelect
                compact
                searchable
                searchPlaceholder={t`Gõ tháng`}
                ariaLabel={t`Tháng`}
                value={String(view.m)}
                onChange={(m) => setView({ ...view, m: Number(m) })}
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: String(i + 1),
                  label: t`Tháng ${i + 1}`,
                }))}
              />
            </div>
            <div className="min-w-0 flex-1">
              <RichSelect
                compact
                searchable
                searchPlaceholder={t`Gõ năm`}
                ariaLabel={t`Năm`}
                value={String(view.y)}
                onChange={(y) => setView({ ...view, y: Number(y) })}
                options={years.map((y) => ({
                  value: String(y),
                  label: String(y),
                }))}
              />
            </div>
            <button
              type="button"
              aria-label={t`Tháng sau`}
              onClick={() => shift(1)}
              className="inline-flex h-10 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {weekdays.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const selected = c.iso === value;
              const isToday = c.iso === todayIso();
              const ok = inRange(c.iso);
              return (
                <button
                  key={c.iso}
                  type="button"
                  disabled={!ok}
                  aria-pressed={selected}
                  onClick={() => pick(c.iso)}
                  className={cn(
                    "h-10 rounded-md text-base",
                    selected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-muted",
                    !selected && c.outside && "text-muted-foreground/50",
                    isToday && !selected && "ring-1 ring-primary",
                    !ok && "cursor-not-allowed opacity-30 hover:bg-transparent",
                  )}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
            <button
              type="button"
              className="rounded-md px-2 py-1.5 text-primary hover:bg-muted disabled:opacity-40"
              disabled={!inRange(todayIso())}
              onClick={() => pick(todayIso())}
            >
              {t`Hôm nay`}
            </button>
            {value && (
              <button
                type="button"
                className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setText("");
                  onChange("");
                  setOpen(false);
                }}
              >
                {t`Xoá ngày`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Ngày + giờ ("yyyy-mm-dd'T'hh:mm", như `datetime-local`): ô ngày dùng DatePicker, giờ/phút là hai
 * ô chọn (giờ 24h, bước 5 phút) — không dùng ô giờ gốc vì nó hiện AM/PM theo máy.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const date = value.slice(0, 10);
  const hh = value.length >= 16 ? Number(value.slice(11, 13)) : 8;
  const mm = value.length >= 16 ? Number(value.slice(14, 16)) : 0;
  const set = (d: string, h: number, m: number) =>
    onChange(d ? `${d}T${pad2(h)}:${pad2(m)}` : "");
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!minutes.includes(mm)) minutes.push(mm);
  minutes.sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <DatePicker
          id={id}
          value={date}
          disabled={disabled}
          onChange={(d) => set(d, hh, mm)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Select
          aria-label={t`Giờ`}
          className="w-24"
          disabled={disabled || !date}
          value={hh}
          onChange={(e) => set(date, Number(e.target.value), mm)}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {t`${pad2(h)} giờ`}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t`Phút`}
          className="w-28"
          disabled={disabled || !date}
          value={mm}
          onChange={(e) => set(date, hh, Number(e.target.value))}
        >
          {minutes.map((m) => (
            <option key={m} value={m}>
              {t`${pad2(m)} phút`}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
