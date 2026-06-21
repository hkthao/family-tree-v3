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

  const body = `Gia phả nay có thêm mục "Mộ phần & tro cốt" — ghi lại nơi an nghỉ của các cụ:

• Đủ hình thức: mộ phần (chôn cất), gửi tro cốt ở chùa, tháp họ (chứa tro cốt nhiều người), rải tro.

• Lưu toạ độ → bấm "Chỉ đường" mở bản đồ dẫn tận nơi; đứng tại mộ bấm "Lấy vị trí hiện tại" để lưu nhanh.

• Đính kèm ảnh, gắn người an nghỉ (xem qua lại với hồ sơ từng người), ghi lịch sử cải táng (bốc mộ / sang cát).

• Mỗi mộ / tháp có mã QR — dán hoặc khắc tại nơi an nghỉ, ai quét cũng xem được thông tin.

• Đặt nhắc Tảo mộ / Chạp họ theo ngày âm: cả họ được nhắc trước qua email/thông báo hằng năm.

• Gom mộ theo nghĩa trang / chùa để dễ tra; tự động có trong sách gia phả PDF xuất ra.

Vào menu "Mộ phần & tro cốt" để bắt đầu. Chúc cả nhà gìn giữ phần mộ tổ tiên đầy đủ!`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "✨ Mới: Quản lý Mộ phần & tro cốt",
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
