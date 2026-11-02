import { listPersons, type ListPersonsParams } from "@/lib/queries/persons";

/**
 * Ngữ cảnh duyệt Danh bạ: lưu thứ tự người ở trang Danh bạ (theo đúng bộ lọc +
 * sắp xếp đang xem) để trang chi tiết có nút "Người trước / Người sau" mà không
 * phải quay lại danh sách. Chỉ là tiện ích trong phiên (sessionStorage).
 */
type NavParams = Omit<ListPersonsParams, "page">;

export interface PersonNavCtx {
  clanId: string;
  params: NavParams;
  /** Cửa sổ các id đang biết, liền nhau theo thứ tự danh bạ. */
  ids: string[];
  /** Trang (1-based) đầu / cuối của cửa sổ. */
  pageLo: number;
  pageHi: number;
  total: number;
}

const key = (clanId: string) => `family-tree:person-nav:${clanId}`;

export function savePersonNav(ctx: PersonNavCtx): void {
  try {
    sessionStorage.setItem(key(ctx.clanId), JSON.stringify(ctx));
  } catch {
    /* private mode — ignore */
  }
}

export function loadPersonNav(clanId: string): PersonNavCtx | null {
  try {
    const raw = sessionStorage.getItem(key(clanId));
    return raw ? (JSON.parse(raw) as PersonNavCtx) : null;
  } catch {
    return null;
  }
}

/** Nạp thêm trang kề cửa sổ (dir = -1 trang trước, +1 trang sau). */
export async function extendPersonNav(
  ctx: PersonNavCtx,
  dir: -1 | 1,
): Promise<PersonNavCtx> {
  const page = dir === 1 ? ctx.pageHi + 1 : ctx.pageLo - 1;
  const res = await listPersons(ctx.clanId, { ...ctx.params, page });
  const more = res.rows.map((r) => r.id);
  const next: PersonNavCtx =
    dir === 1
      ? { ...ctx, ids: [...ctx.ids, ...more], pageHi: page, total: res.total }
      : { ...ctx, ids: [...more, ...ctx.ids], pageLo: page, total: res.total };
  savePersonNav(next);
  return next;
}
