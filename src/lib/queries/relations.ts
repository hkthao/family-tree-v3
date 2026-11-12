import { supabase } from "@/lib/supabase";
import type { RelFamily, RelPerson } from "@/lib/relations";

/** Trần số dòng — vượt `max_rows` mặc định của PostgREST (1000) thì phải chỉ rõ `.range()`. */
const FETCH_MAX = 9999;

const PERSON_COLS =
  "id, full_name, gender, is_living, is_root, birth_date, death_date, generation, birth_family_id, birth_order, birth_place, burial_place, lifespan_years";

/** Toàn bộ người + gia đình của dòng họ để dựng bảng quan hệ (chỉ thành viên đọc được). */
export async function getRelationsData(
  clanId: string,
): Promise<{ persons: RelPerson[]; families: RelFamily[] }> {
  const [pq, fq] = await Promise.all([
    supabase
      .from("persons")
      .select(PERSON_COLS)
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .range(0, FETCH_MAX),
    supabase
      .from("families")
      .select("id, husband_id, wife_id, spouse_order, created_at")
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .range(0, FETCH_MAX),
  ]);
  if (pq.error) throw new Error(pq.error.message);
  if (fq.error) throw new Error(fq.error.message);
  return {
    persons: (pq.data ?? []) as RelPerson[],
    families: (fq.data ?? []) as RelFamily[],
  };
}
