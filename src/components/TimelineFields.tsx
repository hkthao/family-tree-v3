import { useState } from "react";

import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { yearToCanChi } from "@/lib/canChi";
import type { TimelineRow } from "@/lib/queries/person-timeline";

/** Một dòng đang soạn trong form (năm để chuỗi cho tới khi lưu). */
export interface TimelineDraft {
  key: number;
  year: string;
  era: string;
  /** true = can chi tự tính theo năm; sửa tay ô can chi thì thôi tự tính. */
  eraAuto: boolean;
  body: string;
}

/** Can chi của năm đang gõ; chỉ tính khi đã gõ đủ 3 chữ số trở lên. */
function autoEra(yearText: string): string {
  const t = yearText.trim();
  return /^\d{3,4}$/.test(t) ? yearToCanChi(Number(t)) : "";
}

export function rowsToDrafts(rows: TimelineRow[]): TimelineDraft[] {
  return rows.map((r, i) => ({
    key: i,
    year: String(r.year),
    era: r.era ?? "",
    eraAuto: !r.era || r.era === yearToCanChi(r.year),
    body: r.body,
  }));
}

/** Kiểm tra và đổi các dòng đã soạn thành mốc; dòng trống hẳn thì bỏ. Sai → ném lỗi tiếng Việt. */
export function draftsToRows(drafts: TimelineDraft[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const d of drafts) {
    if (!d.year.trim() && !d.body.trim()) continue;
    const year = Number(d.year);
    if (!Number.isInteger(year) || year < -3000 || year > 3000) {
      throw new Error(`Dòng thời gian: năm “${d.year}” chưa hợp lệ.`);
    }
    if (!d.body.trim()) throw new Error(`Dòng thời gian: năm ${year} chưa có nội dung.`);
    rows.push({ year, era: d.era.trim() || null, body: d.body.trim() });
  }
  return rows.sort((a, b) => a.year - b.year);
}

/** Các thẻ thêm / sửa / xoá mốc của dòng thời gian; lưu cùng nút "Lưu" của form. */
export function TimelineFields({
  drafts,
  onChange,
}: {
  drafts: TimelineDraft[];
  onChange: (next: TimelineDraft[]) => void;
}) {
  // Mốc đã có mặc định thu gọn (chỉ thấy năm + dòng đầu); mốc mới thêm thì mở sẵn để nhập.
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (key: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const update = (key: number, patch: Partial<TimelineDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const nextKey = drafts.reduce((m, d) => Math.max(m, d.key + 1), 0);
  /** Chèn một mốc trống ngay sau mốc `afterKey` (null = đầu danh sách). */
  const insertAfter = (afterKey: number | null) => {
    const blank: TimelineDraft = { key: nextKey, year: "", era: "", eraAuto: true, body: "" };
    setOpen((prev) => new Set(prev).add(blank.key));
    if (afterKey === null) return onChange([blank, ...drafts]);
    const i = drafts.findIndex((d) => d.key === afterKey);
    onChange([...drafts.slice(0, i + 1), blank, ...drafts.slice(i + 1)]);
  };

  return (
    <div className="space-y-3">
      {drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">Chưa có mốc nào.</p>
      )}
      <ul className="space-y-2">
        {drafts.map((d) => {
          const isOpen = open.has(d.key);
          return (
            <li key={d.key} className="rounded-lg border bg-card">
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => toggle(d.key)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="shrink-0 text-base font-semibold text-primary">
                    {d.year || "—"}
                  </span>
                  {d.era && <span className="shrink-0 text-xs text-muted-foreground">{d.era}</span>}
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {d.body.split("\n")[0] || "Chưa có nội dung"}
                  </span>
                  <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                    {isOpen ? <IconChevronUp className="h-5 w-5" /> : <IconChevronDown className="h-5 w-5" />}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-primary"
                  aria-label={`Chèn mốc mới bên dưới mốc năm ${d.year || "này"}`}
                  title="Chèn mốc mới bên dưới"
                  onClick={() => insertAfter(d.key)}
                >
                  <IconPlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Xoá mốc năm ${d.year || "này"}`}
                  onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
              {isOpen && (
                <div className="space-y-3 border-t p-3">
                  <div className="flex items-end gap-2">
                    <div className="w-24 shrink-0">
                      <Label htmlFor={`tl-year-${d.key}`} className="text-xs">Năm</Label>
                      <Input
                        id={`tl-year-${d.key}`}
                        inputMode="numeric"
                        value={d.year}
                        onChange={(e) =>
                          update(d.key, {
                            year: e.target.value,
                            ...(d.eraAuto ? { era: autoEra(e.target.value) } : {}),
                          })
                        }
                        placeholder="1226"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`tl-era-${d.key}`} className="text-xs">Can chi (tự tính theo năm)</Label>
                      <Input
                        id={`tl-era-${d.key}`}
                        value={d.era}
                        onChange={(e) => update(d.key, { era: e.target.value, eraAuto: false })}
                        placeholder="Bính Tuất"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`tl-body-${d.key}`} className="text-xs">Sự kiện</Label>
                    <Textarea
                      id={`tl-body-${d.key}`}
                      rows={3}
                      maxLength={1000}
                      value={d.body}
                      onChange={(e) => update(d.key, { body: e.target.value })}
                      placeholder="Việc xảy ra trong năm này"
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => insertAfter(drafts.length ? drafts[drafts.length - 1].key : null)}
      >
        <IconPlus className="mr-1.5 h-4 w-4" />
        Thêm mốc
      </Button>
    </div>
  );
}
