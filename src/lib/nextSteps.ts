import { t } from "@lingui/core/macro";

import type { ClanFeatureKey } from "@/lib/clanFeatures";
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
  /** `gap`: dữ liệu còn thiếu (chỉ người sửa được); `discover`: tính năng chưa dùng, mời thử. */
  kind: "gap" | "discover";
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
  /** Người xem có quyền sửa dòng họ không — chỉ họ mới thấy gợi ý bổ sung dữ liệu. */
  canEdit: boolean;
  /** Tính năng phụ có đang bật cho dòng họ không. */
  isEnabled: (key: ClanFeatureKey) => boolean;
  /** Trợ lý AI có bật trên nền tảng không. */
  aiOn: boolean;
}

export function computeNextSteps(input: NextStepInput): NextStep[] {
  const { persons, todo, counts, customEvents, canEdit, isEnabled, aiOn } = input;
  const out: NextStep[] = [];
  const total = persons.length;
  if (total === 0) return out;
  const gaps: NextStep[] = [];

  if (!persons.some((p) => p.is_root)) {
    gaps.push({
      kind: "gap",
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
    gaps.push({
      kind: "gap",
      id: "anniv",
      title: t`${noAnniv} người mất chưa có giỗ`,
      hint: t`Thêm để cả họ được nhắc`,
      to: "todo",
    });
  }

  const noParents = todo?.find((r) => r.category === "missing_parents")?.count ?? 0;
  if (noParents > 1) {
    gaps.push({
      kind: "gap",
      id: "parents",
      title: t`${noParents} người chưa có cha/mẹ`,
      hint: t`Nối vào đúng đời, đúng nhánh`,
      to: "todo",
    });
  }

  const deceased = persons.filter((p) => !p.is_living).length;
  if (counts && counts.resting_places === 0 && deceased >= 3) {
    gaps.push({
      kind: "gap",
      id: "graves",
      title: t`Ghi nơi an nghỉ của các cụ`,
      hint: t`Mộ phần, chỉ đường, ảnh mộ`,
      to: "graves",
    });
  }

  if (customEvents === 0) {
    gaps.push({
      kind: "gap",
      id: "events",
      title: t`Đặt lịch họp họ, giỗ Tổ`,
      hint: t`Cả họ được nhắc trước`,
      to: "events",
    });
  }

  const withPhoto = persons.filter((p) => !!p.photo_path).length;
  if (total >= 5 && withPhoto / total < 0.2) {
    gaps.push({
      kind: "gap",
      id: "photos",
      title: t`Thêm ảnh chân dung`,
      hint: t`Cây sinh động hơn`,
      to: "todo",
    });
  }

  if (counts && counts.heritage_items === 0 && total >= 10) {
    gaps.push({
      kind: "gap",
      id: "heritage",
      title: t`Lưu từ đường, tục lệ`,
      hint: t`Di sản của dòng họ`,
      to: "heritage",
    });
  }

  const discover: NextStep[] = [];
  const add = (
    id: string,
    title: string,
    hint: string,
    to: string,
    ok = true,
  ) => {
    if (ok) discover.push({ id, kind: "discover", title, hint, to });
  };
  const some = total >= 5;
  add("tree", t`Xem cây gia phả`, t`Kéo, phóng to, chọn người làm tâm`, "tree", some);
  add("share", t`Chia sẻ cây cho họ hàng`, t`Link chỉ xem, không cần đăng nhập`, "tree", canEdit && some);
  add("relations", t`Tra cứu quan hệ`, t`Tổ tiên, anh em, con cháu một người`, "relations", some);
  add("lineage", t`Đường về Thuỷ tổ của bạn`, t`Từ bạn ngược lên các đời`, "my-lineage", some);
  add("map", t`Bản đồ dòng họ`, t`Con cháu ở tỉnh nào`, "map", some);
  add("memory", t`Phòng ký ức 3D`, t`Dạo xem ảnh như triển lãm`, "memory-room", isEnabled("memory_room"));
  add("mosaic", t`Ảnh ghép đại gia đình`, t`Mỗi người góp một mảnh ảnh`, "mosaics", isEnabled("mosaic"));
  add("calendar", t`Lịch giỗ trên điện thoại`, t`Google/Apple Calendar tự cập nhật`, "events", true);
  add("goodday", t`Xem ngày tốt, lịch âm`, t`Chọn ngày cho việc lớn`, "xem-ngay", true);
  add("kinship", t`Cách xưng hô`, t`Gọi nhau là gì theo truyền thống`, "kinship", some);
  add("book", t`Xuất sổ gia phả PDF`, t`In thành cuốn sổ có bìa`, "settings", canEdit && total >= 10);
  add("qr", t`Mã QR cho từng người`, t`In lên bia mộ, danh thiếp`, "qr-export", canEdit && total >= 10);
  add("board", t`Bảng tin dòng họ`, t`Đăng tin vui, tin buồn`, "board", isEnabled("board"));
  add("ai", t`Hỏi trợ lý AI`, t`Hỏi giỗ, xưng hô, tra người`, "tro-ly", aiOn && isEnabled("ai_assistant"));
  add("fund", t`Sổ quỹ họ minh bạch`, t`Ghi thu chi, ai cũng xem được`, "fund", canEdit && isEnabled("fund"));

  // Việc bổ sung dữ liệu (chỉ người sửa được) đi trước; hết việc mới mời khám phá tính năng.
  return [...(canEdit ? gaps : []), ...discover];
}

const KEY = "next-step-snooze-v1";
const DAY = 24 * 3600 * 1000;

type SnoozeMap = Record<string, number>;

function read(): SnoozeMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as SnoozeMap;
  } catch {
    return {};
  }
}

/** Gợi ý `id` của dòng họ `clanId` đang được ẩn (đã bấm "Để sau", hoặc đã mở tính năng đó)? */
export function isSnoozed(clanId: string, id: string, now = Date.now()): boolean {
  const until = read()[`${clanId}:${id}`];
  return typeof until === "number" && now < until;
}

/** Ẩn gợi ý `days` ngày (mặc định 14 = "Để sau"; 365 = đã dùng/đã xem, coi như xong). */
export function snooze(clanId: string, id: string, days = 14, now = Date.now()): void {
  try {
    const m = read();
    m[`${clanId}:${id}`] = now + days * DAY;
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode — gợi ý sẽ hiện lại lần sau, chấp nhận được */
  }
}
