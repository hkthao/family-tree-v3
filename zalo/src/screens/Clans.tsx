import { listMyClans, type ClanSummary } from "@/lib/queries/clans";

import { useAsync } from "../useAsync";

/** Chữ cái đại diện: chữ đầu của từ cuối ("Họ Huỳnh" → H, "Dương Hiển" → H). */
const monogram = (name: string) =>
  (name.replace(/\(.*?\)/g, "").trim().split(/\s+/).pop() ?? "?").charAt(0).toUpperCase();

/** Trang chủ: lời chào + danh sách dòng họ của tôi — cửa vào cây. */
export function ClansScreen({
  userId,
  name,
  openClan,
}: {
  userId: string;
  name: string;
  openClan: (c: ClanSummary) => void;
}) {
  const q = useAsync(() => listMyClans(userId, { page: 1, pageSize: 50 }), [userId]);
  const rows = q.data?.rows ?? [];

  return (
    <div className="page">
      <div className="hello">
        <small>Xin chào,</small>
        <strong>{name}</strong>
        {q.data && (
          <span>
            {rows.length > 0 ? `Bạn đang tham gia ${rows.length} dòng họ` : "Chưa tham gia dòng họ nào"}
          </span>
        )}
      </div>

      <h2 className="section-title">Dòng họ của tôi</h2>

      {q.loading &&
        [0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 76, marginBottom: 10 }} />)}

      {q.error && (
        <div className="card empty">
          <p className="error">{q.error}</p>
          <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
        </div>
      )}

      {q.data && rows.length === 0 && (
        <div className="card empty">
          <div className="icon">🌳</div>
          <p className="muted">
            Tài khoản này chưa tham gia dòng họ nào. Nếu bạn đã lập gia phả
            trên web, hãy liên kết tài khoản ở bên dưới.
          </p>
        </div>
      )}

      {rows.map((c) => (
        <button key={c.id} type="button" className="card clan" onClick={() => openClan(c)}>
          <span className="mono">{monogram(c.name)}</span>
          <span style={{ minWidth: 0 }}>
            <b>{c.name}</b>
            <span className="muted">{c.person_count} người</span>
          </span>
          <span className="go">›</span>
        </button>
      ))}
    </div>
  );
}
