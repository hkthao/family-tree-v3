/**
 * Seed dữ liệu mẫu cho BẢNG VÀNG CÔNG ĐỨC (honor_entries) + QUỸ HỌ
 * (fund_transactions) vào Supabase LOCAL, để chụp ảnh minh hoạ.
 *
 *   npm run db:start   # nếu local chưa chạy
 *   npm run seed       # tạo dòng họ + người (nếu chưa có)
 *   npx tsx scripts/seed-honor-fund.ts
 *
 * Mặc định nhắm dòng họ ĐÔNG người nhất (bộ demo `npm run seed`). Có thể chỉ
 * định tên dòng họ khác: `npx tsx scripts/seed-honor-fund.ts "Họ Lê"`.
 * Chạy lại nhiều lần được: xoá sạch honor/fund cũ của dòng họ đó rồi seed mới.
 * Cần SUPABASE_SERVICE_ROLE_KEY trong .env.local (bypass RLS).
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const URL = process.env.VITE_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) {
  console.error("Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

const admin = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** yyyy-mm-dd cách hôm nay `daysAgo` ngày. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // 1. Chọn dòng họ. Có tên truyền vào thì khớp theo tên; không thì lấy
  //    dòng họ ĐÔNG người nhất (bộ demo thật, tránh các clan test rỗng).
  const wantName = process.argv[2]?.trim();
  const { data: clans, error: cErr } = await admin
    .from("clans")
    .select("id, name");
  if (cErr) throw cErr;
  if (!clans || clans.length === 0) {
    console.error("Chưa có dòng họ nào. Chạy `npm run seed` trước đã.");
    process.exit(1);
  }

  let target = clans[0];
  let best = -1;
  for (const c of clans) {
    if (wantName && !c.name.toLowerCase().includes(wantName.toLowerCase())) {
      continue;
    }
    const { count } = await admin
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", c.id);
    if ((count ?? 0) > best) {
      best = count ?? 0;
      target = c;
    }
  }
  const clanId = target.id;
  console.log(`→ Dòng họ mục tiêu: "${target.name}" (${best} người) — ${clanId}`);

  // 2. Người ghi sổ (created_by) = platform admin (đăng nhập xem được mọi họ).
  const { data: padmin } = await admin
    .from("profiles")
    .select("id")
    .eq("is_platform_admin", true)
    .limit(1)
    .maybeSingle();
  const createdBy = padmin?.id ?? null;

  // 3. Vài người trong họ để gắn honoree (mở được trang cá nhân).
  const { data: persons } = await admin
    .from("persons")
    .select("id, full_name")
    .eq("clan_id", clanId)
    .limit(20);
  const pool = persons ?? [];
  const pick = (i: number) => pool[i % Math.max(pool.length, 1)];

  // 4. Dọn dữ liệu cũ của dòng họ này (chạy lại cho sạch).
  await admin.from("fund_transactions").delete().eq("clan_id", clanId);
  await admin.from("fund_audit").delete().eq("clan_id", clanId);
  await admin.from("honor_entries").delete().eq("clan_id", clanId);

  // 5. BẢNG VÀNG CÔNG ĐỨC — trộn 4 nhóm: tiền công đức, công sức, học tập, khác.
  const honor = [
    {
      category: "donation_money",
      honoree: pick(0)?.full_name ?? "Ông Nguyễn Văn Đức",
      person: pick(0)?.id,
      amount: 50_000_000,
      note: "Công đức xây dựng, tu bổ nhà thờ họ",
      occurred_on: daysAgo(40),
      sort: 100,
    },
    {
      category: "donation_money",
      honoree: pick(3)?.full_name ?? "Bà Trần Thị Hương",
      person: pick(3)?.id,
      amount: 20_000_000,
      note: "Ủng hộ quỹ khuyến học dòng họ năm 2026",
      occurred_on: daysAgo(65),
      sort: 90,
    },
    {
      category: "donation_money",
      honoree: pick(6)?.full_name ?? "Ông Lê Hữu Phúc",
      person: pick(6)?.id,
      amount: 15_000_000,
      note: "Đóng góp trùng tu, ốp đá phần mộ Tổ",
      occurred_on: daysAgo(120),
      sort: 80,
    },
    {
      category: "donation_labor",
      honoree: pick(9)?.full_name ?? "Ông Phạm Quốc Hùng",
      person: pick(9)?.id,
      amount: null,
      note: "Góp hơn 30 ngày công trùng tu từ đường",
      occurred_on: daysAgo(95),
      sort: 70,
    },
    {
      category: "donation_labor",
      honoree: pick(12)?.full_name ?? "Ông Hoàng Văn Minh",
      person: pick(12)?.id,
      amount: null,
      note: "Đứng ra vận động, tổ chức lễ giỗ Tổ chu đáo",
      occurred_on: daysAgo(30),
      sort: 60,
    },
    {
      category: "academic",
      honoree: pick(15)?.full_name ?? "Cháu Nguyễn Minh Anh",
      person: pick(15)?.id,
      amount: null,
      note: "Đỗ thủ khoa Trường ĐH Bách Khoa năm 2026",
      occurred_on: daysAgo(20),
      sort: 55,
    },
    {
      category: "academic",
      honoree: pick(17)?.full_name ?? "Cháu Trần Ngọc Lan",
      person: pick(17)?.id,
      amount: null,
      note: "Bảo vệ thành công luận án Tiến sĩ tại ĐH Quốc gia",
      occurred_on: daysAgo(75),
      sort: 50,
    },
    {
      category: "other",
      honoree: pick(19)?.full_name ?? "Cô Lê Thị Mai",
      person: pick(19)?.id,
      amount: null,
      note: "Tấm gương hiếu thảo, tận tình chăm sóc ông bà",
      occurred_on: daysAgo(50),
      sort: 40,
    },
  ];

  const { error: hErr } = await admin.from("honor_entries").insert(
    honor.map((h) => ({
      clan_id: clanId,
      person_id: h.person ?? null,
      honoree_name: h.honoree,
      category: h.category,
      amount: h.amount,
      note: h.note,
      occurred_on: h.occurred_on,
      sort: h.sort,
      created_by: createdBy,
    })),
  );
  if (hErr) throw new Error(`honor_entries: ${hErr.message}`);

  // 6. QUỸ HỌ — thu/chi trải trên ~1 năm, 3 quỹ để có nhiều số dư.
  const tx: {
    direction: "in" | "out";
    amount: number;
    fund: string;
    category: string;
    note: string;
    occurred_on: string;
  }[] = [
    { direction: "in", amount: 50_000_000, fund: "Xây từ đường", category: "Công đức", note: "Đại gia đình ông Đức ủng hộ xây nhà thờ họ", occurred_on: daysAgo(300) },
    { direction: "in", amount: 8_000_000, fund: "Quỹ chung", category: "Quỹ đinh", note: "Thu quỹ đinh năm 2026 (40 suất)", occurred_on: daysAgo(210) },
    { direction: "in", amount: 20_000_000, fund: "Khuyến học", category: "Đóng góp", note: "Bà Hương ủng hộ quỹ khuyến học", occurred_on: daysAgo(180) },
    { direction: "in", amount: 15_000_000, fund: "Quỹ chung", category: "Công đức giỗ Tổ", note: "Con cháu công đức dịp giỗ Tổ", occurred_on: daysAgo(120) },
    { direction: "in", amount: 6_500_000, fund: "Quỹ chung", category: "Đóng góp", note: "Các chi ủng hộ họp họ đầu năm", occurred_on: daysAgo(60) },
    { direction: "in", amount: 12_000_000, fund: "Xây từ đường", category: "Công đức", note: "Chi họ nhánh 2 góp tu bổ từ đường", occurred_on: daysAgo(45) },
    { direction: "out", amount: 30_000_000, fund: "Xây từ đường", category: "Xây dựng", note: "Mua vật liệu, thuê thợ ốp đá từ đường", occurred_on: daysAgo(150) },
    { direction: "out", amount: 2_500_000, fund: "Quỹ chung", category: "Lễ giỗ", note: "Hoa quả, nhang đèn, lễ vật giỗ Tổ", occurred_on: daysAgo(118) },
    { direction: "out", amount: 6_000_000, fund: "Khuyến học", category: "Khen thưởng", note: "Trao thưởng khuyến học 12 cháu học giỏi", occurred_on: daysAgo(40) },
    { direction: "out", amount: 3_000_000, fund: "Quỹ chung", category: "Hội họp", note: "Chi phí nước uống, in ấn buổi họp họ", occurred_on: daysAgo(58) },
    { direction: "out", amount: 1_800_000, fund: "Quỹ chung", category: "Mộ phần", note: "Thuê dọn cỏ, quét vôi khu mộ Tổ", occurred_on: daysAgo(25) },
  ];

  const { error: fErr } = await admin.from("fund_transactions").insert(
    tx.map((t) => ({
      clan_id: clanId,
      direction: t.direction,
      amount: t.amount,
      fund: t.fund,
      category: t.category,
      note: t.note,
      occurred_on: t.occurred_on,
      created_by: createdBy,
    })),
  );
  if (fErr) throw new Error(`fund_transactions: ${fErr.message}`);

  const totalIn = tx.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = tx.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);

  console.log(`\n✓ Đã seed vào "${target.name}":`);
  console.log(`  • Bảng vàng công đức: ${honor.length} mục`);
  console.log(`  • Quỹ họ: ${tx.length} giao dịch (thu ${totalIn.toLocaleString("vi-VN")}đ, chi ${totalOut.toLocaleString("vi-VN")}đ, dư ${(totalIn - totalOut).toLocaleString("vi-VN")}đ)`);
  console.log(`\nĐăng nhập để xem: mở app (npm run dev) → login rồi vào dòng họ "${target.name}"`);
  console.log(`  → Trang "Bảng vàng công đức" và "Quỹ họ".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
