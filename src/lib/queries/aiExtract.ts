import type { SupabaseClient } from "@supabase/supabase-js";

import {
  addChildToFamily,
  assignExistingParent,
  assignExistingSpouse,
  findOrCreateFamily,
} from "./families";
import { createPerson } from "./persons";
import { supabase as defaultClient } from "../supabase";
import type { Database } from "../database.types";

type Client = SupabaseClient<Database>;

/**
 * Ghi những người mà trợ lý đã bóc tách — SAU KHI người dùng bấm xác nhận.
 *
 * Ba điều đáng nói về chỗ này:
 *
 * 1. **Chạy ở trình duyệt, bằng JWT của chính người dùng.** Không phải
 *    service role, không phải Edge Function. Nhờ vậy mọi thứ đã có vẫn
 *    nguyên: RLS chặn người không có quyền, trigger audit ghi lại ai
 *    thêm, và trang /clans/:id/audit lần ngược được y như khi họ tự nhập.
 *
 * 2. **Tái dùng đúng các hàm mà màn Thêm con / Thêm vợ chồng / Thêm cha
 *    mẹ đang dùng.** Không viết đường ghi riêng cho AI: đường riêng là
 *    chỗ luật nghiệp vụ (tìm hay tạo gia đình, chống vòng lặp tổ tiên)
 *    lệch dần khỏi phần còn lại của app mà không ai để ý.
 *
 * 3. **Ghi tuần tự, không song song.** Người sau có thể gắn vào người
 *    trước trong cùng một đề xuất ("thêm ông A, rồi thêm con của ông A"),
 *    nên phải chờ có id thật rồi mới tới người kế.
 */

export type ProposedRelation = "child" | "spouse" | "parent";

export interface ProposedPerson {
  tempId: string;
  fullName: string;
  gender: "M" | "F";
  birthYear: number | null;
  deathYear: number | null;
  relation: ProposedRelation;
  /** id người đã có trong gia phả, hoặc tempId của người đứng trước. */
  relatedTo: string;
  note: string | null;
}

export interface Proposal {
  people: ProposedPerson[];
}

/** Năm → ngày ISO đầu năm, kèm độ chính xác "year" (app đã hỗ trợ sẵn). */
const yearDate = (y: number | null) => (y ? `${String(y).padStart(4, "0")}-01-01` : null);

async function personGender(id: string, client: Client): Promise<"M" | "F"> {
  const { data, error } = await client
    .from("persons")
    .select("gender")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data.gender as "M" | "F";
}

export interface ApplyResult {
  added: number;
}

export async function applyProposal(
  clanId: string,
  proposal: Proposal,
  client: Client = defaultClient,
): Promise<ApplyResult> {
  // tempId → id thật, để người sau gắn được vào người vừa tạo.
  const realId = new Map<string, string>();
  const resolve = (ref: string) => realId.get(ref) ?? ref;

  let added = 0;

  for (const p of proposal.people) {
    const anchorId = resolve(p.relatedTo);
    const birth = yearDate(p.birthYear);
    const death = yearDate(p.deathYear);
    const common = {
      clan_id: clanId,
      full_name: p.fullName,
      gender: p.gender,
      // Có năm mất nghĩa là đã khuất. Không có thì để mặc định "còn sống"
      // như mọi đường thêm người khác.
      is_living: !p.deathYear,
      birth_date: birth,
      birth_date_precision: birth ? ("year" as const) : null,
      death_date: death,
      death_date_precision: death ? ("year" as const) : null,
      bio: p.note,
    };

    let newId: string;
    if (p.relation === "child") {
      const family = await findOrCreateFamily({
        clanId,
        partnerA: { id: anchorId, gender: await personGender(anchorId, client) },
        partnerB: null,
      }, client);
      // AddChildInput dùng `clanId` (camelCase) chứ không phải `clan_id`.
      const { clan_id: _clanId, ...rest } = common;
      const res = await addChildToFamily(
        { ...rest, clanId, family_id: family.id },
        client,
      );
      newId = res.id;
    } else {
      const res = await createPerson(common, client);
      newId = res.id;
      // Hai RPC này tự lo phần khó: khớp dòng họ, tái dùng gia đình sẵn
      // có, và từ chối khi quan hệ tạo thành vòng (cháu làm ông nội).
      if (p.relation === "spouse") {
        await assignExistingSpouse(anchorId, newId, client);
      } else {
        await assignExistingParent(anchorId, newId, client);
      }
    }

    realId.set(p.tempId, newId);
    added += 1;
  }

  return { added };
}

/** Câu mô tả một người trong thẻ xác nhận. Tách ra để test được. */
export function describeProposed(
  p: ProposedPerson,
  anchorName: (ref: string) => string,
): string {
  const rel =
    p.relation === "child"
      ? "con của"
      : p.relation === "spouse"
        ? "vợ/chồng của"
        : p.gender === "M"
          ? "cha của"
          : "mẹ của";
  const years = [p.birthYear && `sinh ${p.birthYear}`, p.deathYear && `mất ${p.deathYear}`]
    .filter(Boolean)
    .join(", ");
  const who = `${p.gender === "M" ? "nam" : "nữ"}${years ? `, ${years}` : ""}`;
  return `${p.fullName} (${who}) — ${rel} ${anchorName(p.relatedTo)}`;
}
