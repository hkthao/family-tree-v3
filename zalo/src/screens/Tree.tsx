import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import {
  IconChevronDown,
  IconSearch,
} from "@/components/icons";
import { displayGen } from "@/lib/displayGeneration";
import {
  loadFolderNode,
  loadFolderRoots,
  loadFolderSearch,
  loadUnlinked,
} from "@/lib/queries/treeFolder";
import type { TreeSource } from "@/lib/queries/tree";
import {
  generationColor,
  groupLabel,
  type FolderChild,
  type FolderGroup,
  type FolderSpouse,
} from "@/lib/tree/folderModel";

import { usePhotoUrls } from "../photos";
import { useAsync } from "../useAsync";

/**
 * Cây gia phả kiểu thư mục — bản Mini App.
 *
 * Dữ liệu và luật gom vợ/con lấy NGUYÊN từ web (`treeFolder`,
 * `folderModel`): bung tới đâu tải tới đó, một vợ thì ghi chung dòng,
 * nhiều vợ thì mỗi bà một nhóm. Chỉ phần vẽ là viết riêng cho màn hình
 * điện thoại: vợ chồng luôn xếp dọc, không có chế độ đứng cạnh nhau.
 */

const Ctx = createContext<{
  clanId: string;
  /** Thành viên đọc bảng gốc; khách xem họ công khai đọc bản đã che. */
  source: TreeSource;
  genOffset: number;
  openPerson: (id: string) => void;
}>({ clanId: "", source: "persons", genOffset: 0, openPerson: () => {} });

/** Màu đời đưa xuống CSS qua biến `--gen` (viền ảnh, huy hiệu, vạch trái). */
const genVar = (generation: number | null) =>
  ({ "--gen": generationColor(generation) ?? undefined }) as CSSProperties;

const Chevron = () => <IconChevronDown />;

/** Ba dòng giả trong lúc chờ tải, cùng hình dạng với dòng thật. */
const Skeleton = ({ rows = 3 }: { rows?: number }) => (
  <>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="sk" style={{ height: 58, marginTop: 6 }} />
    ))}
  </>
);

const years = (p: {
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
}) =>
  p.birthYear || p.deathYear
    ? `${p.birthYear ?? "?"}–${p.deathYear ?? (p.isLiving ? "nay" : "?")}`
    : "";

function Who({
  p,
  generation,
  badge,
  spouse = false,
  size = 40,
  note,
  src,
}: {
  p: FolderChild | FolderSpouse;
  /** Đời (thật) dùng để tô màu — vợ chồng chung màu với người trong họ. */
  generation: number | null;
  badge?: boolean;
  spouse?: boolean;
  size?: number;
  note?: string;
  src: string;
}) {
  const { genOffset, openPerson } = useContext(Ctx);
  const hasGen = generationColor(generation) !== null;
  const meta = [years(p), note].filter(Boolean).join(" · ");
  return (
    <button type="button" className="who" onClick={() => openPerson(p.id)}>
      {spouse && <span className="rings">⚭</span>}
      <span className="ring">
        <img src={src} width={size} height={size} alt="" loading="lazy" />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className={`name${spouse ? " spouse" : ""}`}>
          {p.name}{" "}
          <span className={p.gender === "M" ? "m" : "f"}>
            {p.gender === "M" ? "♂" : "♀"}
          </span>
        </span>
        <span className="meta">
          {badge && hasGen && (
            <span className="badge">Đời {displayGen(generation, genOffset)}</span>
          )}
          {meta}
        </span>
      </span>
    </button>
  );
}

