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

  const body = `Vừa cập nhật một loạt tính năng mới — mời cả nhà thử:

• Bảng tin dòng họ — đăng tin, sự kiện, cáo phó, tin sinh, thông báo họp họ. Thành viên gửi bài → admin duyệt.
• Thông báo hệ thống — chuông trên thanh tiêu đề, banner đỏ cho tin quan trọng, mark đã đọc / đánh dấu tất cả.
• Video hướng dẫn — 19 clip ngắn (30-70 giây). Vào "Video hướng dẫn" ở menu, hoặc nhấn "Xem hướng dẫn" trên từng trang.
• Linh vật góc dưới — bây giờ có thể kéo đặt ở bất kỳ chỗ nào trên màn hình.
• Liên hệ / phản hồi — trang /lien-he đầy đủ + phân loại Lỗi / Ý kiến / Câu hỏi.
• Giao diện đồng bộ — mỗi trang có icon + tiêu đề + mô tả + link video tương ứng.

Có lỗi hoặc góp ý — nhấn nút Góp ý ở menu trái hoặc vào trang Liên hệ.`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "🎉 Cập nhật lớn — Bảng tin, Thông báo, Video hướng dẫn",
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
