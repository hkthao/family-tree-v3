import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { unaccent } from "@/lib/unaccent";

type Client = SupabaseClient<Database>;

export type VnRegion = "bac" | "trung" | "nam";
export type VnWardKind = "xa" | "phuong" | "dac_khu";

export const VN_REGION_LABEL: Record<VnRegion, string> = {
  bac: "Miền Bắc",
  trung: "Miền Trung",
  nam: "Miền Nam",
};

export const VN_WARD_KIND_LABEL: Record<VnWardKind, string> = {
  xa: "Xã",
  phuong: "Phường",
  dac_khu: "Đặc khu",
};

export interface VnProvince {
  code: string;
  name: string;
  region: VnRegion;
}

export interface VnWard {
  code: string;
  province_code: string;
  name: string;
  kind: VnWardKind;
}

export type VnProvinceInput = VnProvince;
export type VnWardInput = VnWard;

/** Kích thước một trang danh sách xã/phường (có ~3.300 dòng, không tải một lượt). */
export const WARD_PAGE_SIZE = 50;

export async function listProvinces(
  client: Client = defaultClient,
): Promise<VnProvince[]> {
  const { data, error } = await client
    .from("vn_provinces")
    .select("code, name, region")
    .order("name_unaccent");
  if (error) throw new Error(error.message);
  return (data ?? []) as VnProvince[];
}

export interface ListWardsParams {
  provinceCode?: string | null;
  kind?: VnWardKind | null;
  search?: string;
  /** Trang tính từ 0. */
  page: number;
  pageSize?: number;
}

export async function listWards(
  params: ListWardsParams,
  client: Client = defaultClient,
): Promise<{ rows: VnWard[]; total: number }> {
  const size = params.pageSize ?? WARD_PAGE_SIZE;
  let q = client
    .from("vn_wards")
    .select("code, province_code, name, kind", { count: "exact" })
    .order("name_unaccent")
    .range(params.page * size, (params.page + 1) * size - 1);
  if (params.provinceCode) q = q.eq("province_code", params.provinceCode);
  if (params.kind) q = q.eq("kind", params.kind);
  const term = unaccent((params.search ?? "").trim()).toLowerCase();
  // Bỏ ký tự có nghĩa trong cú pháp `ilike` / `or` của PostgREST.
  const safe = term.replace(/[%_,()\\]/g, " ").trim();
  if (safe) q = q.ilike("name_unaccent", `%${safe}%`);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as VnWard[], total: count ?? 0 };
}

export async function countWardsByProvince(
  client: Client = defaultClient,
): Promise<Record<string, number>> {
  const provinces = await listProvinces(client);
  const entries = await Promise.all(
    provinces.map(async (p) => {
      const { count, error } = await client
        .from("vn_wards")
        .select("code", { count: "exact", head: true })
        .eq("province_code", p.code);
      if (error) throw new Error(error.message);
      return [p.code, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

const normName = (name: string) => name.trim().replace(/\s+/g, " ");

export async function saveProvince(
  input: VnProvinceInput,
  isNew: boolean,
  client: Client = defaultClient,
): Promise<void> {
  const name = normName(input.name);
  const row = {
    code: input.code.trim(),
    name,
    name_unaccent: unaccent(name).toLowerCase(),
    region: input.region,
  };
  const { error } = isNew
    ? await client.from("vn_provinces").insert(row)
    : await client.from("vn_provinces").update(row).eq("code", row.code);
  if (error) throw new Error(error.message);
}

export async function deleteProvince(
  code: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("vn_provinces").delete().eq("code", code);
  if (error) throw new Error(error.message);
}

export async function saveWard(
  input: VnWardInput,
  isNew: boolean,
  client: Client = defaultClient,
): Promise<void> {
  const name = normName(input.name);
  const row = {
    code: input.code.trim(),
    province_code: input.province_code,
    name,
    name_unaccent: unaccent(name).toLowerCase(),
    kind: input.kind,
  };
  const { error } = isNew
    ? await client.from("vn_wards").insert(row)
    : await client.from("vn_wards").update(row).eq("code", row.code);
  if (error) throw new Error(error.message);
}

export async function deleteWard(
  code: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("vn_wards").delete().eq("code", code);
  if (error) throw new Error(error.message);
}

/** Xoá lần lượt theo cụm nhỏ; mục nào bị chặn (còn xã/phường, đang được dùng làm địa chỉ) thì đếm là lỗi, không dừng cả lượt. */
async function deleteMany(
  codes: string[],
  remove: (code: string) => Promise<void>,
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < codes.length; i += 10) {
    const results = await Promise.allSettled(codes.slice(i, i + 10).map(remove));
    for (const r of results) {
      if (r.status === "fulfilled") deleted++;
      else failed++;
    }
  }
  return { deleted, failed };
}

export const deleteProvinces = (codes: string[], client: Client = defaultClient) =>
  deleteMany(codes, (c) => deleteProvince(c, client));

export const deleteWards = (codes: string[], client: Client = defaultClient) =>
  deleteMany(codes, (c) => deleteWard(c, client));

/** Toàn bộ xã/phường của một tỉnh (≤ ~250 dòng) — cho ô chọn địa chỉ. */
export async function listWardsOfProvince(
  provinceCode: string,
  client: Client = defaultClient,
): Promise<VnWard[]> {
  const { data, error } = await client
    .from("vn_wards")
    .select("code, province_code, name, kind")
    .eq("province_code", provinceCode)
    .order("name_unaccent")
    .range(0, 999);
  if (error) throw new Error(error.message);
  return (data ?? []) as VnWard[];
}
