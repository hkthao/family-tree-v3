/**
 * Bộ tool CHỈ-ĐỌC cho trợ lý hỏi đáp.
 *
 * Nguyên tắc cứng của cả tính năng (docs/plan-ai-tro-ly.md §Tính năng A):
 * **logic tiếng Việt phải giữ nguyên tính tất định.** LLM đoán
 * chú/bác/cậu/dì sẽ sai, và tính giỗ âm lịch thì sai chắc chắn. Nên LLM
 * chỉ làm việc hiểu câu hỏi và chọn tool; đáp số do code cũ tính.
 *
 * Hai hệ quả:
 *  - Không nhồi cây gia phả vào prompt → prompt giữ ~6K token, chạy được
 *    cả dòng họ 5.000 người, và giá không phình.
 *  - Mọi truy vấn chạy bằng client mang JWT của người gọi, KHÔNG phải
 *    service role → RLS còn nguyên hiệu lực.
 *
 * Không có tool ghi. Kể cả khi bị prompt injection qua trường `bio` thì
 * cũng không có gì để xoá.
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { computeKinship, type KinshipPerson } from "../_shared/vendor/kinship.ts";
import { lunarAnniversaryInSolarYear } from "../_shared/vendor/lunarDate.ts";
import type { ToolSpec } from "../_shared/llm/types.ts";

/** Trần cứng cho mọi tool trả danh sách — chặn model kéo cả dòng họ về. */
const MAX_ROWS = 25;

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "search_person",
    description:
      "Tìm người trong dòng họ theo tên (không dấu cũng được). Dùng khi câu hỏi nhắc tới một người mà chưa biết id. Trả về tối đa 25 người.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tên hoặc một phần tên" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_person",
    description:
      "Lấy chi tiết một người: năm sinh, năm mất, ngày giỗ âm lịch, đời thứ mấy, cha mẹ, vợ/chồng, con.",
    parameters: {
      type: "object",
      properties: {
        person_id: { type: "string", description: "id lấy từ search_person" },
      },
      required: ["person_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_kinship",
    description:
      "Tra cách xưng hô giữa hai người trong dòng họ: người A gọi người B là gì và ngược lại. LUÔN dùng tool này cho câu hỏi xưng hô, KHÔNG được tự suy luận chú/bác/cô/cậu/dì.",
    parameters: {
      type: "object",
      properties: {
        person_a_id: { type: "string" },
        person_b_id: { type: "string" },
      },
      required: ["person_a_id", "person_b_id"],
      additionalProperties: false,
    },
  },
  {
    name: "upcoming_anniversaries",
    description:
      "Danh sách ngày giỗ sắp tới, đã quy đổi từ âm lịch sang dương lịch. LUÔN dùng tool này cho câu hỏi về ngày giỗ, KHÔNG được tự tính lịch âm.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Số ngày tới cần xem, mặc định 60, tối đa 400",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "clan_stats",
    description:
      "Thống kê nhanh dòng họ: tổng số người, số người còn sống, số đời.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
];

const PERSON_COLS =
  "id, full_name, gender, is_living, generation, birth_date, death_date, " +
  "death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap, " +
  "birth_family_id";

function year(d: string | null): number | null {
  return d ? Number(d.slice(0, 4)) : null;
}

/** Nạp đủ dữ liệu cho computeKinship: persons + families của cả clan. */
async function loadKinshipIndex(
  sb: SupabaseClient,
  clanId: string,
): Promise<Map<string, KinshipPerson>> {
  const [{ data: persons }, { data: families }] = await Promise.all([
    sb
      .from("persons")
      .select("id, full_name, gender, birth_date, birth_family_id")
      .eq("clan_id", clanId)
      .is("deleted_at", null),
    sb.from("families").select("id, husband_id, wife_id").eq("clan_id", clanId),
  ]);

  const fam = new Map(
    (families ?? []).map((f) => [
      f.id as string,
      { father: f.husband_id as string | null, mother: f.wife_id as string | null },
    ]),
  );

  const map = new Map<string, KinshipPerson>();
  for (const p of persons ?? []) {
    const f = p.birth_family_id ? fam.get(p.birth_family_id as string) : null;
    map.set(p.id as string, {
      id: p.id as string,
      full_name: p.full_name as string,
      gender: p.gender as "M" | "F",
      birth_year: year(p.birth_date as string | null),
      father_id: f?.father ?? null,
      mother_id: f?.mother ?? null,
    });
  }
  return map;
}

export interface ToolContext {
  sb: SupabaseClient;
  clanId: string;
}

/**
 * Chạy một tool. Kết quả trả về dạng chuỗi cho model đọc.
 *
 * Mọi lỗi được nuốt thành thông báo cho model chứ không ném ra — model
 * cần biết tool hỏng để nói lại với người dùng, chứ không phải để cả
 * lượt sập.
 */
export async function runTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case "search_person":
        return await searchPerson(ctx, String(args.name ?? ""));
      case "get_person":
        return await getPerson(ctx, String(args.person_id ?? ""));
      case "get_kinship":
        return await getKinship(
          ctx,
          String(args.person_a_id ?? ""),
          String(args.person_b_id ?? ""),
        );
      case "upcoming_anniversaries":
        return await upcomingAnniversaries(ctx, Number(args.days ?? 60));
      case "clan_stats":
        return await clanStats(ctx);
      default:
        return `Không có công cụ tên "${name}".`;
    }
  } catch (e) {
    return `Công cụ ${name} gặp lỗi: ${(e as Error).message}`;
  }
}

