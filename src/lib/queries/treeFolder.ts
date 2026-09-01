import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import {
  buildFolderNode,
  toFolderChild,
  type FolderChild,
  type FolderNodeContent,
} from "@/lib/tree/folderModel";
import type {
  FamilyForTree,
  PersonForTree,
  TreeSource,
} from "@/lib/queries/tree";

type Client = SupabaseClient<Database>;

/**
 * Dữ liệu cho kiểu xem "cây thư mục" — TẢI THEO YÊU CẦU.
 *
 * Khác hẳn `getTreeData`: hàm đó kéo cả dòng họ về một lần (9.000 người
 * là chuyện thường ở đây) rồi mới cắt. Cây thư mục thì chỉ tải đúng
 * những người đang mở, nên mở được họ lớn trên điện thoại yếu — đó là
 * lý do tồn tại của kiểu xem này.
 *
 * Giữ nguyên luật che thông tin: người ngoài xem dòng họ công khai đọc
 * qua `persons_public_safe` / `families_public_safe` y như các màn khác.
 */

const PERSON_COLS =
  "id, full_name, gender, is_living, is_root, birth_date, birth_date_precision, death_date, generation, birth_family_id, branch_id, photo_path, birth_order";

/**
 * Chọn bảng theo nguồn.
 *
 * Phải viết thành hai nhánh rõ ràng chứ không ghép tên bảng bằng biến:
 * kiểu của supabase-js suy theo TÊN BẢNG, nên một biến `string` là mất
 * sạch kiểu trả về — và mất luôn cái lưới an toàn khi ai đó đổi cột.
 *
 * View "…_public_safe" đã tự lọc bản ghi đã xoá; bảng gốc thì chưa.
 */
function personsFrom(client: Client, source: TreeSource, clanId: string) {
  return source === "persons_public_safe"
    ? client.from("persons_public_safe").select(PERSON_COLS).eq("clan_id", clanId)
    : client
        .from("persons")
        .select(PERSON_COLS)
        .eq("clan_id", clanId)
        .is("deleted_at", null);
}

function familiesFrom(client: Client, source: TreeSource, clanId: string) {
  return source === "persons_public_safe"
    ? client
        .from("families_public_safe")
        .select("id, husband_id, wife_id, spouse_order, created_at")
        .eq("clan_id", clanId)
    : client
        .from("families")
        .select("id, husband_id, wife_id, spouse_order, created_at")
        .eq("clan_id", clanId)
        .is("deleted_at", null);
}

/** Ai trong số này có con — để biết dòng nào cần mũi tên bung. */
async function withChildrenSet(
  clanId: string,
  personIds: string[],
  source: TreeSource,
  client: Client,
): Promise<Set<string>> {
  if (personIds.length === 0) return new Set();

  const { data: fams, error } = await familiesFrom(client, source, clanId).or(
    `husband_id.in.(${personIds.join(",")}),wife_id.in.(${personIds.join(",")})`,
  );
  if (error) throw new Error(error.message);
  const rows = (fams ?? []) as FamilyForTree[];
  if (rows.length === 0) return new Set();

  const famIds = rows.map((f) => f.id);
  const { data: kids, error: kErr } = await personsFrom(
    client,
    source,
    clanId,
  ).in("birth_family_id", famIds);
  if (kErr) throw new Error(kErr.message);

  const famsWithKids = new Set(
    (kids ?? []).map((k) => (k as { birth_family_id: string }).birth_family_id),
  );
  const out = new Set<string>();
  for (const f of rows) {
    if (!famsWithKids.has(f.id)) continue;
    if (f.husband_id) out.add(f.husband_id);
    if (f.wife_id) out.add(f.wife_id);
  }
  return out;
}

