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
  const expiresAt = new Date(now.getTime() + 7 * 86_400_000);

  const body = `Đợt cập nhật lớn lần này thêm nhiều cách lưu giữ và lan toả nét đẹp dòng họ:

• DI SẢN & VĂN HOÁ — mục mới để lưu giữ những gì không có trong cây gia phả: từ đường - đền - chùa, tục lệ - gia phong, giai thoại - công trạng, tư liệu - kỷ vật. Soạn đơn giản (không cần định dạng), có câu hỏi gợi ý, chụp ảnh trực tiếp và GHI ÂM kể chuyện ngay trên điện thoại. Mỗi mục tạo được mã QR để con cháu quét xem.

• KHO THIỆP CHIA SẺ — bấm "Tạo thiệp" để làm tấm thiệp đẹp (giỗ Tổ, tảo mộ, Vu Lan, họp họ, Tết, mừng thọ, khuyến học, tin vui…) gửi thẳng sang Zalo / Facebook. Nhiều mẫu, nhiều tông màu, chọn được kiểu chữ.

• THẺ "KHOE" CÁ NHÂN — ở trang mỗi người có nút tạo thẻ "Tôi là đời thứ N của dòng họ…", kèm ảnh và mã QR, để khoe với bạn bè.

• THỐNG KÊ VUI — trang Tổng quan hiện vài con số thú vị của dòng họ (chi đông nhất, cụ cao tuổi nhất, tên đệm phổ biến…), chia sẻ được luôn.

• NHẮC LỄ TIẾT & SỰ KIỆN gọn hơn: thêm nhanh các ngày lễ truyền thống, xem lịch bấm vào là mở chi tiết.

• SỔ GIA PHẢ PDF nay có cả phần Di sản và Mộ phần dạng thẻ kèm ảnh, trang bìa có mã QR mở dòng họ trên mạng.

• Menu bên trái sắp xếp lại cho dễ tìm, các trang gọn gàng hơn.

Cả nhà vào khám phá và chia sẻ cho con cháu nhé!`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "Mới: Di sản & Văn hoá, Kho thiệp chia sẻ, Thẻ khoe & Thống kê vui",
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
