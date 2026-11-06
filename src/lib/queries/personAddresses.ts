import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

/** Nơi ở hiện tại của một người. Tuỳ chọn; chỉ thành viên dòng họ xem được (RLS). */
export interface PersonAddress {
  person_id: string;
  province_code: string | null;
  ward_code: string | null;
  street_detail: string | null;
  country: string;
}

export type PersonAddressInput = {
  province_code: string | null;
  ward_code: string | null;
  street_detail: string | null;
};

export async function getPersonAddress(
  personId: string,
  client: Client = defaultClient,
): Promise<PersonAddress | null> {
  const { data, error } = await client
    .from("person_addresses")
    .select("person_id, province_code, ward_code, street_detail, country")
    .eq("person_id", personId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PersonAddress | null) ?? null;
}

/**
 * Lưu địa chỉ; rỗng hoàn toàn (không tỉnh, không xã, không chi tiết) thì XOÁ hàng — "không nhập
 * thì không xuất hiện trên bản đồ". `clan_id` do trigger phía DB điền từ người đó.
 */
export async function savePersonAddress(
  personId: string,
  input: PersonAddressInput,
  client: Client = defaultClient,
): Promise<void> {
  const empty = !input.province_code && !input.ward_code && !input.street_detail?.trim();
  if (empty) {
    const { error } = await client.from("person_addresses").delete().eq("person_id", personId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from("person_addresses").upsert(
    {
      person_id: personId,
      // clan_id bị trigger ghi đè từ persons; cột NOT NULL nên cần một giá trị hợp lệ về kiểu.
      clan_id: "00000000-0000-0000-0000-000000000000",
      province_code: input.province_code,
      ward_code: input.province_code ? input.ward_code : null,
      street_detail: input.street_detail?.trim() || null,
      country: "VN",
    },
    { onConflict: "person_id" },
  );
  if (error) throw new Error(error.message);
}

/** Một người có địa chỉ trong một tỉnh — cho danh sách khi bấm ghim / tỉnh trên Bản đồ. */
export interface PersonInProvince {
  person_id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  ward_name: string | null;
  ward_kind: string | null;
}

/** Người của dòng họ có địa chỉ ở `provinceCode` (RLS: chỉ thành viên dòng họ đọc được). */
export async function listPeopleInProvince(
  clanId: string,
  provinceCode: string,
  includeDeceased: boolean,
  client: Client = defaultClient,
): Promise<PersonInProvince[]> {
  const { data, error } = await client
    .from("person_addresses")
    .select(
      "person_id, persons!inner(full_name, gender, is_living, deleted_at), vn_wards(name, kind)",
    )
    .eq("clan_id", clanId)
    .eq("province_code", provinceCode)
    .eq("country", "VN")
    .is("persons.deleted_at", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => {
    const p = r.persons as unknown as { full_name: string; gender: "M" | "F"; is_living: boolean };
    const w = r.vn_wards as unknown as { name: string; kind: string } | null;
    return {
      person_id: r.person_id,
      full_name: p.full_name,
      gender: p.gender,
      is_living: p.is_living,
      ward_name: w?.name ?? null,
      ward_kind: w?.kind ?? null,
    };
  });
  return rows
    .filter((r) => includeDeceased || r.is_living)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
}
