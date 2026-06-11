/**
 * Seed lại Announcements + Bảng tin clan trên DB hiện có — không reset
 * DB, không cần re-create users/clans.
 *
 * Dùng khi đang test Phase B+C: muốn refresh fixture mà không mất dữ
 * liệu thật.
 *
 *   npx tsx scripts/seed-board.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
import { randomUUID } from "node:crypto";

import type { Database } from "../src/lib/database.types";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getPlatformAdmin(): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("is_platform_admin", true)
    .limit(1)
    .single();
  if (error || !data) {
    throw new Error(
      "Không tìm thấy platform admin. Chạy npm run seed trước.",
    );
  }
  return data.id;
}

async function seedAnnouncements(platformAdminId: string): Promise<void> {
  console.log("→ Seeding announcements…");

  const now = new Date();
  const past = (mins: number) =>
    new Date(now.getTime() - mins * 60_000).toISOString();
  const future = (days: number) =>
    new Date(now.getTime() + days * 86_400_000).toISOString();

  await admin
    .from("announcements")
    .delete()
    .gte("created_at", "1970-01-01");

  const rows = await admin
    .from("announcements")
    .insert([
      {
        title: "🎉 Bảng tin dòng họ đã có",
        body:
          "Phase C đã xong: vào dòng họ → Bảng tin để đăng tin, sự kiện, sinh, mất, cáo phó. Thành viên thường gửi bài → admin duyệt.",
        level: "update",
        is_public: true,
        published_at: past(60),
        created_by: platformAdminId,
      },
      {
        title: "Thông báo đẩy (Web Push) sẵn sàng",
        body:
          "Vào Sự kiện → cuộn xuống mục 'Đăng ký nhận thông báo' để bật nhận push trên điện thoại — kể cả khi app đóng.",
        level: "info",
        is_public: true,
        published_at: past(60 * 24 * 3),
        created_by: platformAdminId,
      },
      {
        title: "⚠ Bảo trì cuối tuần",
        body:
          "Hệ thống có thể chậm trong 10 phút vào Chủ Nhật 21:00 do migration.",
        level: "warning",
        is_public: false,
        published_at: past(60 * 6),
        expires_at: future(7),
        created_by: platformAdminId,
      },
      {
        title: "🚨 Sự cố Supabase đã giải quyết",
        body:
          "5h sáng ngày 11/06 có downtime 3 phút bên Supabase. Mọi bài viết / sửa trong khoảng đó đã được auto-retry.",
        level: "critical",
        is_public: false,
        published_at: past(60 * 2),
        expires_at: future(1),
        created_by: platformAdminId,
      },
      {
        title: "(Nháp) Roadmap quý 3",
        body: "Draft sẽ bổ sung sau.",
        level: "info",
        is_public: false,
        published_at: null,
        created_by: platformAdminId,
      },
      {
        title: "Đã hết hạn — Black Friday giảm phí",
        body: "Khuyến mại cũ. Để test view 'Hết hạn' bên admin.",
        level: "info",
        is_public: false,
        published_at: past(60 * 24 * 30),
        expires_at: past(60 * 24 * 10),
        created_by: platformAdminId,
      },
    ])
    .select("id");

  if (rows.error) throw new Error(rows.error.message);
  console.log(`  ${rows.data?.length ?? 0} announcements.`);
}

async function seedClanPosts(platformAdminId: string): Promise<void> {
  console.log("→ Seeding clan posts…");

  // Lấy clan đầu tiên có persons.
  const { data: clan, error: clanErr } = await admin
    .from("clans")
    .select("id, name, owner_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (clanErr || !clan) {
    throw new Error("Không tìm thấy clan nào. Chạy npm run seed trước.");
  }
  console.log(`  Target clan: ${clan.name} (${clan.id})`);

  await admin.from("clan_posts").delete().eq("clan_id", clan.id);

  const { data: persons } = await admin
    .from("persons")
    .select("id, full_name, is_living")
    .eq("clan_id", clan.id)
    .limit(20);
  const livingPerson = (persons ?? []).find((p) => p.is_living);
  const deceasedPerson = (persons ?? []).find((p) => !p.is_living);

  const now = new Date();
  const past = (days: number) =>
    new Date(now.getTime() - days * 86_400_000).toISOString();
  const dateAhead = (days: number) =>
    new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);

  const rows: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      clan_id: clan.id,
      author_id: clan.owner_id,
      type: "notice",
      title: "📌 Họp họ định kỳ Rằm tháng 7",
      body:
        "Mời cả họ về nhà thờ tổ vào Rằm tháng Bảy (Âm lịch) để cùng cúng giỗ. Anh em xa nhớ thu xếp.",
      event_date: dateAhead(14),
      status: "published",
      pinned: true,
      created_at: past(2),
    },
    {
      id: randomUUID(),
      clan_id: clan.id,
      author_id: clan.owner_id,
      type: "event",
      pinned: false,
      title: "Tảo mộ Thanh Minh",
      body:
        "Hẹn 7h sáng tại nhà thờ. Mang theo nhang đèn — quỹ họ lo hoa quả.",
      event_date: dateAhead(45),
      status: "published",
      created_at: past(1),
    },
    {
      id: randomUUID(),
      clan_id: clan.id,
      author_id: clan.owner_id,
      type: "news",
      pinned: false,
      body:
        "Đã hoàn tất sửa cổng nhà thờ tổ. Cảm ơn anh chị em đóng góp.",
      status: "published",
      created_at: past(5),
    },
  ];

  if (deceasedPerson) {
    rows.push({
      id: randomUUID(),
      clan_id: clan.id,
      author_id: clan.owner_id,
      type: "death",
      pinned: false,
      title: `Cáo phó: ${deceasedPerson.full_name}`,
      body: `Trân trọng báo tin cụ ${deceasedPerson.full_name} đã từ trần. Gia đình thông báo để bà con đến viếng.`,
      person_id: deceasedPerson.id,
      status: "published",
      created_at: past(7),
    });
  }

  if (livingPerson) {
    rows.push({
      id: randomUUID(),
      clan_id: clan.id,
      author_id: clan.owner_id,
      type: "birth",
      pinned: false,
      title: `Tin mừng: ${livingPerson.full_name} đã sinh con`,
      body: `Cháu khoẻ mạnh, cả nhà bình an. Xin báo tin để cả họ vui chung.`,
      person_id: livingPerson.id,
      status: "published",
      created_at: past(10),
    });
  }

  rows.push({
    id: randomUUID(),
    clan_id: clan.id,
    author_id: platformAdminId,
    type: "news",
    pinned: false,
    body:
      "(Demo bài chờ duyệt) Em xin đề xuất họp họ qua Zoom cho người ở xa.",
    status: "pending",
    created_at: past(0.3),
  });

  // Thêm 8 bài news lẻ để demo phân trang.
  for (let i = 0; i < 8; i++) {
    rows.push({
      id: randomUUID(),
      clan_id: clan.id,
      author_id: clan.owner_id,
      type: "news",
      pinned: false,
      title: `Tin lưu trữ #${i + 1}`,
      body: `Đây là bài tin cũ thứ ${i + 1} để demo pagination trên bảng tin dòng họ.`,
      status: "published",
      created_at: past(15 + i * 3),
    });
  }

  const ins = await admin.from("clan_posts").insert(rows).select("id");
  if (ins.error) throw new Error(ins.error.message);
  console.log(`  ${ins.data?.length ?? 0} clan posts seeded.`);
}

async function main() {
  const platformAdmin = await getPlatformAdmin();
  console.log(`Platform admin: ${platformAdmin}\n`);

  await seedAnnouncements(platformAdmin);
  await seedClanPosts(platformAdmin);

  console.log("\n✓ Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
