import { useEffect, useState } from "react";

import { IconGrid, IconList, IconUsers } from "@/components/icons";
import { displayGen } from "@/lib/displayGeneration";
import { formatDate, formatRelative } from "@/lib/formatDate";
import { listBranches } from "@/lib/queries/branches";
import { getClanStats } from "@/lib/queries/clan-stats";
import type { ClanSummary } from "@/lib/queries/clans";
import { listPersons, type PersonRow } from "@/lib/queries/persons";
import { getRelativesIndex, type RelativesIndex } from "@/lib/queries/relatives-index";
import type { TreeSource } from "@/lib/queries/tree";

import { usePhotoUrls } from "../photos";
import { useAsync } from "../useAsync";

/**
 * Danh bạ — dựng theo trang Danh bạ của bản web: ô tìm, đổi kiểu Danh
 * sách / Thẻ, lọc theo chi và đời, sắp xếp; mỗi người hiện đúng các dòng
 * như web (giới tính · năm sinh–mất · đời, cha mẹ, vợ/chồng, ngày tạo).
 *
 * Lược những phần chỉ dành cho việc SỬA trên web: thêm người, nhập Excel,
 * sinh bằng AI, chọn hàng loạt, sao chép, và chế độ "Xưng hô".
 */
const PAGE = 30;
type Sort = "generation" | "name" | "birth";
type View = "list" | "grid";
type Row = PersonRow & { photo_path?: string | null; created_at?: string | null; updated_at?: string | null };

/** Cùng cách ghi với web: người đã mất ghi khoảng năm, còn sống ghi "sinh …". */
function lifespan(p: PersonRow): string {
  const by = p.birth_date?.slice(0, 4);
  const dy = p.death_date?.slice(0, 4);
  if (!p.is_living) {
    if (by && dy) return `${by}–${dy}`;
    if (dy) return `?–${dy}`;
    if (by) return `${by}–?`;
    return "đã mất";
  }
  return by ? `sinh ${by}` : "";
}

function relativesOf(id: string, index: RelativesIndex | undefined) {
  if (!index) return { father: null, mother: null, spouses: [] as string[] };
  const name = (x: string | undefined) => (x ? (index.byId.get(x)?.full_name ?? null) : null);
  return {
    father: name(index.fatherOf.get(id)),
    mother: name(index.motherOf.get(id)),
    spouses: (index.spousesOf.get(id) ?? []).map((s) => name(s)).filter((n): n is string => !!n),
  };
}

