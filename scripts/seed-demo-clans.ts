/**
 * Tạo 3 DÒNG HỌ DEMO công khai, đầy đủ mọi tính năng, để người dùng tham khảo:
 * cây gia phả 4 đời, sự kiện/giỗ, mộ phần, di sản văn hoá, sổ vàng công đức,
 * quỹ họ, bảng tin. Chạy được lại (xoá dòng họ demo cũ theo tên rồi tạo mới).
 *
 *   LOCAL:  npx tsx scripts/seed-demo-clans.ts
 *   PROD:   SUPABASE_SERVICE_ROLE_KEY=<self-host key> \
 *           VITE_SUPABASE_URL=<supabase-url> \
 *           npx tsx scripts/seed-demo-clans.ts
 *
 * Cần SUPABASE_SERVICE_ROLE_KEY (bypass RLS). Chủ sở hữu = platform admin.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const URL = process.env.VITE_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) {
  console.error("Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const admin = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MID_M = ["Văn", "Hữu", "Đức", "Quốc", "Công", "Đình", "Xuân"];
const MID_F = ["Thị", "Ngọc", "Thanh", "Thu", "Kim", "Hồng"];
const GIV_M = ["An", "Bình", "Cường", "Dũng", "Hải", "Hùng", "Khang", "Long", "Minh", "Nam", "Phúc", "Quang", "Sơn", "Tài", "Trung", "Việt"];
const GIV_F = ["Anh", "Chi", "Dung", "Hà", "Hằng", "Hoa", "Lan", "Linh", "Mai", "Nga", "Ngân", "Phương", "Thảo", "Trang", "Yến"];

/** Ngày yyyy-mm-dd. */
function d(y: number, m: number, day: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface PersonInput {
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root?: boolean;
  birth_date?: string | null;
  death_date?: string | null;
  birth_family_id?: string | null;
  bio?: string | null;
  birth_place?: string | null;
  // giỗ âm lịch (cho người đã mất) → app tự sinh sự kiện giỗ hằng năm
  anniv_m?: number | null;
  anniv_d?: number | null;
}

async function addPerson(clanId: string, p: PersonInput): Promise<string> {
  const { data, error } = await admin
    .from("persons")
    .insert({
      clan_id: clanId,
      full_name: p.full_name,
      gender: p.gender,
      is_living: p.is_living,
      is_root: p.is_root ?? false,
      birth_date: p.birth_date ?? null,
      birth_date_precision: p.birth_date ? "day" : null,
      death_date: p.death_date ?? null,
      death_date_precision: p.death_date ? "day" : null,
      death_anniv_lunar_month: p.anniv_m ?? null,
      death_anniv_lunar_day: p.anniv_d ?? null,
      birth_family_id: p.birth_family_id ?? null,
      bio: p.bio ?? null,
      birth_place: p.birth_place ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`person ${p.full_name}: ${error.message}`);
  return data.id as string;
}

async function addFamily(
  clanId: string,
  husbandId: string | null,
  wifeId: string | null,
): Promise<string> {
  const { data, error } = await admin
    .from("families")
    .insert({
      clan_id: clanId,
      husband_id: husbandId,
      wife_id: wifeId,
      union_type: "marriage",
    })
    .select("id")
    .single();
  if (error) throw new Error(`family: ${error.message}`);
  return data.id as string;
}

interface ClanCfg {
  surname: string;
  place: string;
  seed: number; // lệch chỉ số tên cho mỗi họ khác nhau
}

async function buildClan(ownerId: string, cfg: ClanCfg) {
  const { surname, place, seed } = cfg;
  const name = `Họ ${surname} (demo)`;

  // Idempotent: bỏ qua nếu đã có (xoá clan bị trigger audit_log chặn, nên
  // KHÔNG xoá ở đây). Muốn seed lại từ đầu: dọn bằng psql tắt trigger:
  //   set session_replication_role=replica; delete from clans where name like 'Họ % (demo)';
  const { data: existing } = await admin
    .from("clans")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) {
    console.log(`  • ${name}: đã tồn tại — bỏ qua.`);
    return existing.id as string;
  }

  const { data: clan, error: cErr } = await admin
    .from("clans")
    .insert({
      name,
      description: `Dòng họ ${surname} ở ${place} — bộ dữ liệu MẪU để tham khảo mọi tính năng (cây gia phả, sự kiện, mộ phần, di sản, sổ vàng, quỹ họ, bảng tin).`,
      visibility: "public",
      owner_id: ownerId,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(`clan ${name}: ${cErr.message}`);
  const clanId = clan.id as string;

  const gm = (i: number) => `${surname} ${MID_M[(i + seed) % MID_M.length]} ${GIV_M[(i + seed) % GIV_M.length]}`;
  const gf = (i: number) => `${surname} ${MID_F[(i + seed) % MID_F.length]} ${GIV_F[(i + seed) % GIV_F.length]}`;
  // Dâu (khác họ) — lấy họ khác cho thực tế.
  const inLawSurnames = ["Trần", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ"];
  const wf = (i: number) => `${inLawSurnames[(i + seed) % inLawSurnames.length]} ${MID_F[(i + 1 + seed) % MID_F.length]} ${GIV_F[(i + 3 + seed) % GIV_F.length]}`;

  // ── Đời 1: Thuỷ tổ ông + bà (đã mất) ────────────────────────────
  const to = await addPerson(clanId, {
    full_name: gm(0),
    gender: "M",
    is_living: false,
    is_root: true,
    birth_date: d(1915, 3, 12),
    death_date: d(1985, 8, 20),
    anniv_m: 7,
    anniv_d: 5,
    birth_place: place,
    bio: `Thuỷ tổ dòng họ ${surname}, khai cơ lập nghiệp tại ${place}. Người đặt nền móng gia phong, khuyến học cho con cháu.`,
  });
  const toWife = await addPerson(clanId, {
    full_name: wf(0),
    gender: "F",
    is_living: false,
    birth_date: d(1918, 6, 2),
    death_date: d(1990, 2, 11),
    anniv_m: 1,
    anniv_d: 15,
    birth_place: place,
  });
  const f1 = await addFamily(clanId, to, toWife);

  // ── Đời 2: 3 người con của thuỷ tổ ──────────────────────────────
  // Con trưởng (đã mất) + vợ; con thứ (còn sống) + vợ; con gái (còn sống) + chồng.
  const son1 = await addPerson(clanId, {
    full_name: gm(1),
    gender: "M",
    is_living: false,
    birth_family_id: f1,
    birth_date: d(1945, 5, 9),
    death_date: d(2015, 11, 3),
    anniv_m: 10,
    anniv_d: 8,
    bio: "Con trưởng, trưởng tộc đời thứ hai, có công tu bổ từ đường.",
  });
  const son1Wife = await addPerson(clanId, {
    full_name: wf(1),
    gender: "F",
    is_living: true,
    birth_date: d(1948, 9, 21),
  });
  const f2 = await addFamily(clanId, son1, son1Wife);

  const son2 = await addPerson(clanId, {
    full_name: gm(2),
    gender: "M",
    is_living: true,
    birth_family_id: f1,
    birth_date: d(1950, 2, 17),
    bio: "Con thứ, hiện là trưởng tộc, đứng ra lo việc họ và quỹ khuyến học.",
  });
  const son2Wife = await addPerson(clanId, {
    full_name: wf(2),
    gender: "F",
    is_living: true,
    birth_date: d(1953, 12, 1),
  });
  const f3 = await addFamily(clanId, son2, son2Wife);

  const dau3 = await addPerson(clanId, {
    full_name: gf(3),
    gender: "F",
    is_living: true,
    birth_family_id: f1,
    birth_date: d(1955, 7, 30),
  });
  const dau3Husband = await addPerson(clanId, {
    full_name: `${inLawSurnames[(seed + 2) % inLawSurnames.length]} ${MID_M[(seed + 2) % MID_M.length]} ${GIV_M[(seed + 5) % GIV_M.length]}`,
    gender: "M",
    is_living: true,
    birth_date: d(1952, 4, 4),
  });
  const f4 = await addFamily(clanId, dau3Husband, dau3);

  // ── Đời 3: cháu ─────────────────────────────────────────────────
  const g3: string[] = [];
  // Con của con trưởng (f2): 3 người
  for (let i = 0; i < 3; i++) {
    const male = i !== 1;
    const id = await addPerson(clanId, {
      full_name: male ? gm(4 + i) : gf(4 + i),
      gender: male ? "M" : "F",
      is_living: true,
      birth_family_id: f2,
      birth_date: d(1972 + i * 2, ((i * 3) % 12) + 1, ((i * 5) % 27) + 1),
    });
    g3.push(id);
  }
  // Con của con thứ (f3): 2 người
  for (let i = 0; i < 2; i++) {
    const male = i === 0;
    const id = await addPerson(clanId, {
      full_name: male ? gm(7 + i) : gf(7 + i),
      gender: male ? "M" : "F",
      is_living: true,
      birth_family_id: f3,
      birth_date: d(1978 + i * 3, ((i * 4) % 12) + 1, ((i * 7) % 27) + 1),
    });
    g3.push(id);
  }
  // Con của con gái (f4): 2 người
  for (let i = 0; i < 2; i++) {
    const id = await addPerson(clanId, {
      full_name: gm(9 + i),
      gender: "M",
      is_living: true,
      birth_family_id: f4,
      birth_date: d(1980 + i * 2, ((i * 6) % 12) + 1, ((i * 9) % 27) + 1),
    });
    g3.push(id);
  }

  // ── Đời 4: chắt (dưới cháu trưởng g3[0]) ────────────────────────
  const g3aWife = await addPerson(clanId, {
    full_name: wf(4),
    gender: "F",
    is_living: true,
    birth_date: d(1976, 8, 8),
  });
  const f5 = await addFamily(clanId, g3[0], g3aWife);
  for (let i = 0; i < 2; i++) {
    await addPerson(clanId, {
      full_name: i === 0 ? gm(11) : gf(11),
      gender: i === 0 ? "M" : "F",
      is_living: true,
      birth_family_id: f5,
      birth_date: d(2005 + i * 3, ((i * 5) % 12) + 1, ((i * 6) % 27) + 1),
    });
  }

  // ── Mộ phần & tro cốt ───────────────────────────────────────────
  const { data: tower } = await admin
    .from("resting_places")
    .insert({
      clan_id: clanId,
      kind: "columbarium",
      name: `Tháp mộ họ ${surname}`,
      location_name: `Nghĩa trang ${place}`,
      status: "existing",
      built_year: 1995,
      material: "Đá granite",
      notes: "Nơi quy tập mộ phần các cụ trong dòng họ.",
    })
    .select("id")
    .single();
  const { data: grave } = await admin
    .from("resting_places")
    .insert({
      clan_id: clanId,
      kind: "grave",
      name: `Mộ Thuỷ tổ ${gm(0)}`,
      location_name: `Nghĩa trang ${place}`,
      location_detail: "Khu A, hàng 1",
      status: "existing",
      built_year: 1985,
    })
    .select("id")
    .single();
  const occ = async (rpId: string, personId: string, note?: string) => {
    await admin.from("resting_place_occupants").insert({
      resting_place_id: rpId,
      person_id: personId,
      note: note ?? null,
    });
  };
  if (grave) await occ(grave.id, to, "Thuỷ tổ");
  if (tower) {
    await occ(tower.id, toWife, "Cụ bà thuỷ tổ");
    await occ(tower.id, son1, "Trưởng tộc đời 2");
  }

  // ── Sự kiện dòng họ ─────────────────────────────────────────────
  await admin.from("events").insert([
    { clan_id: clanId, title: "Giỗ Tổ", event_type: "memorial", lunar_month: 7, lunar_day: 5, is_yearly: true, related_person_id: to, notes: "Ngày giỗ Thuỷ tổ — con cháu tề tựu tại từ đường." },
    { clan_id: clanId, title: "Chạp họ", event_type: "tomb_visit", lunar_month: 12, lunar_day: 10, is_yearly: true, resting_place_id: tower?.id ?? null, notes: "Tảo mộ, chạp họ cuối năm." },
    { clan_id: clanId, title: "Họp họ đầu xuân", event_type: "reunion", lunar_month: 1, lunar_day: 4, is_yearly: true, notes: "Gặp mặt đầu năm, mừng thọ các cụ, khen thưởng con cháu học giỏi." },
  ]);

  // ── Di sản & Văn hoá ────────────────────────────────────────────
  const heritage = await admin
    .from("heritage_items")
    .insert([
      { clan_id: clanId, category: "place", title: `Từ đường họ ${surname}`, summary: "Nhà thờ tổ của dòng họ.", body: `Từ đường họ ${surname} được xây dựng năm 1960 tại ${place}, là nơi thờ cúng tổ tiên và hội họp việc họ. Năm 2010 được con cháu chung tay trùng tu khang trang.`, location_name: place, built_year: 1960 },
      { clan_id: clanId, category: "custom", title: "Gia phong – gia huấn", summary: "Nếp nhà, lời răn của tổ tiên.", body: "Con cháu họ lấy chữ HIẾU – HỌC – HOÀ làm gốc: hiếu thảo với ông bà cha mẹ, chăm lo học hành, sống hoà thuận đoàn kết. Hằng năm mừng thọ các cụ và khen thưởng con cháu học giỏi." },
      { clan_id: clanId, category: "story", title: "Công trạng Thuỷ tổ", summary: "Giai thoại khai cơ lập nghiệp.", body: `Tương truyền Thuỷ tổ ${gm(0)} từ nơi khác đến ${place} khai hoang lập ấp, dạy dân trồng lúa, mở lớp học chữ. Người được dân làng kính trọng, con cháu nối đời gìn giữ nếp nhà.` },
      { clan_id: clanId, category: "artifact", title: "Cuốn gia phả cổ", summary: "Tư liệu Hán Nôm truyền đời.", body: "Cuốn gia phả viết bằng chữ Hán Nôm, ghi chép từ đời Thuỷ tổ, hiện được lưu giữ tại từ đường. Đây là căn cứ để con cháu dựng lại cây gia phả ngày nay." },
    ])
    .select("id");
  // Gắn Thuỷ tổ vào mục "Công trạng Thuỷ tổ" (mục thứ 3).
  if (heritage && heritage[2]) {
    await admin.from("heritage_people").insert({ item_id: heritage[2].id, person_id: to, role_note: "Nhân vật chính" });
  }

  // ── Sổ vàng công đức ────────────────────────────────────────────
  await admin.from("honor_entries").insert([
    { clan_id: clanId, honoree_name: gm(2), person_id: son2, category: "donation_money", amount: 50_000_000, note: "Công đức trùng tu từ đường", occurred_on: d(2024, 3, 10), sort: 100 },
    { clan_id: clanId, honoree_name: son1Wife ? wf(1) : gf(1), category: "donation_money", amount: 20_000_000, note: "Ủng hộ quỹ khuyến học", occurred_on: d(2024, 8, 1), sort: 90 },
    { clan_id: clanId, honoree_name: gm(4), person_id: g3[0], category: "donation_labor", note: "Góp công tổ chức giỗ Tổ, chạp họ", occurred_on: d(2024, 12, 12), sort: 80 },
    { clan_id: clanId, honoree_name: gf(5), person_id: g3[1], category: "academic", note: "Đỗ đại học loại giỏi năm 2024", occurred_on: d(2024, 9, 5), sort: 70 },
    { clan_id: clanId, honoree_name: gm(9), person_id: g3[5], category: "academic", note: "Thủ khoa THPT tỉnh", occurred_on: d(2025, 7, 2), sort: 60 },
  ]);

  // ── Quỹ họ ──────────────────────────────────────────────────────
  await admin.from("fund_transactions").insert([
    { clan_id: clanId, direction: "in", amount: 50_000_000, fund: "Xây từ đường", category: "Công đức", note: "Ông " + gm(2) + " công đức trùng tu", occurred_on: d(2024, 3, 10) },
    { clan_id: clanId, direction: "in", amount: 20_000_000, fund: "Khuyến học", category: "Đóng góp", note: "Ủng hộ quỹ khuyến học", occurred_on: d(2024, 8, 1) },
    { clan_id: clanId, direction: "in", amount: 12_000_000, fund: "Quỹ chung", category: "Quỹ đinh", note: "Thu quỹ đinh năm 2025", occurred_on: d(2025, 1, 15) },
    { clan_id: clanId, direction: "in", amount: 8_500_000, fund: "Quỹ chung", category: "Công đức giỗ Tổ", note: "Con cháu công đức dịp giỗ Tổ", occurred_on: d(2024, 8, 18) },
    { clan_id: clanId, direction: "out", amount: 35_000_000, fund: "Xây từ đường", category: "Xây dựng", note: "Mua vật liệu, thuê thợ trùng tu từ đường", occurred_on: d(2024, 5, 20) },
    { clan_id: clanId, direction: "out", amount: 6_000_000, fund: "Khuyến học", category: "Khen thưởng", note: "Trao thưởng con cháu học giỏi", occurred_on: d(2024, 9, 6) },
    { clan_id: clanId, direction: "out", amount: 3_000_000, fund: "Quỹ chung", category: "Lễ giỗ", note: "Hoa quả, lễ vật giỗ Tổ & chạp họ", occurred_on: d(2024, 12, 11) },
  ]);

  // ── Bảng tin ────────────────────────────────────────────────────
  // Lưu ý: batch insert của supabase gộp cột theo HỢP các key → dòng thiếu key
  // bị set NULL (bỏ qua DEFAULT). `pinned` NOT NULL → phải set ở MỌI dòng.
  await admin.from("clan_posts").insert([
    { clan_id: clanId, author_id: ownerId, type: "notice", title: "Thông báo Giỗ Tổ năm nay", body: "Kính mời toàn thể con cháu dòng họ về từ đường dự Giỗ Tổ vào ngày mùng 5 tháng 7 âm lịch. Ban tổ chức chuẩn bị lễ, con cháu về từ sáng sớm để cùng dâng hương.", status: "published", pinned: true },
    { clan_id: clanId, author_id: ownerId, type: "news", title: "Trùng tu từ đường hoàn thành", body: "Sau 3 tháng thi công, từ đường dòng họ đã được trùng tu khang trang nhờ tấm lòng công đức của bà con. Xin trân trọng cảm ơn!", status: "published", pinned: false },
    { clan_id: clanId, author_id: ownerId, type: "notice", title: "Vinh danh con cháu học giỏi", body: "Nhân dịp họp họ đầu xuân, dòng họ khen thưởng các cháu đạt thành tích học tập xuất sắc năm qua. Chúc các cháu tiếp tục cố gắng, làm rạng danh dòng họ.", status: "published", pinned: false },
  ]);

  const { count } = await admin
    .from("persons")
    .select("id", { count: "exact", head: true })
    .eq("clan_id", clanId);
  console.log(`  ✓ ${name}: ${count} người + sự kiện/mộ phần/di sản/sổ vàng/quỹ/bảng tin`);
  return clanId;
}

async function main() {
  const { data: padmin } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("is_platform_admin", true)
    .limit(1)
    .maybeSingle();
  if (!padmin) {
    console.error("Không tìm thấy platform admin để làm chủ dòng họ.");
    process.exit(1);
  }
  console.log(`Chủ sở hữu (platform admin): ${padmin.display_name}`);

  const clans: ClanCfg[] = [
    { surname: "Nguyễn", place: "Bắc Ninh", seed: 0 },
    { surname: "Lê", place: "Thanh Hoá", seed: 2 },
    { surname: "Phan", place: "Nghệ An", seed: 4 },
  ];
  const ids: string[] = [];
  for (const c of clans) ids.push(await buildClan(padmin.id, c));

  console.log("\n✓ Đã tạo 3 dòng họ demo (công khai). Clan IDs:");
  ids.forEach((id, i) => console.log(`  ${clans[i].surname}: ${id}`));
  console.log("\nGợi ý: vào Admin → Cấu hình để chọn 1 trong 3 làm dòng họ demo ở trang Đăng nhập.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
