import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  IconChevronDown,
  IconSearch,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import {
  loadFolderNode,
  loadFolderRoots,
  loadUnlinked,
} from "@/lib/queries/treeFolder";
import type { TreeSource } from "@/lib/queries/tree";
import { groupLabel, type FolderChild } from "@/lib/tree/folderModel";

/**
 * Cây gia phả kiểu THƯ MỤC — bung tới đâu tải tới đó.
 *
 * Vì sao thêm kiểu xem này bên cạnh 2D/3D: hai kiểu kia kéo cả dòng họ
 * về rồi mới vẽ, mà ở đây 9.000 người là chuyện thường — trên điện thoại
 * yếu là đứng hình. Cây thư mục chỉ tải đúng nhánh đang mở, nên mở được
 * dòng họ lớn ở bất cứ máy nào, và đọc theo dòng thì dễ dò tên hơn là
 * nhìn sơ đồ.
 *
 * Cách hiển thị vợ/con theo đúng quyết định đã chốt — xem
 * lib/tree/folderModel.ts để biết mỗi luật dựa trên số đo nào.
 */

export function TreeFolderView({
  clanId,
  source,
}: {
  clanId: string;
  source: TreeSource;
}) {
  const rootsQ = useQuery({
    queryKey: ["folder-roots", clanId, source],
    queryFn: () => loadFolderRoots(clanId, source),
  });

  if (rootsQ.isLoading) return <LoadingState label="Đang tải gốc cây…" />;
  if (rootsQ.error)
    return <ErrorState error={rootsQ.error} onRetry={() => rootsQ.refetch()} />;

  const { roots, orphanCount } = rootsQ.data!;

  return (
    <div className="rounded-xl border bg-card p-2 sm:p-3">
      {roots.length === 0 && orphanCount === 0 && (
        <p className="p-4 text-sm text-muted-foreground">
          Dòng họ chưa có ai. Thêm Thuỷ tổ để bắt đầu.
        </p>
      )}
      <ul className="space-y-0.5">
        {roots.map((r) => (
          <PersonNode
            key={r.id}
            clanId={clanId}
            source={source}
            person={r}
            depth={0}
            defaultOpen
          />
        ))}
      </ul>

      {orphanCount > 0 && (
        <UnlinkedSection
          clanId={clanId}
          source={source}
          count={orphanCount}
        />
      )}
    </div>
  );
}

