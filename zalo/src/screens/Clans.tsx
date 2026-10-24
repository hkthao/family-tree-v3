import { useEffect, useState } from "react";

import {
  IconBuildings,
  IconLink,
  IconTree,
} from "@/components/icons";
import { formatDate, formatRelative } from "@/lib/formatDate";
import {
  getClansInlawLinks,
  getClansLeaderboardStats,
  listCommunityClans,
  listMyClans,
  type ClanSummary,
} from "@/lib/queries/clans";

import { useRev } from "../rev";
import { useAsync } from "../useAsync";

type Scope = "mine" | "community";

const ROLE = { admin: "Quản trị", editor: "Biên tập", viewer: "Xem" } as const;

/**
 * Trang chủ — cùng bố cục với trang "Tất cả dòng họ" của bản web: gạt
 * Của tôi / Cộng đồng, ô tìm, rồi các thẻ dòng họ mang đúng những dòng
 * thông tin như trên web (vai trò, công khai hay riêng tư, ngày tạo, số
 * đời, thông gia).
 */
export function ClansScreen({
  userId,
  openClan,
  onLink,
}: {
  userId: string;
  openClan: (c: ClanSummary) => void;
  /** Tài khoản chỉ có Zalo: nút ở màn trống dẫn sang phần liên kết email. */
  onLink?: () => void;
}) {
  const rev = useRev();
  const [scope, setScope] = useState<Scope>("mine");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  const list = useAsync(async () => {
    const params = { page: 1, pageSize: 50, search: q || undefined };
    const res =
      scope === "mine"
        ? await listMyClans(userId, params)
        : await listCommunityClans(userId, params);
    const ids = res.rows.map((r) => r.id);
    // Số đời + thông gia là phần phụ: hỏng thì thẻ vẫn hiện, chỉ thiếu nhãn.
    const [stats, inlaws] = await Promise.all([
      getClansLeaderboardStats(ids).catch(() => new Map()),
      getClansInlawLinks(ids).catch(() => new Map()),
    ]);
    return { ...res, stats, inlaws };
  }, [userId, scope, q, rev]);

  // Con số trên hai nút gạt: đếm riêng một lần, không phụ thuộc ô tìm.
  const counts = useAsync(async () => {
    const [mine, community] = await Promise.all([
      listMyClans(userId, { page: 1, pageSize: 1 }),
      listCommunityClans(userId, { page: 1, pageSize: 1 }),
    ]);
    return { mine: mine.total, community: community.total };
  }, [userId, rev]);

  const rows = list.data?.rows ?? [];
  const n = (k: Scope) => (counts.data ? ` (${counts.data[k]})` : "");

  return (
    <div className="page">
      <div className="pagehead">
        <IconBuildings />
        <div>
          <h2>Tất cả dòng họ</h2>
          <p className="muted">
            {scope === "mine"
              ? "Các dòng họ bạn đang tham gia."
              : "Dòng họ công khai trên nền tảng — ai cũng xem được."}
          </p>
        </div>
      </div>

      <div className="seg" role="group" aria-label="Phạm vi">
        <button type="button" aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>
          Của tôi{n("mine")}
        </button>
        <button type="button" aria-pressed={scope === "community"} onClick={() => setScope("community")}>
          Cộng đồng{n("community")}
        </button>
      </div>

      <div className="searchbar" style={{ position: "static", margin: "0 0 10px", padding: 0 }}>
        <input
          className="field"
          type="search"
          placeholder="Tìm dòng họ — gõ không dấu cũng được"
          aria-label="Tìm dòng họ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {list.loading &&
        [0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 112, marginBottom: 8 }} />)}

      {list.error && (
        <div className="card empty">
          <p className="error">{list.error}</p>
          <button type="button" className="btn ghost" onClick={list.reload}>Thử lại</button>
        </div>
      )}

      {!list.loading && list.data && rows.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconTree /></div>
          <p className="muted">
            {q
              ? `Không có dòng họ nào khớp “${q}”.`
              : scope === "mine"
                ? onLink
                  ? "Tài khoản Zalo này chưa tham gia dòng họ nào. Đã lập gia phả trên web bằng email thì liên kết để thấy các dòng họ đó ở đây."
                  : "Tài khoản này chưa tham gia dòng họ nào."
                : "Chưa có dòng họ công khai nào."}
          </p>
          {!q && scope === "mine" && onLink && (
            <button type="button" className="btn" style={{ marginTop: 12 }} onClick={onLink}>
              Liên kết tài khoản email
            </button>
          )}
        </div>
      )}

      {!list.loading &&
        rows.map((c) => {
          const gens = list.data!.stats.get(c.id)?.max_generation;
          const inlaws = list.data!.inlaws.get(c.id) ?? [];
          return (
            <button key={c.id} type="button" className="card clan" onClick={() => openClan(c)}>
              <span className="top">
                <b>{c.name}</b>
                <span className="count">{c.person_count} thành viên</span>
              </span>
              {c.description && <span className="desc">{c.description}</span>}
              <span className="line">
                <span>
                  {c.role && <><strong>{ROLE[c.role]}</strong> • </>}
                  {c.visibility === "public" ? "Công khai" : "Riêng tư"}
                </span>
              </span>
              <span className="line">
                <span>Tạo {formatDate(c.created_at)} • Cập nhật {formatRelative(c.updated_at)}</span>
              </span>
              {inlaws.length > 0 && (
                <span className="line">
                  <IconLink className="ic" />
                  <span>Thông gia: {inlaws.map((x: { clan_name: string }) => x.clan_name).join(", ")}</span>
                </span>
              )}
              {gens ? (
                <span className="tags">
                  <span className="tag gen">{gens} đời</span>
                </span>
              ) : null}
            </button>
          );
        })}
    </div>
  );
}
