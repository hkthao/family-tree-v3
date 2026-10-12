import { listMyClans, type ClanSummary } from "@/lib/queries/clans";

import { useAsync } from "../useAsync";

/** Danh sách dòng họ của tôi — cửa vào cây. */
export function ClansScreen({
  userId,
  openClan,
}: {
  userId: string;
  openClan: (c: ClanSummary) => void;
}) {
  const q = useAsync(() => listMyClans(userId, { page: 1, pageSize: 50 }), [userId]);

  if (q.loading) return <div className="page muted">Đang tải dòng họ…</div>;
  if (q.error) {
    return (
      <div className="page">
        <p className="error">{q.error}</p>
        <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
      </div>
    );
  }
  const rows = q.data?.rows ?? [];
  return (
    <div className="page">
      {rows.length === 0 && (
        <p className="muted">
          Tài khoản này chưa tham gia dòng họ nào. Nếu bạn đã lập gia phả trên
          web, hãy liên kết tài khoản ở bên dưới.
        </p>
      )}
      {rows.map((c) => (
        <button key={c.id} type="button" className="card" onClick={() => openClan(c)}>
          <b>{c.name}</b>
          <span className="muted">{c.person_count} người</span>
        </button>
      ))}
    </div>
  );
}
