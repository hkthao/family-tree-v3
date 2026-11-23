import { t } from "@lingui/core/macro";

import type { EventRow } from "@/lib/queries/events";
import type { TimelineCandidate } from "@/lib/timeline/computeClanTimeline";
import type { TimelineIconKey } from "@/lib/timeline/eras";

/**
 * Gợi ý mốc từ NHIỀU NGUỒN của dòng họ: gia phả (năm sinh, các đời), sự kiện, mộ phần, di sản. Người dùng chọn
 * một gợi ý trong form thêm mốc thì nó được SAO CHÉP thành mốc của dòng thời gian (độc lập với nguồn).
 * `key` có tiền tố theo nguồn (`event:<id>`, `grave:<id>`, `heritage:<id>`; gia phả giữ khoá cũ) và được lưu ở
 * `source_key` để không gợi ý lại.
 */
export type SuggestionSource = "tree" | "event" | "grave" | "heritage";

export interface TimelineSuggestion {
  key: string;
  source: SuggestionSource;
  year: number;
  title: string;
  body: string;
  iconKey: TimelineIconKey;
  photoPersonId: string | null;
  /** Nên thêm sẵn khi bấm "Thêm các mốc nổi bật" (chỉ gợi ý từ gia phả có). */
  recommended: boolean;
}

export const SUGGESTION_SOURCES: SuggestionSource[] = ["tree", "event", "grave", "heritage"];

export function suggestionSourceLabel(s: SuggestionSource): string {
  switch (s) {
    case "tree":
      return t`Gia phả`;
    case "event":
      return t`Sự kiện`;
    case "grave":
      return t`Mộ phần`;
    case "heritage":
      return t`Di sản`;
  }
}

export function fromCandidates(list: TimelineCandidate[]): TimelineSuggestion[] {
  return list.map((c) => ({
    key: c.key,
    source: "tree",
    year: c.year,
    title: c.title,
    body: c.body,
    iconKey: c.iconKey,
    photoPersonId: c.photoPersonId,
    recommended: c.recommended,
  }));
}

const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n);

/** Năm của sự kiện: năm dương lịch của `date_solar`, hoặc `lunar_year`; không có năm → bỏ qua. */
export function eventYear(e: Pick<EventRow, "date_solar" | "lunar_year">): number | null {
  const y = e.date_solar ? Number.parseInt(e.date_solar.slice(0, 4), 10) : e.lunar_year;
  return y && Number.isInteger(y) && y >= 1 && y <= 9999 ? y : null;
}

export function fromEvents(
  rows: Pick<EventRow, "id" | "title" | "notes" | "event_type" | "date_solar" | "lunar_year">[],
): TimelineSuggestion[] {
  const out: TimelineSuggestion[] = [];
  for (const e of rows) {
    const year = eventYear(e);
    if (year === null || !e.title.trim()) continue;
    out.push({
      key: `event:${e.id}`,
      source: "event",
      year,
      title: clip(e.title, 200),
      body: clip(e.notes, 2000),
      iconKey:
        e.event_type === "tomb_visit" || e.event_type === "memorial"
          ? "candle"
          : e.event_type === "reunion"
            ? "family"
            : "banner",
      photoPersonId: null,
      recommended: false,
    });
  }
  return out;
}

export interface HeritageSource {
  id: string;
  title: string;
  summary: string | null;
  category: "place" | "custom" | "story" | "artifact";
  built_year: number | null;
}

export function fromHeritage(rows: HeritageSource[]): TimelineSuggestion[] {
  const icon: Record<HeritageSource["category"], TimelineIconKey> = {
    place: "citadel",
    custom: "scroll",
    story: "book",
    artifact: "scroll",
  };
  return rows
    .filter((r) => r.built_year && r.built_year >= 1 && r.title.trim())
    .map((r) => ({
      key: `heritage:${r.id}`,
      source: "heritage" as const,
      year: r.built_year as number,
      title: clip(r.title, 200),
      body: clip(r.summary, 2000),
      iconKey: icon[r.category] ?? "scroll",
      photoPersonId: null,
      recommended: false,
    }));
}

export interface GraveSource {
  id: string;
  name: string | null;
  location_name: string | null;
  built_year: number | null;
  notes: string | null;
}

/** `kindLabel`: tên loại nơi an nghỉ ("Mộ", "Tháp"…) dùng khi nơi đó không có tên riêng. */
export function fromGraves(rows: GraveSource[], kindLabel: (r: GraveSource) => string): TimelineSuggestion[] {
  return rows
    .filter((r) => r.built_year && r.built_year >= 1)
    .map((r) => {
      const label = (r.name ?? "").trim() || kindLabel(r);
      return {
        key: `grave:${r.id}`,
        source: "grave" as const,
        year: r.built_year as number,
        title: clip(t`Xây dựng ${label}`, 200),
        body: clip(r.notes || r.location_name, 2000),
        iconKey: "citadel" as const,
        photoPersonId: null,
        recommended: false,
      };
    });
}
