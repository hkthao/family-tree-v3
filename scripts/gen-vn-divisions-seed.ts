/**
 * Sinh migration seed danh mục địa giới (vn_provinces, vn_wards) từ bộ dữ liệu
 * thanglequoc/vietnamese-provinces-database (MIT), file full_json_generated_data_vn_units.json.
 * Chạy: npx tsx scripts/gen-vn-divisions-seed.ts <đường-dẫn-file-json> [đường-dẫn-ra]
 *
 * SQL sinh ra idempotent (upsert theo mã) nên áp lại khi nhà nước điều chỉnh
 * tiếp vẫn an toàn. Kiểm số lượng 34 / 3.321 trước khi ghi file.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { unaccent } from "../src/lib/unaccent.ts";

interface RawWard {
  Code: string;
  Name: string;
  AdministrativeUnitShortName: string;
}
interface RawProvince {
  Code: string;
  Name: string;
  Wards: RawWard[];
}

/** Vùng miền theo mã tỉnh (34 tỉnh/thành). Sửa được ở màn admin sau khi nhập. */
const REGION: Record<string, "bac" | "trung" | "nam"> = {
  ...Object.fromEntries(
    ["01", "04", "08", "11", "12", "14", "15", "19", "20", "22", "24", "25", "31", "33", "37"].map(
      (c) => [c, "bac"],
    ),
  ),
  ...Object.fromEntries(
    ["38", "40", "42", "44", "46", "48", "51", "52", "56", "66", "68"].map((c) => [c, "trung"]),
  ),
  ...Object.fromEntries(
    ["75", "79", "80", "82", "86", "91", "92", "96"].map((c) => [c, "nam"]),
  ),
};

const KIND: Record<string, string> = { Xã: "xa", Phường: "phuong", "Đặc khu": "dac_khu" };

const [src, out = "supabase/migrations/20261106120000_vn_divisions_seed.sql"] =
  process.argv.slice(2);
if (!src) {
  console.error("Thiếu đường dẫn file JSON");
  process.exit(1);
}

const data = JSON.parse(readFileSync(src, "utf8")) as RawProvince[];
const wardCount = data.reduce((n, p) => n + p.Wards.length, 0);
if (data.length !== 34 || wardCount !== 3321) {
  console.error(`Số lượng không khớp: ${data.length} tỉnh, ${wardCount} xã/phường (cần 34 / 3321)`);
  process.exit(1);
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const lines: string[] = [
  "-- Seed danh mục địa giới: 34 tỉnh/thành, 3.321 xã/phường/đặc khu (NQ 388/NQ-UBTVQH16).",
  "-- Nguồn: thanglequoc/vietnamese-provinces-database (MIT). Sinh bởi scripts/gen-vn-divisions-seed.ts.",
  "-- Idempotent: áp lại an toàn.",
  "",
  "insert into public.vn_provinces (code, name, name_unaccent, region) values",
];
lines.push(
  data
    .map((p) => {
      const region = REGION[p.Code];
      if (!region) throw new Error(`Thiếu vùng cho tỉnh ${p.Code} ${p.Name}`);
      return `  (${q(p.Code)}, ${q(p.Name)}, ${q(unaccent(p.Name).toLowerCase())}, ${q(region)})`;
    })
    .join(",\n"),
);
lines.push(
  "on conflict (code) do update set name = excluded.name, name_unaccent = excluded.name_unaccent, region = excluded.region;",
  "",
);

for (const p of data) {
  lines.push("insert into public.vn_wards (code, province_code, name, name_unaccent, kind) values");
  lines.push(
    p.Wards.map((w) => {
      const kind = KIND[w.AdministrativeUnitShortName];
      if (!kind) throw new Error(`Loại lạ: ${w.AdministrativeUnitShortName} (${w.Code})`);
      return `  (${q(w.Code)}, ${q(p.Code)}, ${q(w.Name)}, ${q(unaccent(w.Name).toLowerCase())}, ${q(kind)})`;
    }).join(",\n"),
  );
  lines.push(
    "on conflict (code) do update set province_code = excluded.province_code, name = excluded.name, name_unaccent = excluded.name_unaccent, kind = excluded.kind;",
    "",
  );
}

writeFileSync(out, lines.join("\n"));
console.log(`Đã ghi ${out}: ${data.length} tỉnh, ${wardCount} xã/phường`);