/** Nội dung dưới MỘT người: các cuộc hôn nhân + con của từng cuộc. */
export async function loadFolderNode(
  clanId: string,
  personId: string,
  source: TreeSource = "persons",
  client: Client = defaultClient,
): Promise<FolderNodeContent> {
  const { data: famRows, error: fErr } = await familiesFrom(
    client,
    source,
    clanId,
  )
    .or(`husband_id.eq.${personId},wife_id.eq.${personId}`)
    .order("created_at", { ascending: true });
  if (fErr) throw new Error(fErr.message);
  const families = (famRows ?? []) as FamilyForTree[];
  if (families.length === 0) {
    return {
      directChildren: [],
      inlineSpouse: null,
      inlineSpouseName: null,
      groups: [],
    };
  }

  const famIds = families.map((f) => f.id);
  const spouseIds = families
    .map((f) => (f.husband_id === personId ? f.wife_id : f.husband_id))
    .filter((id): id is string => !!id);

  const [{ data: kidRows, error: kErr }, { data: spouseRows, error: sErr }] =
    await Promise.all([
      personsFrom(client, source, clanId)
        .in("birth_family_id", famIds)
        // Thứ tự anh chị em: theo "con thứ mấy" nếu có, rồi tới năm sinh.
        .order("birth_order", { ascending: true, nullsFirst: false })
        .order("birth_date", { ascending: true, nullsFirst: false }),
      spouseIds.length
        ? personsFrom(client, source, clanId).in("id", spouseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (kErr) throw new Error(kErr.message);
  if (sErr) throw new Error(sErr.message);

  const kids = (kidRows ?? []) as PersonForTree[];
  const hasKids = await withChildrenSet(
    clanId,
    kids.map((k) => k.id),
    source,
    client,
  );

  const childrenOf = new Map<string, FolderChild[]>();
  for (const k of kids) {
    if (!k.birth_family_id) continue;
    const arr = childrenOf.get(k.birth_family_id) ?? [];
    arr.push(toFolderChild(k, hasKids.has(k.id)));
    childrenOf.set(k.birth_family_id, arr);
  }

  const personById = new Map(
    ((spouseRows ?? []) as PersonForTree[]).map((p) => [p.id, p]),
  );
  return buildFolderNode(personId, families, childrenOf, personById);
}

export interface FolderRoots {
  roots: FolderChild[];
  /**
   * Người thật sự chưa gắn vào cây: không có cha mẹ, không phải thuỷ tổ,
   * VÀ không phải vợ/chồng của ai.
   *
   * Điều kiện cuối cùng quan trọng hơn nó trông: dâu/rể hầu như không có
   * cha mẹ trong gia phả, nhưng họ CÓ trong cây — đứng cạnh vợ/chồng
   * mình. Đo trên production: 2.329 người không cha mẹ thì 2.221 là
   * vợ/chồng, tức 95% danh sách cũ là báo động giả.
   */
  orphanCount: number;
}

/**
 * Gốc của cây: thuỷ tổ + đếm số người chưa gắn vào cây.
 *
 * Con số "chưa gắn" phải hiện ra: trên production có 2.358/9.309 người
 * không có cha mẹ. Nếu chỉ vẽ nhánh từ thuỷ tổ thì một phần tư dòng họ
 * biến mất khỏi màn hình và người dùng tưởng mất dữ liệu.
 */
export async function loadFolderRoots(
  clanId: string,
  source: TreeSource = "persons",
  client: Client = defaultClient,
): Promise<FolderRoots> {
  const { data: rootRows, error } = await personsFrom(client, source, clanId)
    .eq("is_root", true)
    .order("birth_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const roots = (rootRows ?? []) as PersonForTree[];

  const hasKids = await withChildrenSet(
    clanId,
    roots.map((r) => r.id),
    source,
    client,
  );

  // Đếm bằng RPC: điều kiện "không phải vợ/chồng của ai" không viết được
  // bằng PostgREST. Hàm SQL đọc qua view public_safe nên đúng cho cả
  // khách xem dòng họ công khai lẫn thành viên.
  const { data: count, error: cErr } = await client.rpc("clan_unlinked_count", {
    p_clan: clanId,
  });
  if (cErr) throw new Error(cErr.message);

  return {
    roots: roots.map((r) => toFolderChild(r, hasKids.has(r.id))),
    orphanCount: (count as number) ?? 0,
  };
}

/** Danh sách người chưa gắn vào cây, phân trang. */
export async function loadUnlinked(
  clanId: string,
  opts: { limit?: number; offset?: number; search?: string } = {},
  source: TreeSource = "persons",
  client: Client = defaultClient,
): Promise<FolderChild[]> {
  void source; // RPC tự chọn nguồn qua view public_safe
  const limit = opts.limit ?? 50;
  // Cùng RPC với phần đếm, nên danh sách và con số không bao giờ lệch
  // nhau — hai câu truy vấn viết riêng là kiểu sớm muộn cũng lệch.
  const { data, error } = await client.rpc("clan_unlinked_persons", {
    p_clan: clanId,
    p_search: opts.search?.trim() || undefined,
    p_limit: limit,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PersonForTree[];
  const hasKids = await withChildrenSet(
    clanId,
    rows.map((r) => r.id),
    source,
    client,
  );
  return rows.map((r) => toFolderChild(r, hasKids.has(r.id)));
}
