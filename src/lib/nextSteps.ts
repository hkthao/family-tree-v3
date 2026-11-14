import { t } from "@lingui/core/macro";

import type { PersonForTree } from "@/lib/queries/tree";
import type { TodoSummaryRow } from "@/lib/queries/todo";

/**
 * "Bước tiếp theo" cho Tổng quan: MỘT việc có giá trị nhất mà dòng họ nên làm lúc này, suy từ dữ liệu
 * thật (không phải danh sách mẹo cố định). Hàm thuần: nhận số liệu đã có sẵn trên trang, trả danh sách
 * đã xếp ưu tiên; thẻ chỉ hiện phần tử đầu chưa bị người dùng ẩn.
 *
 * Câu chữ cố ý NGẮN (tiêu đề ≤ ~28 ký tự, phụ đề ≤ ~40) để vừa MỘT dòng trên điện thoại.
 */
export interface NextStep {
  id: string;
  title: string;
  hint: string;
  /** Đường dẫn con trong dòng họ, vd `people`, `todo`. */
  to: string;
}

export interface NextStepInput {
  persons: Pick<
    PersonForTree,
    "is_root" | "is_living" | "death_date" | "photo_path" | "death_anniv_lunar_month"
  >[];
  todo: TodoSummaryRow[] | undefined;
  counts: { resting_places: number; heritage_items: number } | undefined;
  /** Số sự kiện tuỳ chỉnh đã tạo (họp họ, giỗ Tổ…). */
  customEvents: number | undefined;
}

export function computeNextSteps(input: NextStepInput): NextStep[] {
  const { persons, todo, counts, customEvents } = input;
  const out: NextStep[] = [];
  const total = persons.length;
  if (total === 0) return out;

  if (!persons.some((p) => p.is_root)) {
    out.push({
      id: "root",
      title: t`Chưa đánh dấu Thuỷ tổ`,
      hint: t`Để cây vẽ đúng các đời`,
      to: "people",
    });
  }

  const noAnniv = persons.filter(
    (p) => !p.is_living && !p.death_date && !p.death_anniv_lunar_month,
  ).length;
  if (noAnniv > 0) {
    out.push({
      id: "anniv",
      title: t`${noAnniv} người mất chưa có giỗ`,
      hint: t`Thêm để cả họ được nhắc`,
      to: "todo",
    });
  }

  const noParents = todo?.find((r) => r.category === "missing_parents")?.count ?? 0;
  if (noParents > 1) {
    out.push({
      id: "parents",
      title: t`${noParents} người chưa có cha/mẹ`,
      hint: t`Nối vào đúng đời, đúng nhánh`,
      to: "todo",
    });
  }

  const deceased = persons.filter((p) => !p.is_living).length;
  if (counts && counts.resting_places === 0 && deceased >= 3) {
    out.push({
      id: "graves",
      title: t`Ghi nơi an nghỉ của các cụ`,
      hint: t`Mộ phần, chỉ đường, ảnh mộ`,
      to: "graves",
    });
  }

  if (customEvents === 0) {
    out.push({
      id: "events",
      title: t`Đặt lịch họp họ, giỗ Tổ`,
      hint: t`Cả họ được nhắc trước`,
      to: "events",
    });
  }

  const withPhoto = persons.filter((p) => !!p.photo_path).length;
  if (total >= 5 && withPhoto / total < 0.2) {
    out.push({
      id: "photos",
      title: t`Thêm ảnh chân dung`,
      hint: t`Cây sinh động hơn`,
      to: "todo",
    });
  }

  if (counts && counts.heritage_items === 0 && total >= 10) {
    out.push({
      id: "heritage",
      title: t`Lưu từ đường, tục lệ`,
      hint: t`Di sản của dòng họ`,
      to: "heritage",
    });
  }

  return out;
}

const KEY = "next-step-snooze-v1";
const SNOOZE_MS = 14 * 24 * 3600 * 1000;

type SnoozeMap = Record<string, number>;

function read(): SnoozeMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as SnoozeMap;
  } catch {
    return {};
  }
}

/** Gợi ý `id` của dòng họ `clanId` đang được ẩn (đã bấm "Để sau" trong 14 ngày qua)? */
export function isSnoozed(clanId: string, id: string, now = Date.now()): boolean {
  const at = read()[`${clanId}:${id}`];
  return typeof at === "number" && now - at < SNOOZE_MS;
}

export function snooze(clanId: string, id: string, now = Date.now()): void {
  try {
    const m = read();
    m[`${clanId}:${id}`] = now;
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode — gợi ý sẽ hiện lại lần sau, chấp nhận được */
  }
}