function PersonNode({
  person,
  branch = false,
  reserveArrow = true,
  defaultOpen = false,
  note,
}: {
  person: FolderChild;
  branch?: boolean;
  reserveArrow?: boolean;
  defaultOpen?: boolean;
  note?: string;
}) {
  const { clanId, source } = useContext(Ctx);
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  // Chỉ tải khi đã mở lần đầu — đó là lý do có kiểu xem này.
  const node = useAsync(
    () =>
      everOpened ? loadFolderNode(clanId, person.id, source) : Promise.resolve(null),
    [clanId, person.id, everOpened, source],
  );

  const allSpouses = person.spouses ?? [];
  const groups = open ? (node.data?.groups ?? []) : [];
  // Nhiều cuộc hôn nhân và đang mở: các nhóm bên dưới đã nêu từng người.
  const spouses = groups.length > 0 ? [] : allSpouses;
  const photo = usePhotoUrls([
    person.photoPath,
    ...spouses.map((s) => s.photoPath),
  ]);
  const leaf = !person.hasChildren;

  return (
    <li className={branch ? `branch${leaf ? " leaf" : ""}` : undefined}>
      <div
        className={`row${leaf && (branch || !reserveArrow) ? " pad" : ""}`}
        style={genVar(person.generation)}
      >
        {!leaf ? (
          <button
            type="button"
            className={`chev${open ? "" : " closed"}`}
            aria-expanded={open}
            aria-label={open ? `Thu gọn ${person.name}` : `Mở ${person.name}`}
            onClick={() => setOpen((v) => !v)}
          >
            <Chevron />
          </button>
        ) : (
          !branch && reserveArrow && <span className="slot" />
        )}
        <div className="people">
          <Who
            p={person}
            generation={person.generation}
            badge
            note={note}
            src={photo(person.photoPath, person.gender)}
          />
          {spouses.map((s) => (
            <Who
              key={s.id}
              p={s}
              generation={person.generation}
              spouse
              size={32}
              src={photo(s.photoPath, s.gender)}
            />
          ))}
        </div>
      </div>

      {open && (
        <div className="rail">
          {node.loading && <div style={{ paddingLeft: 6 }}><Skeleton rows={2} /></div>}
          {node.error && <p className="error" style={{ margin: "6px 0 0 40px" }}>{node.error}</p>}
          {node.data && (
            <ul>
              {node.data.directChildren.map((c) => (
                <PersonNode key={c.id} person={c} branch />
              ))}
              {node.data.groups.map((g) => (
                <Group key={g.familyId} group={g} parent={person} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Một cuộc hôn nhân (chỉ khi có 2+ vợ/chồng): con treo dưới đúng mẹ/cha. */
function Group({ group, parent }: { group: FolderGroup; parent: FolderChild }) {
  const photo = usePhotoUrls([group.spouse?.photoPath]);
  const count = group.children.length ? `${group.children.length} con` : "chưa có con";
  return (
    <li className="branch group">
      <div className="grouphead" style={genVar(parent.generation)}>
        <span className="slot">⚭</span>
        {group.spouse ? (
          <Who
            p={{ ...group.spouse, name: groupLabel(group, parent.gender) }}
            generation={parent.generation}
            size={32}
            note={count}
            src={photo(group.spouse.photoPath, group.spouse.gender)}
          />
        ) : (
          <span className="muted">
            <i>{groupLabel(group, parent.gender)}</i> · {count}
          </span>
        )}
      </div>
      {group.children.length > 0 && (
        <ul className="rail">
          {group.children.map((c) => (
            <PersonNode key={c.id} person={c} branch />
          ))}
        </ul>
      )}
    </li>
  );
}

function Unlinked({ count }: { count: number }) {
  const { clanId, source } = useContext(Ctx);
  const [open, setOpen] = useState(false);
  const list = useAsync(
    () => (open ? loadUnlinked(clanId, { limit: 50 }, source) : Promise.resolve([])),
    [clanId, open, source],
  );
  const rows = list.data ?? [];
  return (
    <div>
      <button type="button" className="fold card" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={`chev${open ? "" : " closed"}`} style={{ margin: 0 }}><Chevron /></span>
        <span>Chưa gắn vào cây</span>
        <span className="chip" style={{ marginLeft: "auto" }}>{count}</span>
      </button>
      {open && (
        <>
          {list.loading && <Skeleton />}
          <ul className="tree" style={{ marginTop: 8 }}>
            {rows.map((p) => (
              <PersonNode key={p.id} person={p} reserveArrow={rows.some((x) => x.hasChildren)} />
            ))}
          </ul>
          {rows.length >= 50 && <p className="muted">Chỉ hiện 50 người đầu.</p>}
        </>
      )}
    </div>
  );
}

function SearchResults({ q }: { q: string }) {
  const { clanId, source } = useContext(Ctx);
  const hits = useAsync(() => loadFolderSearch(clanId, q, source), [clanId, q, source]);
  if (hits.loading) return <Skeleton />;
  if (hits.error) return <p className="error">{hits.error}</p>;
  const rows = hits.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="empty">
        <div className="icon"><IconSearch /></div>
        <p className="muted">Không tìm thấy ai tên “{q}”.</p>
      </div>
    );
  }
  return (
    <>
      <ul className="tree">
        {rows.map((h) => (
          <PersonNode
            key={h.person.id}
            person={h.person}
            reserveArrow={rows.some((x) => x.person.hasChildren)}
            note={h.parentNames.length ? `con của ${h.parentNames.join(" & ")}` : undefined}
          />
        ))}
      </ul>
      {rows.length >= 30 && <p className="muted">Chỉ hiện 30 người đầu — gõ thêm chữ để thu hẹp.</p>}
    </>
  );
}

export function TreeScreen({
  clanId,
  source,
  genOffset,
  openPerson,
}: {
  clanId: string;
  source: TreeSource;
  genOffset: number;
  openPerson: (id: string) => void;
}) {
  const roots = useAsync(() => loadFolderRoots(clanId, source), [clanId, source]);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  return (
    <Ctx.Provider value={{ clanId, source, genOffset, openPerson }}>
      <div className="page">
        <div className="searchbar">
          <input
            className="field"
            type="search"
            placeholder="Tìm người theo tên…"
            aria-label="Tìm người trong cây"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {q && <SearchResults q={q} />}

        {/* Đang tìm thì GIẤU cây chứ không gỡ: gỡ là mất các nhánh đã bung. */}
        <div style={{ display: q ? "none" : undefined }}>
          {roots.loading && <Skeleton rows={4} />}
          {roots.error && (
            <p className="error">
              {roots.error}{" "}
              <button type="button" className="btn ghost" onClick={roots.reload}>Thử lại</button>
            </p>
          )}
          {roots.data && (
            <>
              {roots.data.roots.length === 0 && roots.data.orphanCount === 0 && (
                <p className="muted">Dòng họ chưa có ai.</p>
              )}
              <ul className="tree">
                {roots.data.roots.map((r) => (
                  <PersonNode
                    key={r.id}
                    person={r}
                    defaultOpen
                    reserveArrow={roots.data!.roots.some((x) => x.hasChildren)}
                  />
                ))}
              </ul>
              {roots.data.orphanCount > 0 && <Unlinked count={roots.data.orphanCount} />}
            </>
          )}
        </div>
      </div>
    </Ctx.Provider>
  );
}
