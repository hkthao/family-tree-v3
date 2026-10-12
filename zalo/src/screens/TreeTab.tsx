import { useEffect, useMemo, useState } from "react";

import { IconTree } from "@/components/icons";
import { pickDefaultFocal } from "@/lib/familyChartAdapter";
import { getTreeData, type TreeSource } from "@/lib/queries/tree";
import { idsWithinDepth } from "@/lib/tree/depthFilter";
import { unaccent } from "@/lib/unaccent";

import { useAsync } from "../useAsync";
import { TreeScreen } from "./Tree";
import { Tree2D } from "./Tree2D";
import { Tree3D } from "./Tree3D";

/**
 * Tab "Cây" — đủ ba kiểu xem như bản web: 2D, 3D, Thư mục.
 *
 * Giữ lại từ thanh công cụ của web những gì có nghĩa khi CHỈ XEM trên
 * điện thoại: chọn kiểu, số đời hiển thị, đặt người trung tâm. Lược bỏ:
 * "Tuỳ chọn" hiển thị, chụp ảnh cây, tải sổ PDF, tạo link chia sẻ (tải file
 * và chia sẻ trong Zalo đi đường khác — làm ở bản web), nút làm mới và
 * video hướng dẫn.
 *
 * 2D và 3D phải kéo CẢ dòng họ về (như web); Thư mục thì bung tới đâu tải
 * tới đó. Nên dữ liệu cả cây chỉ tải khi người dùng thật sự chọn 2D/3D.
 */
type Mode = "2d" | "3d" | "folder";
const DEPTHS = [3, 4, 5, 0];

export function TreeTab({
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
  const [mode, setMode] = useState<Mode>("2d");
  const [depth, setDepth] = useState(3);
  const [focal, setFocal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Thư mục dựng một lần rồi giữ (giấu đi) để không mất các nhánh đã bung.
  const [folderSeen, setFolderSeen] = useState(false);
  useEffect(() => {
    if (mode === "folder") setFolderSeen(true);
  }, [mode]);

  const needsAll = mode !== "folder";
  const tree = useAsync(
    () => (needsAll ? getTreeData(clanId, source) : Promise.resolve(null)),
    [clanId, source, needsAll],
  );
  const data = tree.data ?? null;
  const focalId = focal ?? (data ? pickDefaultFocal(data.persons) : null);
  const visible = useMemo(
    () => (data ? idsWithinDepth(data.persons, data.families, focalId, depth) : null),
    [data, focalId, depth],
  );

  const needle = unaccent(search);
  const matches =
    data && needle.length >= 2
      ? data.persons.filter((p) => unaccent(p.full_name).includes(needle)).slice(0, 8)
      : [];
  const focalPerson = data?.persons.find((p) => p.id === focalId);

  return (
    <div className="treetab">
      <div className="toolbar">
        <div className="pagehead" style={{ margin: 0 }}>
          <IconTree />
          <h2>Cây gia phả</h2>
        </div>
        <div className="tools">
          <div className="seg" style={{ margin: 0 }} role="group" aria-label="Kiểu xem">
            {(["2d", "3d", "folder"] as Mode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === "2d" ? "2D" : m === "3d" ? "3D" : "Thư mục"}
              </button>
            ))}
          </div>
          {needsAll && (
            <div className="seg" style={{ margin: 0 }} role="group" aria-label="Số đời hiển thị">
              {DEPTHS.map((d) => (
                <button key={d} type="button" aria-pressed={depth === d} onClick={() => setDepth(d)}>
                  {d === 0 ? "Tất cả" : `${d} đời`}
                </button>
              ))}
            </div>
          )}
        </div>
        {needsAll && (
          <div style={{ position: "relative" }}>
            <div className="searchbar" style={{ position: "static", margin: 0, padding: 0 }}>
              <input
                className="field"
                type="search"
                placeholder="Đặt người trung tâm — gõ tên để tìm"
                aria-label="Đặt người trung tâm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {matches.length > 0 && (
              <div className="card suggest">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="rel"
                    onClick={() => {
                      setFocal(p.id);
                      setSearch("");
                    }}
                  >
                    <span>
                      <b>{p.full_name}</b>
                      <span className="muted">{p.generation != null ? `Đời ${p.generation - genOffset}` : ""}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {needsAll && focalPerson && (
          <p className="muted" style={{ margin: 0 }}>
            Trung tâm: <b style={{ color: "var(--ink)" }}>{focalPerson.full_name}</b>{" "}
            <button type="button" className="btn text" style={{ minHeight: 0, padding: 0 }} onClick={() => openPerson(focalPerson.id)}>
              Xem hồ sơ →
            </button>
          </p>
        )}
      </div>

      {needsAll && tree.loading && <div className="sk" style={{ margin: 12, height: 260 }} />}
      {needsAll && tree.error && (
        <div className="card empty" style={{ margin: 12 }}>
          <p className="error">{tree.error}</p>
          <button type="button" className="btn ghost" onClick={tree.reload}>Thử lại</button>
        </div>
      )}
      {data && mode === "2d" && (
        <>
          <Tree2D data={data} focalId={focalId} depth={depth} onFocus={setFocal} />
          <p className="muted hint">Kéo để di chuyển, chụm hai ngón để phóng to. Chạm một thẻ để đặt làm trung tâm.</p>
        </>
      )}
      {data && mode === "3d" && (
        <>
          <Tree3D data={data} visible={visible} openPerson={openPerson} />
          <p className="muted hint">Kéo để xoay, chụm hai ngón để phóng to. Chạm tên để mở hồ sơ.</p>
        </>
      )}

      {folderSeen && (
        <div style={{ display: mode === "folder" ? undefined : "none" }}>
          <TreeScreen clanId={clanId} source={source} genOffset={genOffset} openPerson={openPerson} />
        </div>
      )}
    </div>
  );
}
