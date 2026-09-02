import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
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
import { PersonAvatar } from "@/components/PersonAvatar";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { useAuth } from "@/hooks/useAuth";
import { getInlawGhostSpouses } from "@/lib/queries/person-links";
import {
  loadFolderNode,
  loadFolderRoots,
  loadUnlinked,
} from "@/lib/queries/treeFolder";
import type { TreeSource } from "@/lib/queries/tree";
import {
  groupLabel,
  visibleGhostSpouses,
  type FolderChild,
  type FolderGhostSpouse,
  type FolderGroup,
  type FolderSpouse,
  type GhostSpouseSource,
} from "@/lib/tree/folderModel";

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

/**
 * URL ảnh đã ký cho một nhóm người.
 *
 * Ký theo TỪNG NHÁNH đang mở, không ký cả dòng họ: chín nghìn chữ ký cho
 * mấy chục người đang nhìn là phí, và Storage cũng không thích.
 */
function usePhotoUrls(paths: (string | null)[]): Map<string, string> {
  const list = paths.filter((p): p is string => !!p).sort();
  const { data } = useQuery({
    queryKey: ["folder-photos", list.join(",")],
    queryFn: () => getSignedPhotoUrlMap(list),
    enabled: list.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });
  return data ?? new Map();
}

/**
 * Dâu/rể nằm ở dòng họ thông gia, tra theo người trong họ này.
 *
 * Để trong context chứ không truyền xuống từng tầng: cây thư mục đệ quy
 * không giới hạn độ sâu, truyền tay thì mọi tầng đều phải mang hộ một
 * thứ mà hầu hết dòng không dùng tới.
 */
const GhostSpouseContext = createContext<Map<string, GhostSpouseSource[]>>(
  new Map(),
);

/** Dòng phụ: đời + năm sinh–mất. Tách hàm vì dùng ở cả người lẫn vợ/chồng. */
function metaLine(p: {
  generation?: number | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
}): string {
  const bits: string[] = [];
  if (p.generation != null) bits.push(`đời ${p.generation}`);
  if (p.birthYear || p.deathYear) {
    bits.push(
      `${p.birthYear ?? "?"}–${p.deathYear ?? (p.isLiving ? "nay" : "?")}`,
    );
  }
  return bits.join(" · ");
}

export function TreeFolderView({
  clanId,
  source,
}: {
  clanId: string;
  source: TreeSource;
}) {
  const { user } = useAuth();
  const rootsQ = useQuery({
    queryKey: ["folder-roots", clanId, source],
    queryFn: () => loadFolderRoots(clanId, source),
  });

  // Dâu/rể ở dòng họ thông gia. Tải rời, KHÔNG chặn cây: hỏng hay chậm
  // thì cây vẫn vẽ, chỉ thiếu mấy ô viền đứt — y như cây 2D.
  const ghostQ = useQuery({
    queryKey: ["folder-ghosts", clanId, user?.id ?? "anon"],
    queryFn: () => getInlawGhostSpouses(clanId),
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });
  const ghostsByPerson = useMemo(() => {
    const m = new Map<string, GhostSpouseSource[]>();
    for (const g of ghostQ.data ?? []) {
      const arr = m.get(g.localPersonId) ?? [];
      arr.push(g);
      m.set(g.localPersonId, arr);
    }
    return m;
  }, [ghostQ.data]);

  if (rootsQ.isLoading) return <LoadingState label="Đang tải gốc cây…" />;
  if (rootsQ.error)
    return <ErrorState error={rootsQ.error} onRetry={() => rootsQ.refetch()} />;

  const { roots, orphanCount } = rootsQ.data!;

  return (
    <GhostSpouseContext.Provider value={ghostsByPerson}>
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
    </GhostSpouseContext.Provider>
  );
}

