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

  const body = `Mỗi dòng họ quen một cách đánh số đời khác nhau:

• Nhiều họ tính Thủy tổ là Đời 1, con cháu là Đời 2, 3, 4… (mặc định của app trước nay).
• Có họ lại quen tính Thủy tổ là Đời 0, con cháu mới là Đời 1, 2, 3…

Giờ cả nhà tự chọn được. Vào "Cài đặt dòng họ" (chỉ quản trị clan thấy) → tích vào ô "Thủy tổ là Đời 0" → mọi nơi hiển thị số đời sẽ trừ đi 1 ngay tức thì: cây gia phả, danh bạ, in PDF, cuốn sổ gia phả, trang QR cá nhân, mọi chỗ khác.

Cách đánh số này chỉ thay đổi hiển thị — dữ liệu gốc giữ nguyên, có thể bật / tắt lại bất cứ lúc nào.`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "🎉 Tuỳ chọn mới — Thủy tổ là Đời 0 hay Đời 1?",
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
