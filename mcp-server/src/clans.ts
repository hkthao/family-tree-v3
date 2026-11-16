/**
 * Chọn dòng họ theo TÊN cho AI: người dùng chỉ nói "họ Huỳnh", không ai phải biết mã UUID. AI gọi `list_my_clans` để biết các họ
 * mình được vào, rồi truyền `clan` là tên (hoặc mã). Tên mơ hồ → trả danh sách ứng viên có mô tả + số người để AI hỏi lại người dùng.
 * File thuần (không đụng DB/env) để test được.
 */

export interface ClanBrief {
  id: string;
  name: string;
  description: string | null;
  person_count: number;
}

const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID = /^[0-9a-f]{8}$/i;

/** Bỏ dấu, đ→d, thường hoá, gộp khoảng trắng: "Dòng  họ HUỲNH" → "dong ho huynh". */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function describeClan(c: ClanBrief, extra = ""): string {
  const desc = c.description?.trim();
  return [`${c.name}`, desc ? desc.slice(0, 80) : null, `${c.person_count} người`, `mã ${c.id.slice(0, 8)}`, extra || null].filter(Boolean).join(" · ");
}

function listFor(candidates: ClanBrief[], max = 15): string {
  const shown = candidates.slice(0, max).map((c) => `- ${describeClan(c)}`).join("\n");
  return candidates.length > max ? `${shown}\n… và ${candidates.length - max} họ nữa (gọi list_my_clans với q để lọc).` : shown;
}

export type ClanResolution = { id: string } | { error: string };

/** Khớp `input` (tên, một phần tên, mã đầy đủ hoặc 8 ký tự đầu của mã) với danh sách dòng họ được phép. */
export function resolveClanInput(candidates: ClanBrief[], input: unknown): ClanResolution {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!candidates.length) return { error: "Không có dòng họ nào để chọn." };
  if (!raw) {
    return candidates.length === 1
      ? { id: candidates[0].id }
      : { error: `Cần chỉ rõ dòng họ (tham số clan: tên hoặc mã). Các họ có thể dùng:\n${listFor(candidates)}` };
  }
  if (FULL_UUID.test(raw)) {
    const hit = candidates.find((c) => c.id.toLowerCase() === raw.toLowerCase());
    return hit ? { id: hit.id } : { error: "Mã dòng họ này không nằm trong các họ bạn được cấp quyền. Gọi list_my_clans để xem." };
  }
  if (SHORT_ID.test(raw)) {
    const hits = candidates.filter((c) => c.id.toLowerCase().startsWith(raw.toLowerCase()));
    if (hits.length === 1) return { id: hits[0].id };
  }

  const q = norm(raw);
  const exact = candidates.filter((c) => norm(c.name) === q);
  // Khớp chính xác → khớp nguyên từ ("do" khớp "dong ho do", không khớp "dong") → cuối cùng mới khớp chuỗi con.
  const words = candidates.filter((c) => ` ${norm(c.name)} `.includes(` ${q} `));
  const pool = exact.length ? exact : words.length ? words : candidates.filter((c) => norm(c.name).includes(q));
  if (pool.length === 1) return { id: pool[0].id };
  if (pool.length === 0) {
    return { error: `Không có dòng họ nào tên "${raw}" trong các họ bạn được cấp quyền. Các họ có thể dùng:\n${listFor(candidates)}` };
  }
  return {
    error: `Có ${pool.length} dòng họ khớp "${raw}" — hãy hỏi người dùng họ nào rồi gọi lại với tên đầy đủ hoặc mã:\n${listFor(pool)}`,
  };
}
