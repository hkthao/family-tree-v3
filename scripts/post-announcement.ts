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

  const body = `Vừa cập nhật vài điểm nhỏ để cả nhà xem gia phả dễ chịu hơn:

• Khi sắp xếp danh sách theo "Đời", vợ giờ đứng cùng hàng với chồng — không còn rơi xuống cuối hoặc lệch đời nữa. Người lấy về cũng được tính cùng đời với người trong họ.
• Khung tên trong cây gia phả thu gọn lại một chút — nhìn được nhiều người trong họ hơn trên cùng một màn hình, in ra giấy cũng vừa khung hơn.

Nếu cả nhà thấy còn điểm nào chưa ổn, bấm nút "Góp ý" ở menu hoặc vào trang Liên hệ. Cảm ơn cả nhà đã dùng và phản hồi.`;

  const { data: row, error } = await admin
    .from("announcements")
    .insert({
      title: "🎉 Cập nhật mới — Cây gia phả gọn hơn, sắp xếp vợ chồng đúng đời",
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
