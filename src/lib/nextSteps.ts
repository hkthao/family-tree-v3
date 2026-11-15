import { t } from "@lingui/core/macro";

import type { ClanFeatureKey } from "@/lib/clanFeatures";
import { solarStringToLunar } from "@/lib/lunarDate";
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
  /** Số giỗ / sự kiện của dòng họ rơi trong 7 ngày tới — có thì ưu tiên gợi ý liên quan lịch và chia sẻ. */
  soonEvents?: number;
  /** Thời điểm tính "mùa" (Tết, Chạp họ). Mặc định: bây giờ. */
  now?: Date;
}

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32): cùng hạt → cùng thứ tự, để thẻ không nhảy khi dữ liệu tải dần. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * TRỌNG SỐ cơ sở của từng gợi ý: việc bổ sung dữ liệu nặng hơn lời mời khám phá (làm đủ dữ liệu thì mọi tính năng
 * khác mới có chất liệu). Trong nhóm khám phá, tính năng "dư địa" lớn mà số liệu Umami cho thấy ít người biết
 * (chia sẻ, lịch, tra cứu quan hệ, trợ lý AI) cao hơn tính năng vốn đã nhiều người dùng (xem cây) hoặc ít ai cần (quỹ).
 */
const BASE_WEIGHT: Record<string, number> = {
  root: 6,
  anniv: 4,
  parents: 3.5,
  graves: 3,
  events: 3,
  photos: 2,
  heritage: 1.5,
  share: 1.5,
  relations: 1.5,
  calendar: 1.5,
  ai: 1.2,
  lineage: 1,
  map: 1,
  memory: 1,
  mosaic: 1,
  goodday: 1,
  book: 1,
  kinship: 0.8,
  qr: 0.8,
  board: 0.6,
  fund: 0.5,
  tree: 0.5,
};

/** Tháng Chạp / tháng Giêng âm lịch: mùa giỗ, tảo mộ, Chạp họ và xem ngày. */
function isTetSeason(now: Date): boolean {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lunar = solarStringToLunar(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  );
  return lunar?.month === 12 || lunar?.month === 1;
}

/** Hệ số nhân theo NGỮ CẢNH thời điểm (mùa Tết, giỗ sắp tới) — 1 = không đổi. */
function contextMultiplier(id: string, ctx: { tet: boolean; soon: boolean }): number {
  let m = 1;
  if (ctx.tet) {
    if (id === "goodday") m *= 3;
    if (id === "graves" || id === "events" || id === "calendar") m *= 2;
    if (id === "share") m *= 1.5;
  }
  if (ctx.soon) {
    if (id === "calendar") m *= 3;
    if (id === "share") m *= 2;
    if (id === "anniv") m *= 1.5;
  }
  return m;
}

/**
 * Xếp thứ tự có trọng số. Có `rng`: lấy mẫu ngẫu nhiên KHÔNG hoàn lại theo trọng số (khoá `u^(1/w)` giảm dần) — nặng
 * hơn thì hay đứng đầu hơn nhưng không chắc chắn, nên mỗi lần vào trang vẫn gặp gợi ý khác. Không có `rng`: xếp
 * theo trọng số giảm dần (ổn định), dùng cho test và chỗ cần kết quả cố định.
 */
function weightedOrder(items: { step: NextStep; w: number }[], rng?: () => number): NextStep[] {
  if (!rng) {
    return items
      .map((x, i) => ({ ...x, i }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .map((x) => x.step);
  }
  return items
    .map((x) => ({ x, k: Math.pow(rng(), 1 / x.w) }))
    .sort((a, b) => b.k - a.k)
    .map(({ x }) => x.step);
}

/**
 * `rng`: nguồn ngẫu nhiên để chọn TOÀN BỘ danh sách (việc bổ sung dữ liệu lẫn lời mời khám phá) THEO TRỌNG SỐ, để mỗi lần
 * vào trang gặp một gợi ý khác nhưng việc quan trọng/đúng mùa hay xuất hiện hơn. Không truyền `rng` thì xếp theo
 * trọng số giảm dần: việc bổ sung dữ liệu trước, rồi tới khám phá.
 */
export function computeNextSteps(
  input: NextStepInput,
  rng?: () => number,
): NextStep[] {
  const { persons, todo, counts, customEvents, canEdit, isEnabled, aiOn, soonEvents, now } = input;
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

  // Chọn theo trọng số (gap nặng hơn khám phá; mùa Tết / giỗ sắp tới nâng gợi ý liên quan).
  const ctx = { tet: isTetSeason(now ?? new Date()), soon: (soonEvents ?? 0) > 0 };
  return weightedOrder(
    [...(canEdit ? gaps : []), ...discover].map((step) => ({
      step,
      w: (BASE_WEIGHT[step.id] ?? 1) * contextMultiplier(step.id, ctx),
    })),
    rng,
  );
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
