/**
 * Tạo 1 announcement mới trên prod — public, hết hạn 7 ngày.
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
  const expiresAt = new Date(now.getTime() + 14 * 86_400_000);

  const body = `Kính gửi quý bà con, dòng họ vừa có thêm 3 tính năng mới:

• XEM NGÀY TỐT — ngay trang Tổng quan có tờ lịch mỗi ngày (dương lịch, âm lịch, can chi, ngày hoàng đạo/hắc đạo, giờ tốt) kèm nút Hôm trước – Hôm sau. Mỗi ngày ghi rõ NÊN và NÊN TRÁNH việc gì; bấm dấu hỏi để đọc vì sao. Cần chọn ngày cho việc lớn (cưới hỏi, làm nhà, khai trương, đi xa, an táng…), chỉ việc bấm loại việc + khoảng thời gian, máy liệt kê sẵn những ngày đẹp.

• BẢNG VÀNG CÔNG ĐỨC — nơi vinh danh tấm lòng đóng góp và thành tích của con cháu trong dòng họ, để ghi nhớ và làm gương cho đời sau.

• QUỸ HỌ MINH BẠCH — sổ thu/chi của quỹ họ cập nhật ngay, ai cũng xem được; mọi thay đổi đều có nhật ký ghi lại rõ ràng, công khai.

Cách mở: vào một dòng họ → xem ngay ở mục Tổng quan, hoặc mở menu để vào "Xem ngày tốt", "Bảng vàng công đức", "Quỹ họ". Kính mời cả nhà dùng thử!`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title:
        "Mới: Xem ngày tốt, Bảng vàng công đức & Quỹ họ minh bạch",
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
