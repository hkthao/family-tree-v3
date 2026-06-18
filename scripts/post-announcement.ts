/**
 * Tạo 1 announcement mới trên prod — public, hết hạn 3 ngày.
 *
 *   npx tsx scripts/post-announcement.ts
 *
 * Cần env: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong
 * .env.deploy (đã có sẵn).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.deploy" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Cần VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Tìm platform admin để dùng làm created_by.
  const { data: adminProfile, error: pErr } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("is_platform_admin", true)
    .limit(1)
    .single();
  if (pErr || !adminProfile) {
    throw new Error("Không tìm thấy platform admin trên prod.");
  }
  console.log(
    `Platform admin: ${adminProfile.id} (${adminProfile.display_name})`,
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 86_400_000);

  const body = `Trước đây, khi mở link chia sẻ cây gia phả ra ngoài, các anh chị em trong cùng một nhà đôi khi bị xếp sai thứ tự — không đúng "con thứ mấy" mà cả nhà đã nhập.

Nay đã sửa xong: màn hình chia sẻ cây gia phả sắp xếp anh chị em đúng theo thứ tự con trưởng → con thứ → con út, khớp y hệt với cây gia phả bên trong tài khoản.

Cả nhà không cần làm gì thêm — chỉ cần mở lại link chia sẻ (nếu thấy chưa đổi, hãy tải lại trang một lần).`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "🔧 Đã sửa: thứ tự anh chị em trên màn hình chia sẻ cây gia phả",
      body,
      level: "update",
      is_public: true,
      published_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      created_by: adminProfile.id,
    })
    .select("id, title")
    .single();

  if (error) throw new Error(error.message);

  console.log(
    `\n✓ Đã đăng announcement: "${row?.title}" (id ${row?.id})`,
  );
  console.log(`  Public: ✓ (hiện ở /changelog)`);
  console.log(`  Hết hạn: ${expiresAt.toLocaleString("vi-VN")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
