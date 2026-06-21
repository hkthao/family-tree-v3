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

  const body = `Vài cải tiến giúp ghi chép gia phả đúng và nhanh hơn:

• Thứ tự vợ/chồng: với người có nhiều đời vợ, nay có thể sắp xếp vợ cả – vợ hai – vợ ba bằng nút mũi tên ngay trong trang của người đó.

• Ngày mất theo âm lịch: ưu tiên nhập ngày âm. Các cụ đời trước thường chỉ còn nhớ ngày giỗ — nay chỉ cần điền ngày và tháng âm, không bắt buộc nhập năm.

• Thêm con của vợ thứ dễ hơn: khi thêm con, chọn rõ "con chung với ai" (vợ cả hay vợ hai). Các ô thêm vợ/chồng và cha/mẹ nay cũng nhập được ngày mất.

• Tiện hơn trên điện thoại: sau khi xem chi tiết rồi bấm Quay lại, danh sách vẫn giữ nguyên tab, ô tìm kiếm và đúng vị trí đang xem — không phải tìm lại từ đầu.

Cả nhà không cần làm gì thêm. Chúc cả nhà ghi chép gia phả vui và đầy đủ!`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "✨ Cập nhật: sắp xếp thứ tự vợ, ngày giỗ âm lịch & nhập liệu dễ hơn",
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
