import { openWebview } from "zmp-sdk";

import { displayGenLabel } from "@/lib/displayGeneration";
import { formatLunarAnniversary } from "@/lib/lunarDate";
import { formatPartialDate } from "@/lib/partialDate";
import { getPersonRelationships, type Relationship } from "@/lib/queries/families";
import { getPerson } from "@/lib/queries/persons";
import { generationColor } from "@/lib/tree/folderModel";

import { usePhotoUrls } from "../photos";
import { useAsync } from "../useAsync";

const WEB = "https://giapha.thaohk.com";

/** Hồ sơ một người — chỉ xem. Sửa thì mở bản web. */
export function PersonScreen({
  clanId,
  personId,
  genOffset,
  openPerson,
}: {
  clanId: string;
  personId: string;
  genOffset: number;
  openPerson: (id: string) => void;
}) {
  const q = useAsync(
    async () => {
      const [person, rel] = await Promise.all([
        getPerson(personId),
        getPersonRelationships(personId),
      ]);
      return { person, rel };
    },
    [personId],
  );
  const rel = q.data?.rel;
  const all = rel ? [...rel.parents, ...rel.spouses, ...rel.children] : [];
  const photo = usePhotoUrls([q.data?.person?.photo_path, ...all.map((r) => r.photo_path)]);

  if (q.loading) return <div className="page muted">Đang tải…</div>;
  if (q.error || !q.data?.person) {
    return (
      <div className="page">
        <p className="error">{q.error ?? "Không tìm thấy người này."}</p>
        <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
      </div>
    );
  }
  const p = q.data.person;
  const color = generationColor(p.generation);
  const facts: [string, string | null][] = [
    ["Tên tự", p.courtesy_name],
    ["Tên huý / thuỵ", p.posthumous_name],
    ["Tên thường gọi", p.nickname],
    ["Sinh", formatPartialDate({ date: p.birth_date, precision: p.birth_date_precision }) || null],
    ["Mất", formatPartialDate({ date: p.death_date, precision: p.death_date_precision }) || (p.is_living ? null : "đã mất")],
    ["Ngày giỗ", formatLunarAnniversary({ month: p.death_anniv_lunar_month ?? undefined, day: p.death_anniv_lunar_day ?? undefined }) || null],
    ["Nơi sinh", p.birth_place],
    ["Nơi an táng", p.burial_place],
  ];

  const group = (label: string, items: Relationship[]) =>
    items.length > 0 && (
      <>
        <h3 className="h3">{label}</h3>
        {items.map((r) => (
          <button key={r.id} type="button" className="rel" onClick={() => openPerson(r.id)}>
            <img src={photo(r.photo_path, r.gender)} width={36} height={36} alt="" style={{ borderRadius: 999, objectFit: "cover" }} />
            <span style={{ minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 14 }}>{r.full_name}</b>
              <span className="muted">{r.gender === "M" ? "Nam" : "Nữ"}{!r.is_living && " · đã mất"}</span>
            </span>
          </button>
        ))}
      </>
    );

  return (
    <div className="page">
      <div className="hero">
        <span className="ring" style={{ background: color ?? "transparent", padding: 3 }}>
          <img src={photo(p.photo_path, p.gender)} width={84} height={84} alt="" />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2>
            {p.full_name}{" "}
            <span className={p.gender === "M" ? "m" : "f"} style={{ fontSize: 16 }}>{p.gender === "M" ? "♂" : "♀"}</span>
          </h2>
          <div className="meta">
            {color && <span className="badge" style={{ background: color }}>{displayGenLabel(p.generation, genOffset)}</span>}
            {p.is_root && "Thuỷ tổ"}
          </div>
        </div>
      </div>

      <dl className="facts">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {p.bio && (
        <>
          <h3 className="h3">Tiểu sử</h3>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 14, lineHeight: 1.5 }}>{p.bio}</p>
        </>
      )}

      {rel && (
        <>
          {group("Cha mẹ", rel.parents)}
          {group("Vợ / chồng", rel.spouses)}
          {group("Con cái", rel.children)}
        </>
      )}

      {/* Sửa hồ sơ, thêm người, xuất sổ… là việc của bản web (bước 5). */}
      <p style={{ marginTop: 24 }}>
        <button
          type="button"
          className="btn ghost"
          onClick={() => openWebview({ url: `${WEB}/clans/${clanId}/people/${personId}` })}
        >
          Mở bản web đầy đủ
        </button>
      </p>
    </div>
  );
}
