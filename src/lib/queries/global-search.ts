import { supabase } from "@/lib/supabase";
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
  const { data, error } = await client.rpc("global_search", { q: text, per_type: perType });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    kind: r.kind as SearchKind,
    id: r.id,
    clanId: r.clan_id,
    clanName: r.clan_name,
    title: r.title,
    subtitle: r.subtitle,
  }));
}
