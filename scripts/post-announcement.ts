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

  const body = `Cây gia phả và sổ PDF nay hiển thị được nhiều thông tin hơn về tuổi thọ và ngày giỗ:

• Thêm mục "Tuổi thọ" trong hồ sơ người đã mất — tự ghi cho các cụ đời trước chỉ còn nhớ tuổi, không có đủ năm sinh/năm mất.

• Hiển thị đúng phong tục: từ 60 tuổi trở lên ghi "hưởng thọ", dưới 60 tuổi ghi "hưởng dương".

• Cài đặt dòng họ có 2 tuỳ chọn (quản trị bật/tắt): hiện ngày giỗ + tuổi thọ của người đã mất; hiện đầy đủ ngày-tháng-năm sinh của người còn sống. Áp cho cả cây trên màn hình lẫn sổ gia phả PDF.

• Sửa lỗi xuất sổ: trước đây sổ PDF còn thiếu thành viên và sắp xếp lộn xộn — nay đầy đủ mọi người, đúng thứ tự đời và trưởng - thứ.

Vào Cài đặt dòng họ để bật các tuỳ chọn hiển thị. Chúc cả nhà giữ gìn gia phả ngày một đầy đủ!`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "Mới: Tuổi thọ, ngày giỗ trên cây & sửa lỗi xuất sổ",
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
