import type { CSSProperties } from "react";
import { IconArrowRight } from "@/components/icons";
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
  source,
  genOffset,
  openPerson,
}: {
  clanId: string;
  personId: string;
  /** Khách xem họ công khai đọc bản đã che thông tin người còn sống. */
  source: "persons" | "persons_public_safe";
  genOffset: number;
  openPerson: (id: string) => void;
}) {
  const q = useAsync(
    async () => {
      const [person, rel] = await Promise.all([
        getPerson(personId, undefined, source),
        getPersonRelationships(personId, undefined, source),
      ]);
      return { person, rel };
    },
    [personId, source],
  );
  const rel = q.data?.rel;
  const all = rel ? [...rel.parents, ...rel.spouses, ...rel.children] : [];
  const photo = usePhotoUrls([q.data?.person?.photo_path, ...all.map((r) => r.photo_path)]);

  if (q.loading) {
    return (
      <div className="page">
        <div className="sk" style={{ height: 220 }} />
        <div className="sk" style={{ height: 180, marginTop: 14 }} />
      </div>
    );
  }
  if (q.error || !q.data?.person) {
    return (
      <div className="center">
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

  const shown = facts.filter(([, v]) => v);
  const gen = { "--gen": color ?? undefined } as CSSProperties;

  const group = (label: string, items: Relationship[]) =>
    items.length > 0 && (
      <>
        <h3 className="section-title">{label}</h3>
        <div className="card rels">
          {items.map((r) => (
            <button key={r.id} type="button" className="rel" onClick={() => openPerson(r.id)}>
              <img src={photo(r.photo_path, r.gender)} width={44} height={44} alt="" />
              <span style={{ minWidth: 0 }}>
                <b>{r.full_name}</b>
                <span className="muted">{r.gender === "M" ? "Nam" : "Nữ"}{!r.is_living && " · đã mất"}</span>
              </span>
              <span className="go"><IconArrowRight /></span>
            </button>
          ))}
        </div>
      </>
    );

  return (
    <div className="page" style={gen}>
      <div className="card hero">
        <div className="cover" />
        <span className="ring">
          <img src={photo(p.photo_path, p.gender)} width={92} height={92} alt="" />
        </span>
        <h2>{p.full_name}</h2>
        <div className="chips">
          {color && <span className="badge" style={{ fontSize: 12, padding: "3px 10px" }}>{displayGenLabel(p.generation, genOffset)}</span>}
          {p.is_root && <span className="chip">Thuỷ tổ</span>}
          <span className="chip">
            <span className={p.gender === "M" ? "m" : "f"}>{p.gender === "M" ? "♂" : "♀"}</span>{" "}
            {p.gender === "M" ? "Nam" : "Nữ"}
          </span>
          {!p.is_living && <span className="chip">Đã mất</span>}
        </div>
      </div>

      {shown.length > 0 && (
        <>
          <h3 className="section-title">Thông tin</h3>
          <dl className="card facts">
            {shown.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </>
      )}

      {p.bio && (
        <>
          <h3 className="section-title">Tiểu sử</h3>
          <div className="card bio">{p.bio}</div>
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
      <div className="cta">
        <button
          type="button"
          className="btn ghost block"
          onClick={() => openWebview({ url: `${WEB}/clans/${clanId}/people/${personId}` })}
        >
          Sửa hồ sơ trên bản web đầy đủ
        </button>
      </div>
    </div>
  );
}
