import { parseBio } from "@/components/BioText";
import { useState, type ReactNode } from "react";

import { IconArrowRight, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { computeLifespanYears, lifespanLabel } from "@/lib/lifespan";
import {
  formatLunarAnniversary,
  formatLunarDate,
  solarStringToLunar,
} from "@/lib/lunarDate";
import { formatPartialDate } from "@/lib/partialDate";
import { getPersonRelationships, type Relationship } from "@/lib/queries/families";
import { deletePerson, getPerson, type PersonDetail } from "@/lib/queries/persons";

import { usePhotoUrls } from "../photos";
import { useRev } from "../rev";
import { useAsync } from "../useAsync";
import type { Relation } from "./AddRelative";

/**
 * Hồ sơ một người — dựng theo trang chi tiết của bản web: đường dẫn, đầu
 * trang (ảnh + tên + "Thuỷ tổ • Đời N • đã mất"), thẻ "Thông tin cơ bản"
 * với đúng các dòng và thứ tự của web, rồi thẻ "Quan hệ". Người có quyền
 * thì sửa, thêm vợ/chồng/con và xoá ngay tại đây.
 */

/** Một dòng thông tin: nhãn nhỏ ở trên, giá trị ở dưới. Trống thì bỏ cả dòng. */
function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "" || value === false) return null;
  return (
    <div className="drow">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Ngày âm: ưu tiên ngày âm ghi sẵn (bia mộ thường chỉ có âm lịch), không
 * có thì suy từ ngày dương đầy đủ — cùng cách với web.
 */
function lunarText(
  y: number | null,
  m: number | null,
  d: number | null,
  fallbackSolar: string | null,
): string | null {
  if (y || m || d) {
    return formatLunarDate({ year: y ?? undefined, month: m ?? undefined, day: d ?? undefined }) || null;
  }
  const derived = fallbackSolar ? solarStringToLunar(fallbackSolar) : null;
  return derived ? formatLunarDate(derived) || null : null;
}

export function PersonScreen({
  clanId,
  clanName,
  personId,
  source,
  genOffset,
  onEdit,
  onAdd,
  onDeleted,
  openPerson,
}: {
  clanId: string;
  clanName: string;
  /** Có thì hiện nút "Sửa" — chỉ truyền khi người dùng có quyền sửa. */
  onEdit?: () => void;
  /** Có thì hiện mục "Xoá người này"; gọi sau khi xoá xong. */
  onDeleted?: () => void;
  /** Có thì hiện nút "+ Thêm" ở nhóm Cha mẹ (khi chưa đủ hai), Vợ/chồng và Con cái. */
  onAdd?: (relation: Relation) => void;
  personId: string;
  /** Khách xem họ công khai đọc bản đã che thông tin người còn sống. */
  source: "persons" | "persons_public_safe";
  genOffset: number;
  openPerson: (id: string) => void;
}) {
  const rev = useRev();
  const q = useAsync(async () => {
    const [person, rel] = await Promise.all([
      getPerson(personId, undefined, source),
      getPersonRelationships(personId, undefined, source),
    ]);
    return { person, rel };
  }, [personId, source, rev]);
  // Xoá: phải bấm hai lần (mở xác nhận rồi mới xoá) — cùng mức thận trọng
  // với hộp xác nhận của web.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const rel = q.data?.rel;
  const all = rel ? [...rel.parents, ...rel.spouses, ...rel.children] : [];
  const photo = usePhotoUrls([q.data?.person?.photo_path, ...all.map((r) => r.photo_path)]);

  if (q.loading) {
    return (
      <div className="page">
        <div className="sk" style={{ height: 64 }} />
        <div className="sk" style={{ height: 260, marginTop: 12 }} />
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
  const p: PersonDetail = q.data.person;
  const tho = p.is_living ? null : computeLifespanYears(p.lifespan_years, p.birth_date, p.death_date);

  const group = (
    label: string,
    items: Relationship[],
    emptyHint: string,
    add?: Relation,
  ) => (
    <div className="relgroup">
      <h4 className="sec-row">
        {label}
        {add && onAdd && (
          <button type="button" className="btn ghost sm" onClick={() => onAdd(add)}>
            <IconPlus />
            Thêm
          </button>
        )}
      </h4>
      {items.length === 0 ? (
        <div className="hintbox">{emptyHint}</div>
      ) : (
        items.map((r) => (
          <button key={r.id} type="button" className="card relrow" onClick={() => openPerson(r.id)}>
            <img src={photo(r.photo_path, r.gender)} width={40} height={40} alt="" />
            <span style={{ minWidth: 0, flex: 1 }}>
              <b className="ell">{r.full_name}</b>
              <span className="tiny" style={{ margin: 0 }}>
                {r.gender === "M" ? "Nam" : "Nữ"}{!r.is_living && " · đã mất"}
              </span>
            </span>
            <span className="go"><IconArrowRight /></span>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="page">
      <p className="crumb">
        {clanName} <span>›</span> Danh bạ <span>›</span> <b>{p.full_name}</b>
      </p>

      <header className="phead">
        <img src={photo(p.photo_path, p.gender)} width={56} height={56} alt="" />
        <div style={{ minWidth: 0 }}>
          <h1 className="serif ell">{p.full_name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {p.is_root && <span className="root" style={{ margin: 0 }}>Thuỷ tổ • </span>}
            {p.generation !== null && <>Đời {p.generation - genOffset}</>}
            {!p.is_living && (
              <>
                {p.generation !== null && " • "}đã mất
                {p.death_date?.slice(0, 4) && ` • ${p.death_date.slice(0, 4)}`}
              </>
            )}
          </p>
        </div>
        {/* Nút Sửa nằm cạnh tên, không còn là thanh to dính đáy đè lên nội
            dung khi cuộn. */}
        {onEdit && (
          <button type="button" className="btn ghost sm" onClick={onEdit}>
            <IconPencil />
            Sửa
          </button>
        )}
      </header>

      <section className="card pane">
        <h3 className="serif">Thông tin cơ bản</h3>
        <Row label="Giới tính" value={p.gender === "M" ? "Nam" : "Nữ"} />
        <Row label="Tên tự" value={p.courtesy_name} />
        <Row label="Tên húy" value={p.nickname} />
        <Row label="Tên thụy" value={p.posthumous_name} />
        <Row label="Ngày sinh" value={formatPartialDate({ date: p.birth_date, precision: p.birth_date_precision }) || null} />
        <Row
          label="Ngày sinh (âm)"
          value={lunarText(p.birth_lunar_year, p.birth_lunar_month, p.birth_lunar_day, p.birth_date_precision === "day" ? p.birth_date : null)}
        />
        {!p.is_living && (
          <>
            <Row label="Ngày mất" value={formatPartialDate({ date: p.death_date, precision: p.death_date_precision }) || null} />
            <Row
              label="Ngày mất (âm)"
              value={lunarText(p.death_lunar_year, p.death_lunar_month, p.death_lunar_day, p.death_date_precision === "day" ? p.death_date : null)}
            />
            <Row
              label="Ngày giỗ"
              value={formatLunarAnniversary({ month: p.death_anniv_lunar_month ?? undefined, day: p.death_anniv_lunar_day ?? undefined }) || null}
            />
            {tho != null && <Row label={lifespanLabel(tho)} value={`${tho} tuổi`} />}
          </>
        )}
        <Row label="Nơi sinh" value={p.birth_place} />
        <Row label="Nơi an táng" value={p.burial_place} />
        {p.bio && (
          <div className="drow" style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 6 }}>
            <span>Tiểu sử</span>
            <Bio text={p.bio} />
          </div>
        )}
      </section>

      {rel && (
        <section className="card pane">
          <h3 className="serif">Quan hệ</h3>
          {group("Cha mẹ", rel.parents, "Chưa nhập cha mẹ", rel.parents.length < 2 ? "parent" : undefined)}
          {group("Vợ / chồng", rel.spouses, "Chưa có vợ / chồng.", "spouse")}
          {group("Con cái", rel.children, "Chưa có con cái.", "child")}
        </section>
      )}

      {/* Xoá: một dòng chữ đỏ ở cuối trang, tách khỏi các thẻ nội dung; bấm
          mới mở phần xác nhận. */}
      {onDeleted &&
        (confirmDelete ? (
          <section className="card pane dangerpane">
            <b style={{ display: "block", fontSize: 15 }}>Xoá {p.full_name}?</b>
            <p className="note" style={{ marginTop: 4 }}>
              Người này sẽ biến khỏi cây và danh bạ. Quản trị dòng họ có thể khôi
              phục lại từ nhật ký thay đổi.
            </p>
            {deleteError && <p className="error">{deleteError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn neutral" style={{ flex: 1 }} disabled={deleting} onClick={() => setConfirmDelete(false)}>Huỷ</button>
              <button
                type="button"
                className="btn danger"
                style={{ flex: 1 }}
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  setDeleteError(null);
                  deletePerson(personId)
                    .then(onDeleted)
                    .catch((e: Error) => {
                      setDeleteError(e.message);
                      setDeleting(false);
                    });
                }}
              >
                {deleting ? "Đang xoá…" : "Xoá"}
              </button>
            </div>
          </section>
        ) : (
          <button type="button" className="btn danger2 block" style={{ marginTop: 8 }} onClick={() => setConfirmDelete(true)}>
            <IconTrash />
            Xoá
          </button>
        ))}
    </div>
  );
}

/** Tiểu sử có mục ("## Tiêu đề", "- ý"); không có mục thì hiện như văn bản thường. */
function Bio({ text }: { text: string }) {
  if (!/^##\s/m.test(text)) {
    return <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{text}</span>;
  }
  return (
    <span style={{ display: "block", lineHeight: 1.55 }}>
      {parseBio(text).map((b, i) =>
        b.kind === "h" ? (
          <b key={i} style={{ display: "block", marginTop: i ? 12 : 0 }}>{b.text}</b>
        ) : b.kind === "ul" ? (
          <ul key={i} style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {b.items.map((x, j) => (
              <li key={j} style={{ marginBottom: 4 }}>{x}</li>
            ))}
          </ul>
        ) : (
          <span key={i} style={{ display: "block", marginTop: 4, whiteSpace: "pre-wrap" }}>{b.text}</span>
        ),
      )}
    </span>
  );
}