/** Một người + phần bung ra bên dưới. */
function PersonNode({
  clanId,
  source,
  person,
  depth,
  defaultOpen = false,
  spouseHint,
}: {
  clanId: string;
  source: TreeSource;
  person: FolderChild;
  depth: number;
  defaultOpen?: boolean;
  /** Tên vợ/chồng ghi ngay trên dòng (ca một cuộc hôn nhân). */
  spouseHint?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Chỉ tải khi đã mở — đó là toàn bộ lý do có kiểu xem này.
  const nodeQ = useQuery({
    queryKey: ["folder-node", clanId, person.id, source],
    queryFn: () => loadFolderNode(clanId, person.id, source),
    enabled: open,
  });

  const years = [person.birthYear, person.deathYear].some(Boolean)
    ? `${person.birthYear ?? "?"}–${person.deathYear ?? (person.isLiving ? "nay" : "?")}`
    : null;

  return (
    <li>
      <div
        className="flex items-center gap-1 rounded-md hover:bg-muted/50"
        style={{ paddingLeft: depth * 16 }}
      >
        {/* Mũi tên chỉ hiện khi CÓ con — biết trước nhờ cờ hasChildren,
            không phải tải thử rồi mới biết. */}
        {person.hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? `Thu gọn ${person.name}` : `Mở ${person.name}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <IconChevronDown
              className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
        ) : (
          <span className="inline-block h-9 w-9 shrink-0" aria-hidden />
        )}

        <Link
          to={`/clans/${clanId}/people/${person.id}`}
          className="flex min-h-[36px] min-w-0 flex-1 flex-wrap items-center gap-x-2 py-1 text-sm"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              person.gender === "M" ? "bg-sky-500" : "bg-rose-400"
            }`}
            aria-hidden
          />
          <span className="font-medium">{person.name}</span>
          {person.generation != null && (
            <span className="text-xs text-muted-foreground">
              đời {person.generation}
            </span>
          )}
          {years && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {years}
            </span>
          )}
          {spouseHint && (
            <span className="text-xs text-muted-foreground">⚭ {spouseHint}</span>
          )}
        </Link>
      </div>

      {open && (
        <>
          {nodeQ.isLoading && (
            <p
              className="py-1 text-xs text-muted-foreground"
              style={{ paddingLeft: (depth + 1) * 16 + 36 }}
            >
              Đang tải…
            </p>
          )}
          {/* Tên vợ/chồng phải đứng NGAY DƯỚI người đó, trước danh sách
              con — đặt sau danh sách thì nó dính vào đứa con cuối cùng và
              người đọc tưởng là vợ của đứa con. */}
          {nodeQ.data?.inlineSpouseName && !spouseHint && (
            <p
              className="pb-0.5 text-xs text-muted-foreground"
              style={{ paddingLeft: (depth + 1) * 16 + 36 }}
            >
              ⚭ {nodeQ.data.inlineSpouseName}
            </p>
          )}
          {nodeQ.data && (
            <ul className="space-y-0.5">
              {/* Một cuộc hôn nhân: con nằm thẳng dưới, không thêm tầng. */}
              {nodeQ.data.directChildren.map((c) => (
                <PersonNode
                  key={c.id}
                  clanId={clanId}
                  source={source}
                  person={c}
                  depth={depth + 1}
                />
              ))}

              {/* Hai cuộc trở lên: mỗi cuộc một nhóm. */}
              {nodeQ.data.groups.map((g) => (
                <li key={g.familyId}>
                  <div
                    className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
                    style={{ paddingLeft: (depth + 1) * 16 + 36 }}
                  >
                    <span aria-hidden>⚭</span>
                    <span className={g.spouseName ? "font-medium" : "italic"}>
                      {groupLabel(g, person.gender)}
                    </span>
                    <span>
                      {g.children.length > 0
                        ? `— ${g.children.length} con`
                        : "— chưa có con"}
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {g.children.map((c) => (
                      <PersonNode
                        key={c.id}
                        clanId={clanId}
                        source={source}
                        person={c}
                        depth={depth + 2}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

    </li>
  );
}

/**
 * Người chưa gắn vào cây.
 *
 * Trên production có 2.358/9.309 người không có cha mẹ. Nếu chỉ vẽ nhánh
 * từ thuỷ tổ thì một phần tư dòng họ biến mất khỏi màn hình và người
 * dùng tưởng mất dữ liệu — nên nhóm này luôn có mặt, kèm ô tìm kiếm vì
 * danh sách dài.
 */
function UnlinkedSection({
  clanId,
  source,
  count,
}: {
  clanId: string;
  source: TreeSource;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const listQ = useQuery({
    queryKey: ["folder-unlinked", clanId, source, q],
    queryFn: () => loadUnlinked(clanId, { search: q, limit: 50 }, source),
    enabled: open,
  });

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-1 text-sm hover:bg-muted/50"
      >
        <IconChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <IconUsers className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">Chưa gắn vào cây</span>
        <span className="text-muted-foreground">({count})</span>
      </button>

      {open && (
        <div className="space-y-2 pl-6">
          <Input
            icon={<IconSearch />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm trong danh sách này…"
            aria-label="Tìm người chưa gắn vào cây"
          />
          {listQ.isLoading && (
            <p className="text-xs text-muted-foreground">Đang tải…</p>
          )}
          <ul className="space-y-0.5">
            {(listQ.data ?? []).map((p) => (
              <PersonNode
                key={p.id}
                clanId={clanId}
                source={source}
                person={p}
                depth={0}
              />
            ))}
          </ul>
          {listQ.data && listQ.data.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Không tìm thấy ai khớp.
            </p>
          )}
          {listQ.data && listQ.data.length >= 50 && (
            <p className="text-xs text-muted-foreground">
              Chỉ hiện 50 người đầu — gõ tên để thu hẹp.
            </p>
          )}
          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <IconUser className="h-3.5 w-3.5" />
            Những người này chưa có cha/mẹ trong gia phả nên chưa nối được
            vào nhánh nào.
          </p>
        </div>
      )}
    </div>
  );
}