export function PeopleScreen({
  clan,
  source,
  openPerson,
}: {
  clan: ClanSummary;
  source: TreeSource;
  openPerson: (id: string) => void;
}) {
  const genOffset = clan.generation_offset ?? 0;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("list");
  const [branch, setBranch] = useState("");
  const [generation, setGeneration] = useState("");
  const [sort, setSort] = useState<Sort>("generation");
  const [pages, setPages] = useState(1);
  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => setPages(1), [q, branch, generation, sort]);

  const meta = useAsync(async () => {
    const [stats, branches] = await Promise.all([
      getClanStats(clan.id).catch(() => null),
      listBranches(clan.id).catch(() => []),
    ]);
    return { maxGen: stats?.max_generation ?? 0, branches };
  }, [clan.id]);
  // Tên cha mẹ / vợ chồng: chỉ thành viên đọc được; khách thì bỏ qua.
  const relatives = useAsync(
    () => (clan.role ? getRelativesIndex(clan.id).catch(() => undefined) : Promise.resolve(undefined)),
    [clan.id, clan.role],
  );

  const list = useAsync(async () => {
    let rows: Row[] = [];
    let total = 0;
    for (let page = 1; page <= pages; page++) {
      const r = await listPersons(clan.id, {
        page,
        pageSize: PAGE,
        search: q || undefined,
        branchId: branch || undefined,
        generation: generation ? Number(generation) : undefined,
        sort,
        source,
      });
      rows = rows.concat(r.rows as Row[]);
      total = r.total;
    }
    return { rows, total };
  }, [clan.id, q, branch, generation, sort, pages, source]);
  const rows = list.data?.rows ?? [];
  const photo = usePhotoUrls(rows.map((r) => r.photo_path));
  const filtered = !!(q || branch || generation);

  const metaLine = (p: PersonRow) => {
    const bits = [p.gender === "M" ? "♂ Nam" : "♀ Nữ"];
    const life = lifespan(p);
    if (life) bits.push(life);
    const g = displayGen(p.generation, genOffset);
    if (g !== null) bits.push(`Đời ${g}`);
    return bits.join(" · ");
  };
  const dates = (p: Row) => {
    const c = formatDate(p.created_at);
    const u = formatRelative(p.updated_at);
    return [c && `Tạo ${c}`, u && `Cập nhật ${u}`].filter(Boolean).join(" • ");
  };

  return (
    <div className="page">
      <div className="pagehead">
        <IconUsers />
        <div>
          <h2>Danh bạ</h2>
          <p className="muted">Danh sách thành viên với lọc và tìm kiếm.</p>
        </div>
      </div>

      <div className="filters">
        <div className="searchbar" style={{ position: "static", margin: 0, padding: 0, flex: 1 }}>
          <input
            className="field"
            type="search"
            placeholder="Tìm theo tên, biệt danh, nơi sinh, tiểu sử…"
            aria-label="Tìm trong danh bạ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="seg" style={{ margin: 0 }} role="group" aria-label="Kiểu hiển thị">
          <button type="button" aria-pressed={view === "list"} aria-label="Danh sách" onClick={() => setView("list")}><IconList /></button>
          <button type="button" aria-pressed={view === "grid"} aria-label="Thẻ" onClick={() => setView("grid")}><IconGrid /></button>
        </div>
      </div>
      <div className="filters">
        {(meta.data?.branches.length ?? 0) > 0 && (
          <select className="field select" aria-label="Lọc theo chi" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Tất cả chi</option>
            {meta.data!.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className="field select" aria-label="Lọc theo đời" value={generation} disabled={!meta.data?.maxGen} onChange={(e) => setGeneration(e.target.value)}>
          <option value="">Tất cả đời</option>
          {Array.from({ length: meta.data?.maxGen ?? 0 }, (_, i) => i + 1).map((g) => (
            <option key={g} value={g}>Đời {g - genOffset}</option>
          ))}
        </select>
        <select className="field select" aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="generation">Sắp: Đời</option>
          <option value="name">Sắp: Tên</option>
          <option value="birth">Sắp: Năm sinh</option>
        </select>
      </div>

      {list.data && <p className="muted" style={{ margin: "0 2px 8px" }}>{list.data.total} người</p>}
      {list.loading && rows.length === 0 && [0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 76, marginBottom: 6 }} />)}
      {list.error && <p className="error">{list.error}</p>}
      {!list.loading && list.data && rows.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconUsers /></div>
          <p className="muted">{filtered ? "Không tìm thấy ai khớp bộ lọc." : "Chưa có ai trong dòng họ."}</p>
        </div>
      )}

      {rows.length > 0 && view === "list" && (
        <div className="card rels">
          {rows.map((p) => {
            const rel = relativesOf(p.id, relatives.data);
            return (
              <button key={p.id} type="button" className="rel person" onClick={() => openPerson(p.id)}>
                <img src={photo(p.photo_path, p.gender)} width={44} height={44} alt="" style={{ opacity: p.is_living ? 1 : 0.8 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b className="ell">
                    {p.full_name}
                    {p.is_root && <span className="root">Thuỷ tổ</span>}
                  </b>
                  <span className="sub">{metaLine(p)}</span>
                  {(rel.father || rel.mother) && (
                    <span className="tiny ell">
                      {rel.father && <><strong>Cha:</strong> {rel.father}</>}
                      {rel.father && rel.mother && " · "}
                      {rel.mother && <><strong>Mẹ:</strong> {rel.mother}</>}
                    </span>
                  )}
                  {rel.spouses.length > 0 && (
                    <span className="tiny ell"><strong>{p.gender === "M" ? "Vợ" : "Chồng"}:</strong> {rel.spouses.join(", ")}</span>
                  )}
                  {dates(p) && <span className="tiny ell faint">{dates(p)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {rows.length > 0 && view === "grid" && (
        <div className="pgrid">
          {rows.map((p) => {
            const rel = relativesOf(p.id, relatives.data);
            const life = lifespan(p);
            const g = displayGen(p.generation, genOffset);
            return (
              <button key={p.id} type="button" className="card pcard" onClick={() => openPerson(p.id)}>
                <img src={photo(p.photo_path, p.gender)} width={64} height={64} alt="" style={{ opacity: p.is_living ? 1 : 0.8 }} />
                <b className="ell">{p.full_name}</b>
                {p.is_root && <span className="root" style={{ margin: 0 }}>Thuỷ tổ</span>}
                <span className="tiny ell">{p.gender === "M" ? "♂ Nam" : "♀ Nữ"}{life ? ` · ${life}` : ""}</span>
                {g !== null && <span className="tiny ell">Đời {g}</span>}
                {rel.spouses.length > 0 && (
                  <span className="tiny ell">
                    <strong>{p.gender === "M" ? "Vợ" : "Chồng"}:</strong> {rel.spouses[0]}
                    {rel.spouses.length > 1 ? ` +${rel.spouses.length - 1}` : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {list.data && rows.length < list.data.total && (
        <button type="button" className="btn ghost block" style={{ marginTop: 10 }} disabled={list.loading} onClick={() => setPages((n) => n + 1)}>
          {list.loading ? "Đang tải…" : "Xem thêm"}
        </button>
      )}
    </div>
  );
}
