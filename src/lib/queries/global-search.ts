import { supabase } from "@/lib/supabase";
import { listCustomEntries } from "@/lib/queries/customs";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";

type Client = typeof supabase;

/** Loại kết quả do RPC global_search trả về. */
export type SearchKind =
  | "person"
  | "clan"
  | "grave"
  | "heritage"
  | "event"
  | "post"
  | "contribution"
  | "inlaw"
  | "branch"
  | "custom";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  clanId: string | null;
  clanName: string | null;
  title: string;
  subtitle: string | null;
}

/** Nhãn nhóm hiển thị trong hộp tìm kiếm, theo thứ tự ưu tiên. */
export const SEARCH_KIND_ORDER: { kind: SearchKind; label: string }[] = lazyMessages([
  { kind: "person", label: msg`Người` },
  { kind: "clan", label: msg`Dòng họ` },
  { kind: "grave", label: msg`Mộ phần` },
  { kind: "heritage", label: msg`Di sản` },
  { kind: "event", label: msg`Sự kiện` },
  { kind: "post", label: msg`Bảng tin` },
  { kind: "contribution", label: msg`Đóng góp` },
  { kind: "inlaw", label: msg`Thông gia` },
  { kind: "branch", label: msg`Chi (nhánh)` },
  { kind: "custom", label: msg`Sổ tay văn hoá` },
]) as unknown as { kind: SearchKind; label: string }[];

/** Đường dẫn trong app tới một kết quả. */
export function hitPath(h: SearchHit): string {
  const c = h.clanId ? `/clans/${h.clanId}` : "";
  switch (h.kind) {
    case "person":
      return `${c}/people/${h.id}`;
    case "clan":
      return `/clans/${h.id}`;
    case "grave":
      return `${c}/graves/${h.id}`;
    case "heritage":
      return `${c}/heritage/${h.id}`;
    case "event":
      return `${c}/events`;
    case "post":
      return `${c}/board/${h.id}`;
    case "contribution":
      return `${c}/contributions/${h.id}`;
    case "inlaw":
      return `${c}/inlaws`;
    case "branch":
      return `${c}/branches?chi=${h.id}`;
    case "custom":
      return `/so-tay/${h.id}`;
  }
}

/** Tìm xuyên các dòng họ người dùng được phép xem (RLS quyết định, hàm chạy quyền người gọi). */
export async function globalSearch(
  q: string,
  perType = 5,
  client: Client = supabase,
): Promise<SearchHit[]> {
  const text = q.trim();
  if (text.length < 2) return [];
  // Sổ tay văn hoá là tệp tĩnh (không còn trong DB): tìm ở client, gộp vào kết quả của RPC.
  const [rpc, customs] = await Promise.all([
    client.rpc("global_search", { q: text, per_type: perType }),
    listCustomEntries({ search: text }).catch(() => []),
  ]);
  if (rpc.error) throw new Error(rpc.error.message);
  const fromDb: SearchHit[] = (rpc.data ?? [])
    // Nhánh 'custom' của RPC cũ (đọc bảng custom_entries) bỏ đi; nguồn duy nhất là tệp tĩnh.
    .filter((r) => r.kind !== "custom")
    .map((r) => ({
      kind: r.kind as SearchKind,
      id: r.id,
      clanId: r.clan_id,
      clanName: r.clan_name,
      title: r.title,
      subtitle: r.subtitle,
    }));
  const fromFiles: SearchHit[] = customs.slice(0, perType).map((e) => ({
    kind: "custom",
    id: e.id,
    clanId: null,
    clanName: null,
    title: e.title,
    subtitle: e.short_description,
  }));
  return [...fromDb, ...fromFiles];
}