/** Một người + phần bung ra bên dưới. */
function PersonNode({
  clanId,
  source,
  person,
  depth,
  defaultOpen = false,
}: {
  clanId: string;
  source: TreeSource;
  person: FolderChild;
  depth: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Chỉ tải khi đã mở — đó là toàn bộ lý do có kiểu xem này.
  const nodeQ = useQuery({
    queryKey: ["folder-node", clanId, person.id, source],
    queryFn: () => loadFolderNode(clanId, person.id, source),
    enabled: open,
  });

  // Dâu/rể bên dòng họ thông gia — bỏ những người mà chính họ này đã tự
  // ghi rồi, kẻo cùng một người đứng hai lần cạnh nhau.
  const ghostsHere = useContext(GhostSpouseContext).get(person.id) ?? [];
  const ghosts = visibleGhostSpouses(person.spouses, ghostsHere);

  // Đã bung ra mà người này có NHIỀU cuộc hôn nhân thì các nhóm bên dưới
  // đã nêu từng người vợ/chồng rồi — nhắc lại trên dòng là thừa. Còn khi
  // đang đóng thì phải nêu, nếu không người chưa có con (không có mũi
  // tên để bung) sẽ chẳng bao giờ thấy vợ/chồng mình đâu.
  const showsGroups = open && (nodeQ.data?.groups.length ?? 0) > 0;
  const spouses = showsGroups ? [] : person.spouses;

  const photoUrls = usePhotoUrls([
    person.photoPath,
    ...spouses.map((sp) => sp.photoPath),
  ]);

  const meta = metaLine(person);

  return (
    <li>
      <div
        className="flex items-start gap-1 rounded-md hover:bg-muted/50"
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
            className="mt-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <IconChevronDown
              className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
        ) : (
          <span className="inline-block h-9 w-9 shrink-0" aria-hidden />
        )}

        {/* MỘT NODE = vợ chồng đứng cùng dòng, thông tin đời/năm xuống
            dòng dưới. Nhét tất cả vào một dòng thì ở màn hẹp tên bị cắt
            cụt — mà tên mới là thứ người ta dò. */}
        {/* Điện thoại: vợ chồng XUỐNG DÒNG, mỗi người một hàng. Máy
            tính: đứng cạnh nhau.

            Trước đây để `flex-wrap` cho tự xuống dòng, nhưng tên người
            Việt dài (bốn chữ là thường) nên ở màn hẹp nó rớt dòng lộn
            xộn — có khi dấu ⚭ nằm trơ một mình cuối dòng trên. Xếp cột
            hẳn ở mobile thì mỗi hàng là một người trọn vẹn. */}
        <div className="flex min-w-0 flex-1 flex-col gap-y-0.5 py-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          <Link
            to={`/clans/${clanId}/people/${person.id}`}
            className="flex min-w-0 items-center gap-2"
          >
            <PersonAvatar
              gender={person.gender}
              photoUrl={
                person.photoPath ? photoUrls.get(person.photoPath) : null
              }
              size={32}
              className="shrink-0"
            />
            <span className="min-w-0">
              {/* Cho XUỐNG DÒNG chứ không cắt cụt: tên bốn năm chữ là
                  thường ở gia phả Việt, mà "Nguyễn Hoàng Minh Quân Đại
                  Ng…" thì không tra được là ai. Mỗi người đã có hàng
                  riêng nên xuống dòng không làm lộn xộn. */}
              <span className="block break-words text-sm font-medium">
                {person.name}
              </span>
              {meta && (
                <span className="block text-xs text-muted-foreground">
                  {meta}
                </span>
              )}
            </span>
          </Link>

          {spouses.map((sp) => (
            <SpouseChip
              key={sp.id}
              clanId={clanId}
              spouse={sp}
              photoUrls={photoUrls}
            />
          ))}

          {ghosts.map((g) => (
            <SpouseChip key={g.key} clanId={clanId} ghost={g} />
          ))}

        </div>
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
                  {/* Đa thê: mỗi cuộc hôn nhân một nhóm, có ảnh vợ để
                      nhận ra ngay chứ không phải đọc tên rồi đoán. */}
                  <GroupHeader
                    clanId={clanId}
                    group={g}
                    personGender={person.gender}
                    indent={(depth + 1) * 16 + 36}
                  />
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
 * Một người vợ/chồng đứng cạnh người trong họ.
 *
 * Hai dạng: người có sẵn trong dòng họ này (bấm mở được hồ sơ), hoặc dâu/rể
 * mà bản ghi nằm ở dòng họ thông gia — viền đứt + gắn tên họ bên kia, đúng
 * quy ước đang dùng ở cây 2D. Dạng thứ hai KHÔNG bấm được: ở dòng họ này
 * họ không có hồ sơ để mở, bấm vào chỉ dẫn tới trang lỗi.
 */
function SpouseChip({
  clanId,
  spouse,
  ghost,
  photoUrls,
}: {
  clanId: string;
  spouse?: FolderSpouse;
  ghost?: FolderGhostSpouse;
  photoUrls?: Map<string, string>;
}) {
  const person = spouse ?? ghost!.spouse;
  const meta = metaLine(person);

  // Dấu ⚭ nằm TRONG cùng một khối với người vợ/chồng, để nó không bao
  // giờ bị rớt dòng đứng trơ một mình.
  const body = (
    <>
      <span className="shrink-0 text-muted-foreground" aria-hidden>
        ⚭
      </span>
      <PersonAvatar
        gender={person.gender}
        photoUrl={
          person.photoPath ? (photoUrls?.get(person.photoPath) ?? null) : null
        }
        size={28}
        className={`shrink-0 opacity-90 ${
          ghost ? "border border-dashed border-accent" : ""
        }`}
      />
      <span className="min-w-0">
        <span className="block break-words text-sm">
          {person.name}
          {ghost && (
            <span className="ml-1.5 whitespace-nowrap rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
              {ghost.peerClanName}
            </span>
          )}
        </span>
        {meta && (
          <span className="block text-xs text-muted-foreground">{meta}</span>
        )}
      </span>
    </>
  );

  const cls = "flex min-w-0 items-center gap-2 pl-1 sm:pl-0";
  return ghost ? (
    <span className={cls} title={`Dâu/rể bên ${ghost.peerClanName}`}>
      {body}
    </span>
  ) : (
    <Link to={`/clans/${clanId}/people/${person.id}`} className={cls}>
      {body}
    </Link>
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


/** Đầu nhóm của một cuộc hôn nhân (chỉ dùng khi người đó có 2+ vợ/chồng). */
function GroupHeader({
  clanId,
  group,
  personGender,
  indent,
}: {
  clanId: string;
  group: FolderGroup;
  personGender: "M" | "F";
  indent: number;
}) {
  const photoUrls = usePhotoUrls([group.spouse?.photoPath ?? null]);
  const spouse = group.spouse;
  const meta = spouse ? metaLine(spouse) : "";

  const label = (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="text-muted-foreground">
        ⚭
      </span>
      {spouse && (
        <PersonAvatar
          gender={spouse.gender}
          photoUrl={spouse.photoPath ? photoUrls.get(spouse.photoPath) : null}
          size={26}
          className="shrink-0 opacity-90"
        />
      )}
      <span className="min-w-0">
        <span
          className={`block truncate text-sm ${
            group.spouseName ? "font-medium" : "italic text-muted-foreground"
          }`}
        >
          {groupLabel(group, personGender)}
        </span>
        <span className="block text-xs text-muted-foreground">
          {[meta, group.children.length > 0 ? `${group.children.length} con` : "chưa có con"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </span>
  );

  return (
    <div className="py-1" style={{ paddingLeft: indent }}>
      {spouse ? (
        <Link to={`/clans/${clanId}/people/${spouse.id}`}>{label}</Link>
      ) : (
        label
      )}
    </div>
  );
}
