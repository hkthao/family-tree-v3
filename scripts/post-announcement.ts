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

  const body = `Đợt cập nhật giao diện giúp xem và tra cứu dễ hơn:

• Trang Dòng họ và Sự kiện có thêm chế độ xem Lưới (bấm nút Lưới ở góc) — nhìn tổng quan dạng thẻ, gọn gàng trên cả điện thoại lẫn máy tính.

• Danh sách sự kiện sắp tới giờ chia trang, không còn kéo dài vô tận với họ đông người.

• Các trang danh sách (dòng họ, thành viên, sự kiện, nhật ký…) gọn lại còn 15 mục mỗi trang cho dễ nhìn; trang Thành viên vẫn đổi được số mục/trang.

• Người đã mất hiển thị đúng phong tục: từ 60 tuổi gọi "hưởng thọ", dưới 60 gọi "hưởng dương".

• Tinh chỉnh sơ đồ cây và sổ gia phả PDF: tên dài không còn bị cắt, sơ đồ bắt đầu từ Thuỷ tổ, sắp đúng thứ tự đời và anh - chị - em.

Cả nhà vào xem thử nhé!`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "Mới: Xem dạng lưới, phân trang gọn & nhiều tinh chỉnh hiển thị",
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
