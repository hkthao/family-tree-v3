import {
  bucketOfYear,
  type TimelineBucket,
} from "@/lib/timeline/computeClanTimeline";
import type { TimelineSuggestion } from "@/lib/timeline/suggestions";
import { resolveContext, type MilestoneContext } from "@/lib/timeline/context";
import {
  erasOverlapping,
  type EraCard,
  type TimelineIconKey,
} from "@/lib/timeline/eras";

/** Một hàng trong bảng `clan_timeline_milestones` — một mốc của dòng thời gian. */
export interface TimelineRow {
  id: string;
  clan_id: string;
  /** Mốc nói về người nào (null = mốc chung của dòng họ). */
  person_id: string | null;
  /** Có hiện trên poster dòng họ không (mốc chi tiết của từng người mặc định không). */
  on_clan: boolean;
  /** Can chi của năm, vd "Nhâm Thìn". */
  era: string | null;
  year: number;
  /** Số thứ tự trong cùng một năm (nhỏ hiện trước). */
  sort_order: number;
  title: string;
  body: string | null;
  icon_key: string | null;
  photo_person_id: string | null;
  /** Hình riêng: `lib:<id>` (thư viện của app) hoặc link https (null = ảnh người / biểu tượng). */
  image_url: string | null;
  /** Bối cảnh tự sửa: cả hai null = mặc định theo năm, cả hai "" = ẩn (xem lib/timeline/context.ts). */
  context_title: string | null;
  context_body: string | null;
  /** Khoá gợi ý gia phả đã dùng để tạo mốc (null = mốc tự thêm). */
  source_key: string | null;
}

/** Mốc của dòng thời gian, sẵn sàng để vẽ / sửa. Hoàn toàn đến từ dữ liệu đã lưu, không phụ thuộc cây. */
export interface Milestone {
  /** `row:<id>` — khoá cho ngăn kéo (?pid=). */
  key: string;
  rowId: string;
  /** Người mà mốc nói về (null = mốc chung của dòng họ). */
  personId: string | null;
  /** Có hiện trên poster dòng họ không. */
  onClan: boolean;
  /** Can chi của năm. */
  era: string | null;
  year: number;
  /** Số thứ tự trong cùng một năm. */
  sortOrder: number;
  bucket: TimelineBucket;
  title: string;
  body: string;
  iconKey: TimelineIconKey;
  photoPersonId: string | null;
  /** Hình riêng của mốc (thắng ảnh người). */
  imageUrl: string | null;
  eras: EraCard[];
  /** Bối cảnh hiển thị (mặc định theo năm hoặc bản tự sửa); null = không hiện thẻ. */
  context: MilestoneContext | null;
  /** Mốc này được sao chép từ gợi ý gia phả (true) hay tự thêm (false). */
  fromTree: boolean;
}

export const DEFAULT_MILESTONE_ICON: TimelineIconKey = "scroll";

export function milestoneKey(rowId: string): string {
  return `row:${rowId}`;
}

/** Dựng danh sách mốc từ các hàng đã lưu, xếp theo năm. Hình không hợp lệ → hình mặc định. */
export function buildMilestones(
  rows: TimelineRow[],
  validIcons: readonly string[],
): Milestone[] {
  const valid = new Set(validIcons);
  return rows
    .map((r): Milestone => {
      const bucket = bucketOfYear(r.year);
      return {
        key: milestoneKey(r.id),
        rowId: r.id,
        personId: r.person_id ?? null,
        onClan: r.on_clan ?? true,
        era: r.era ?? null,
        year: r.year,
        sortOrder: r.sort_order ?? 0,
        bucket,
        title: r.title,
        body: r.body ?? "",
        iconKey:
          r.icon_key && valid.has(r.icon_key)
            ? (r.icon_key as TimelineIconKey)
            : DEFAULT_MILESTONE_ICON,
        photoPersonId: r.photo_person_id,
        imageUrl: r.image_url,
        eras: erasOverlapping(bucket.from, bucket.to),
        context: resolveContext(r.year, r.context_title, r.context_body),
        fromTree: !!r.source_key,
      };
    })
    .sort(
      (a, b) =>
        a.year - b.year ||
        a.sortOrder - b.sortOrder ||
        a.title.localeCompare(b.title, "vi"),
    );
}

/** Gợi ý từ gia phả CHƯA được đưa vào dòng thời gian (so theo `source_key`). */
export function pendingSuggestions<T extends { key: string }>(
  candidates: T[],
  rows: TimelineRow[],
): T[] {
  const used = new Set(
    rows.map((r) => r.source_key).filter((k): k is string => !!k),
  );
  return candidates.filter((c) => !used.has(c.key));
}

/** Gợi ý → dữ liệu một mốc mới (SAO CHÉP: từ đây mốc độc lập với cây). */
export function candidateToInput(
  c: Pick<
    TimelineSuggestion,
    "key" | "year" | "title" | "body" | "iconKey" | "photoPersonId"
  >,
) {
  return {
    year: c.year,
    title: c.title,
    body: c.body,
    icon_key: c.iconKey as string,
    photo_person_id: c.photoPersonId,
    image_url: null as string | null,
    person_id: null as string | null,
    on_clan: true,
    context_title: null as string | null,
    context_body: null as string | null,
    source_key: c.key,
  };
}
