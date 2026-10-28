/**
 * Sửa ngày dương bị quy đổi sai từ ngày âm trước năm 1800.
 *
 * @dqcai/vn-lunar 1.0.1 hỏng bảng năm 1200–1799 (đã vá ở src/lib/lunarDate.ts),
 * nên ai nhập ngày âm đủ ngày/tháng/năm cho các năm tận cùng 8, 9 trước 1800
 * thì birth_date / death_date đã bị ghi sai (ngày giỗ không ảnh hưởng — lấy
 * thẳng từ tháng/ngày âm). Script tính lại ngày dương từ ngày âm đã lưu.
 *
 *   Liệt kê:  npx tsx --tsconfig tsconfig.app.json scripts/fix-pre1800-lunar-dates.ts
 *   Ghi:      … scripts/fix-pre1800-lunar-dates.ts --apply
 *   PROD:     SUPABASE_SERVICE_ROLE_KEY=<self-host key> VITE_SUPABASE_URL=<url> …
 *
 * Bỏ qua dòng họ lịch sử (kind='historical'): ở đó ngày trước 1800 cố ý chỉ
 * lưu âm lịch + năm, không quy đổi.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { lunarToSolarString } from "../src/lib/lunarDate.ts";

config({ path: ".env.local" });

const URL = process.env.VITE_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) {
  console.error("Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const admin = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: historical, error: hErr } = await admin.from("clans").select("id").eq("kind", "historical");
// DB chưa áp migration dòng họ lịch sử → chưa có cột kind, không có gì để bỏ qua.
if (hErr && hErr.code !== "42703") throw hErr;
const skipClans = new Set((historical ?? []).map((c) => c.id as string));

let fixes = 0;
for (const prefix of ["birth", "death"] as const) {
  const { data, error } = await admin
    .from("persons")
    .select(
      `id, clan_id, full_name, ${prefix}_date, ${prefix}_date_precision, ${prefix}_lunar_year, ${prefix}_lunar_month, ${prefix}_lunar_day, ${prefix}_lunar_is_leap`,
    )
    .lt(`${prefix}_lunar_year`, 1800)
    .not(`${prefix}_lunar_month`, "is", null)
    .not(`${prefix}_lunar_day`, "is", null)
    .eq(`${prefix}_date_precision`, "day")
    .is("deleted_at", null);
  if (error) throw error;
  for (const p of (data ?? []) as unknown as Record<string, unknown>[]) {
    if (skipClans.has(p.clan_id as string)) continue;
    const right = lunarToSolarString({
      year: p[`${prefix}_lunar_year`] as number,
      month: p[`${prefix}_lunar_month`] as number,
      day: p[`${prefix}_lunar_day`] as number,
      isLeap: !!p[`${prefix}_lunar_is_leap`],
    });
    const stored = p[`${prefix}_date`] as string | null;
    if (!right || right === stored) continue;
    fixes++;
    console.log(
      `${prefix === "birth" ? "Sinh" : "Mất"} ${p.full_name} (${p.id}): âm ${p[`${prefix}_lunar_year`]}-${p[`${prefix}_lunar_month`]}-${p[`${prefix}_lunar_day`]} — đang lưu ${stored} → đúng ${right}`,
    );
    if (apply) {
      const { error: uErr } = await admin.from("persons").update({ [`${prefix}_date`]: right }).eq("id", p.id as string);
      if (uErr) throw uErr;
    }
  }
}
console.log(fixes ? `\n${fixes} ngày ${apply ? "đã sửa" : "cần sửa — chạy lại với --apply"}.` : "Không có ngày nào bị sai.");