async function searchPerson(ctx: ToolContext, name: string): Promise<string> {
  const q = name.trim();
  if (!q) return "Cần nhập tên để tìm.";
  const { data, error } = await ctx.sb
    .from("persons")
    .select(PERSON_COLS)
    .eq("clan_id", ctx.clanId)
    .is("deleted_at", null)
    .or(`full_name.ilike.%${q}%,full_name_unaccent.ilike.%${q}%`)
    .limit(MAX_ROWS);
  if (error) throw new Error(error.message);
  if (!data?.length) return `Không tìm thấy ai tên "${q}" trong dòng họ.`;

  return data
    .map((p) => {
      const b = year(p.birth_date as string | null);
      const d = year(p.death_date as string | null);
      const life = b || d ? ` (${b ?? "?"}–${d ?? (p.is_living ? "nay" : "?")})` : "";
      const gen = p.generation ? `, đời ${p.generation}` : "";
      return `${p.id} · ${p.full_name}${life}${gen}`;
    })
    .join("\n");
}

async function getPerson(ctx: ToolContext, id: string): Promise<string> {
  const { data: p, error } = await ctx.sb
    .from("persons")
    .select(PERSON_COLS)
    .eq("clan_id", ctx.clanId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return "Không tìm thấy người này.";

  const lines = [
    `Họ tên: ${p.full_name}`,
    `Giới tính: ${p.gender === "M" ? "nam" : "nữ"}`,
    `Tình trạng: ${p.is_living ? "còn sống" : "đã mất"}`,
  ];
  if (p.generation) lines.push(`Đời thứ: ${p.generation}`);
  if (p.birth_date) lines.push(`Ngày sinh: ${p.birth_date}`);
  if (p.death_date) lines.push(`Ngày mất: ${p.death_date}`);
  if (p.death_anniv_lunar_month && p.death_anniv_lunar_day) {
    lines.push(
      `Ngày giỗ: ${p.death_anniv_lunar_day} tháng ${p.death_anniv_lunar_month} âm lịch` +
        (p.death_anniv_lunar_is_leap ? " (tháng nhuận)" : ""),
    );
  }
  return lines.join("\n");
}

async function getKinship(
  ctx: ToolContext,
  aId: string,
  bId: string,
): Promise<string> {
  const index = await loadKinshipIndex(ctx.sb, ctx.clanId);
  const a = index.get(aId);
  const b = index.get(bId);
  if (!a || !b) return "Một trong hai người không có trong dòng họ này.";

  const r = computeKinship(aId, bId, index);
  return [
    `${a.full_name} gọi ${b.full_name} là: ${r.aCallsB}`,
    `${b.full_name} gọi ${a.full_name} là: ${r.bCallsA}`,
    `Giải thích: ${r.reason}`,
  ].join("\n");
}

async function upcomingAnniversaries(
  ctx: ToolContext,
  daysRaw: number,
): Promise<string> {
  const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 60, 1), 400);
  const { data, error } = await ctx.sb
    .from("persons")
    .select(
      "id, full_name, generation, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap",
    )
    .eq("clan_id", ctx.clanId)
    .eq("is_living", false)
    .not("death_anniv_lunar_month", "is", null)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  if (!data?.length) return "Dòng họ chưa ghi ngày giỗ của ai.";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const until = new Date(today);
  until.setDate(until.getDate() + days);

  // Quy đổi âm → dương cho năm nay và năm sau, rồi lấy lần rơi vào cửa sổ.
  const rows: Array<{ when: Date; text: string }> = [];
  for (const p of data) {
    for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
      const solar = lunarAnniversaryInSolarYear(
        {
          month: p.death_anniv_lunar_month as number,
          day: p.death_anniv_lunar_day as number,
          isLeap: !!p.death_anniv_lunar_is_leap,
        },
        y,
      );
      if (!solar) continue;
      const when = new Date(`${solar}T00:00:00`);
      if (when < today || when > until) continue;
      rows.push({
        when,
        text:
          `${solar} — giỗ ${p.full_name}` +
          (p.generation ? ` (đời ${p.generation})` : "") +
          ` · ${p.death_anniv_lunar_day}/${p.death_anniv_lunar_month} âm lịch`,
      });
      break;
    }
  }

  if (!rows.length) return `Không có ngày giỗ nào trong ${days} ngày tới.`;
  rows.sort((x, y) => x.when.getTime() - y.when.getTime());
  return rows.slice(0, MAX_ROWS).map((r) => r.text).join("\n");
}

async function clanStats(ctx: ToolContext): Promise<string> {
  const [total, living, gens] = await Promise.all([
    ctx.sb
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", ctx.clanId)
      .is("deleted_at", null),
    ctx.sb
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", ctx.clanId)
      .eq("is_living", true)
      .is("deleted_at", null),
    ctx.sb
      .from("persons")
      .select("generation")
      .eq("clan_id", ctx.clanId)
      .not("generation", "is", null)
      .is("deleted_at", null)
      .order("generation", { ascending: false })
      .limit(1),
  ]);

  const maxGen = gens.data?.[0]?.generation ?? null;
  return [
    `Tổng số người: ${total.count ?? 0}`,
    `Đang còn sống: ${living.count ?? 0}`,
    maxGen ? `Số đời đã ghi: ${maxGen}` : "Chưa tính được số đời.",
  ].join("\n");
}
