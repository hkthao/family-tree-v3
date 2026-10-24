import { useState } from "react";

import { IconArrowRight, IconCamera, IconX } from "@/components/icons";
import type { ClanSummary } from "@/lib/queries/clans";
import { getMemoryRoom, listMemoryRooms, resolveRoomItems } from "@/lib/queries/memoryRooms";
import { HONOR_CATEGORY_LABEL, listHonorEntries } from "@/lib/queries/honor";

import { useRev } from "../rev";
import { useAsync } from "../useAsync";

/**
 * Phòng ký ức và Bảng vàng công đức — CHỈ ĐỌC trong Mini App (thêm/sửa làm
 * trên web, chủ dự án chốt 24/10/2026).
 *
 * Phòng ký ức trên web là phòng trưng bày 3D, gắn liền công cụ bày biện của
 * người sửa. Ở đây hiện ảnh trong phòng dạng lưới — đúng cách trang web hiển
 * thị trên máy không chạy được 3D — bấm ảnh để xem lớn.
 */

export function MemoryRoomsScreen({ clan, openRoom }: { clan: ClanSummary; openRoom: (id: string) => void }) {
  const rev = useRev();
  const rooms = useAsync(() => listMemoryRooms(clan.id), [clan.id, rev]);
  const list = rooms.data ?? [];
  return (
    <div className="page">
      <p className="note" style={{ margin: "2px 4px 10px" }}>Phòng trưng bày ảnh các cụ và kỷ niệm của dòng họ.</p>
      {rooms.loading && !rooms.data && <div className="sk" style={{ height: 160 }} />}
      {rooms.error && <p className="error">{rooms.error}</p>}
      {rooms.data && list.length === 0 && (
        <div className="card empty"><div className="icon"><IconCamera /></div><p className="muted">Chưa có phòng ký ức.</p></div>
      )}
      {list.map((r) => (
        <button key={r.id} type="button" className="card grave-card" onClick={() => openRoom(r.id)}>
          <span className="grave-thumb">{r.cover_image_url ? <img src={r.cover_image_url} alt="" /> : <IconCamera />}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b className="ell">{r.name}</b>
            {r.description && <span className="post-body" style={{ fontSize: 13, color: "var(--muted)" }}>{r.description}</span>}
          </span>
          <span className="go"><IconArrowRight /></span>
        </button>
      ))}
    </div>
  );
}

export function MemoryRoomScreen({ roomId, openPerson }: { roomId: string; openPerson: (id: string) => void }) {
  const rev = useRev();
  const room = useAsync(() => getMemoryRoom(roomId), [roomId, rev]);
  const items = useAsync(() => resolveRoomItems(roomId), [roomId, rev]);
  const [viewing, setViewing] = useState<{ url: string; title: string; subtitle: string; personId: string | null } | null>(null);
  const photos = items.data?.photos ?? [];

  return (
    <div className="page">
      {room.data && (
        <header className="phead">
          <span className="grave-thumb lg"><IconCamera /></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <h2 className="serif" style={{ margin: 0, fontSize: 20 }}>{room.data.name}</h2>
            {room.data.description && <span className="tiny" style={{ margin: 0 }}>{room.data.description}</span>}
          </span>
        </header>
      )}
      {items.loading && !items.data && <div className="sk" style={{ height: 300 }} />}
      {items.error && <p className="error">{items.error}</p>}
      {items.data && photos.length === 0 && (
        <div className="card empty"><p className="muted">Phòng chưa có ảnh.</p></div>
      )}
      {photos.length > 0 && (
        <div className="mem-grid">
          {photos.map((p) => (
            <button key={p.id} type="button" className="mem-frame" onClick={() => setViewing({ url: p.url, title: p.title, subtitle: p.subtitle, personId: p.personId })}>
              <img src={p.url} alt="" loading="lazy" />
              <b className="ell">{p.title}</b>
              {p.subtitle && <span className="tiny" style={{ margin: 0 }}>{p.subtitle}</span>}
            </button>
          ))}
        </div>
      )}
      {photos.length > 0 && <p className="note" style={{ textAlign: "center" }}>Xem phòng trưng bày 3D trên bản web.</p>}

      {viewing && (
        <div className="lightbox" role="dialog" aria-label="Xem ảnh" onClick={() => setViewing(null)}>
          <img src={viewing.url} alt="" />
          <div className="lightbox-cap" onClick={(e) => e.stopPropagation()}>
            <b>{viewing.title}</b>
            {viewing.subtitle && <span> · {viewing.subtitle}</span>}
            {viewing.personId && (
              <button type="button" className="btn text" style={{ display: "block", margin: "6px auto 0", color: "#fff", minHeight: 0 }} onClick={() => { const id = viewing.personId!; setViewing(null); openPerson(id); }}>
                Xem hồ sơ →
              </button>
            )}
          </div>
          <button type="button" aria-label="Đóng"><IconX /></button>
        </div>
      )}
    </div>
  );
}

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " đ";

export function HonorScreen({ clan, openPerson }: { clan: ClanSummary; openPerson: (id: string) => void }) {
  const rev = useRev();
  const entries = useAsync(() => listHonorEntries(clan.id), [clan.id, rev]);
  const list = entries.data ?? [];
  const totalMoney = list.filter((e) => e.category === "donation_money" && e.amount).reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <div className="page">
      <p className="note" style={{ margin: "2px 4px 10px" }}>Vinh danh tấm lòng đóng góp & thành tích của con cháu dòng họ.</p>
      {totalMoney > 0 && (
        <section className="card pane honor-total">
          <span className="tiny" style={{ margin: 0, textTransform: "uppercase", letterSpacing: ".04em" }}>Tổng công đức bằng tiền</span>
          <div className="fund-balance" style={{ color: "var(--accent)" }}>{vnd(totalMoney)}</div>
        </section>
      )}
      {entries.loading && !entries.data && <div className="sk" style={{ height: 200 }} />}
      {entries.error && <p className="error">{entries.error}</p>}
      {entries.data && list.length === 0 && (
        <div className="card empty"><p className="muted">Chưa có ghi nhận công đức.</p></div>
      )}
      {list.length > 0 && (
        <div className="card group">
          {list.map((e) => (
            <div key={e.id} className="grow fund-row">
              {e.person_id ? (
                <button type="button" className="btn text" style={{ padding: 0, minHeight: 0, fontWeight: 600, fontSize: 15 }} onClick={() => openPerson(e.person_id!)}>{e.honoree_name}</button>
              ) : (
                <b style={{ fontSize: 15 }}>{e.honoree_name}</b>
              )}
              <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span className={`chip honor-${e.category}`}>{HONOR_CATEGORY_LABEL[e.category]}</span>
                {e.amount != null && <b style={{ fontSize: 14 }}>{vnd(e.amount)}</b>}
              </span>
              {e.note && <span className="tiny" style={{ margin: "4px 0 0" }}>{e.note}</span>}
              {e.occurred_on && <span className="tiny" style={{ margin: "2px 0 0" }}>{e.occurred_on.split("-").reverse().join("/")}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
