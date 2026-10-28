import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { openOutApp } from "zmp-sdk";

import {
  IconArrowRight,
  IconBell,
  IconCamera,
  IconGrave,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/icons";
import { formatDate } from "@/lib/formatDate";
import { listCemeteries } from "@/lib/queries/cemeteries";
import type { ClanSummary } from "@/lib/queries/clans";
import { createEvent } from "@/lib/queries/events";
import { getKinshipIndex } from "@/lib/queries/kinship";
import {
  addOccupant,
  addPhoto,
  addRelocation,
  ADDRESS_PLACEHOLDER,
  createRestingPlace,
  deleteRestingPlace,
  directionsUrl,
  getRestingPlace,
  KIND_LOCATION_LABELS,
  listRestingPlaces,
  removeOccupant,
  removePhoto,
  removeRelocation,
  RESTING_PLACE_KIND_LABEL,
  RESTING_PLACE_STATUS_LABEL,
  updateRestingPlace,
  type RestingPlaceKind,
  type RestingPlaceStatus,
} from "@/lib/queries/restingPlaces";
import { matchesName } from "@/lib/unaccent";

import { forgetPhotos, usePhotoUrls, useSignedUrls } from "../photos";
import { useRev } from "../rev";
import { toast } from "../toast";
import { useAsync } from "../useAsync";

/**
 * Mộ phần & tro cốt — CÙNG CHỨC NĂNG với bốn trang /graves của web: danh
 * sách (tìm, lọc theo hình thức/cơ sở), chi tiết (ảnh, thông tin, người an
 * nghỉ, lịch sử cải táng, nhắc tảo mộ, chỉ đường), thêm/sửa/xoá. Dùng
 * nguyên `@/lib/queries/restingPlaces`; quyền do máy chủ kiểm.
 *
 * Không có ở đây (chỉ làm trên web): mã QR dán tại mộ — nó tạo link CÔNG
 * KHAI cho người ngoài xem, thuộc nhóm phân quyền/bảo mật; và trang quản lý
 * danh sách cơ sở/nghĩa trang (ở đây chỉ chọn cơ sở có sẵn).
 */
const KINDS = Object.keys(RESTING_PLACE_KIND_LABEL) as RestingPlaceKind[];
const STATUSES = Object.keys(RESTING_PLACE_STATUS_LABEL) as RestingPlaceStatus[];
const MAX_GRAVE_PHOTOS = 12;

function openMap(url: string) {
  openOutApp({ url }).catch(() => window.open(url, "_blank"));
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="drow">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── Danh sách ─────────────────────────────────────────────────────────

export function GravesScreen({
  clan,
  canEdit,
  openGrave,
  addGrave,
}: {
  clan: ClanSummary;
  canEdit: boolean;
  openGrave: (id: string) => void;
  addGrave: () => void;
}) {
  const rev = useRev();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<RestingPlaceKind | "">("");
  const [cemeteryId, setCemeteryId] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  const cemeteries = useAsync(() => listCemeteries(clan.id), [clan.id]);
  const places = useAsync(
    () => listRestingPlaces(clan.id, { search: q, kind: kind || null, cemeteryId: cemeteryId || null }),
    [clan.id, q, kind, cemeteryId, rev],
  );
  const list = places.data ?? [];
  const thumb = useSignedUrls(list.map((p) => p.first_photo_path));
  const filtered = !!q || !!kind || !!cemeteryId;

  return (
    <div className="page">
      <p className="note" style={{ margin: "2px 4px 10px" }}>Nơi an nghỉ của các cụ: mộ phần, tro cốt gửi chùa / tháp họ.</p>

      <div className="searchbar" style={{ position: "static", margin: "0 0 8px", padding: 0 }}>
        <input className="field" type="search" placeholder="Tìm theo tên / nghĩa trang / chùa…" aria-label="Tìm mộ phần" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="grave-filters">
        <select className="field select" value={kind} aria-label="Lọc theo hình thức" onChange={(e) => setKind(e.target.value as RestingPlaceKind | "")}>
          <option value="">Mọi hình thức</option>
          {KINDS.map((k) => <option key={k} value={k}>{RESTING_PLACE_KIND_LABEL[k]}</option>)}
        </select>
        {(cemeteries.data ?? []).length > 0 && (
          <select className="field select" value={cemeteryId} aria-label="Lọc theo cơ sở" onChange={(e) => setCemeteryId(e.target.value)}>
            <option value="">Mọi cơ sở</option>
            {cemeteries.data!.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {places.loading && !places.data && [0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 88, marginBottom: 8 }} />)}
      {places.error && <p className="error">{places.error}</p>}

      {places.data && list.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconGrave /></div>
          <p className="muted">
            {filtered ? "Không có mục nào khớp. Thử bỏ bớt bộ lọc." : canEdit ? "Chưa có mộ phần / tro cốt. Bấm “Thêm” để ghi nơi an nghỉ đầu tiên." : "Chưa có dữ liệu."}
          </p>
        </div>
      )}

      {list.map((p) => {
        const t = thumb(p.first_photo_path);
        return (
          <button key={p.id} type="button" className="card grave-card" onClick={() => openGrave(p.id)}>
            <span className="grave-thumb">{t ? <img src={t} alt="" /> : <IconGrave />}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b className="ell">{p.name || p.location_name || RESTING_PLACE_KIND_LABEL[p.kind]}</b>
              <span className="tiny ell" style={{ margin: 0 }}>
                {RESTING_PLACE_KIND_LABEL[p.kind]}
                {p.cemetery_name ? ` · ${p.cemetery_name}` : p.location_name ? ` · ${p.location_name}` : ""}
              </span>
              <span className="tiny" style={{ margin: 0 }}>
                {p.occupant_count} người an nghỉ
                {directionsUrl(p.latitude, p.longitude) && <span className="grave-pin"> · <IconMapPin /> có vị trí</span>}
              </span>
            </span>
            <span className="go"><IconArrowRight /></span>
          </button>
        );
      })}

      {canEdit && (
        <div className="cta">
          <button type="button" className="btn block" onClick={addGrave}>
            <IconPlus /> Thêm nơi an nghỉ
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Chi tiết ──────────────────────────────────────────────────────────

export function GraveScreen({
  clan,
  graveId,
  canEdit,
  openPerson,
  editGrave,
  onDeleted,
}: {
  clan: ClanSummary;
  graveId: string;
  canEdit: boolean;
  openPerson: (id: string) => void;
  editGrave: () => void;
  onDeleted: () => void;
}) {
  const rev = useRev();
  const [bump, setBump] = useState(0);
  const q = useAsync(() => getRestingPlace(graveId), [graveId, rev, bump]);
  const place = q.data;
  const photoUrl = useSignedUrls((place?.photos ?? []).map((p) => p.path));
  const avatar = usePhotoUrls([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reload = () => setBump((n) => n + 1);

  // Cải táng
  const [relOpen, setRelOpen] = useState(false);
  const [relFrom, setRelFrom] = useState("");
  const [relDate, setRelDate] = useState("");
  const [relNote, setRelNote] = useState("");
  // Nhắc tảo mộ
  const [remOpen, setRemOpen] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rDay, setRDay] = useState("");
  const [rMonth, setRMonth] = useState("");

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (q.loading && !place) return <div className="page"><div className="sk" style={{ height: 320 }} /></div>;
  if (q.error || !place) {
    return (
      <div className="center">
        <p className="error">{q.error ?? "Không tìm thấy."}</p>
        <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
      </div>
    );
  }

  const title = place.name || place.location_name || RESTING_PLACE_KIND_LABEL[place.kind];
  const dir = directionsUrl(place.latitude, place.longitude);
  const canRemind = !!rTitle.trim() && Number(rMonth) >= 1 && Number(rMonth) <= 12 && Number(rDay) >= 1 && Number(rDay) <= 30;

  const upload = async (file: File) => {
    const sort = place.photos.length;
    if (sort >= MAX_GRAVE_PHOTOS) {
      toast(`Tối đa ${MAX_GRAVE_PHOTOS} ảnh mỗi nơi an nghỉ.`, "error");
      return;
    }
    // Thư viện nén ảnh nặng — chỉ nạp khi thật sự tải ảnh lên.
    const ok = await run(async () => {
      const { uploadRestingPlacePhoto } = await import("@/lib/photoUpload");
      const { path } = await uploadRestingPlacePhoto(clan.id, graveId, file);
      await addPhoto(graveId, path, null, sort);
    }, "Đã thêm ảnh");
    if (ok) reload();
  };

  return (
    <div className="page">
      <header className="phead">
        <span className="grave-thumb lg"><IconGrave /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <span className="tiny" style={{ margin: 0 }}>{RESTING_PLACE_KIND_LABEL[place.kind]}</span>
        </span>
        {canEdit && (
          <button type="button" className="btn ghost sm" onClick={editGrave}>
            <IconPencil /> Sửa
          </button>
        )}
      </header>

      {/* Ảnh */}
      {(place.photos.length > 0 || canEdit) && (
        <section className="card pane">
          <h3 className="serif sec-row">
            Hình ảnh{place.photos.length > 0 ? ` (${place.photos.length}/${MAX_GRAVE_PHOTOS})` : ""}
            {canEdit && (
              <button type="button" className="btn ghost sm" disabled={busy || place.photos.length >= MAX_GRAVE_PHOTOS} onClick={() => fileRef.current?.click()}>
                <IconCamera /> Thêm ảnh
              </button>
            )}
          </h3>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          {place.photos.length === 0 ? (
            <div className="hintbox">Chưa có ảnh. Chụp bia mộ, toàn cảnh, lối vào để con cháu dễ tìm.</div>
          ) : (
            <div className="grave-photos">
              {place.photos.map((ph) => (
                <div key={ph.id} className="grave-photo">
                  {photoUrl(ph.path) ? <img src={photoUrl(ph.path)!} alt={ph.caption ?? ""} /> : <span className="sk" style={{ display: "block", height: "100%" }} />}
                  {canEdit && (
                    <button
                      type="button"
                      aria-label="Xoá ảnh"
                      disabled={busy}
                      onClick={() =>
                        run(() => removePhoto(ph.id, ph.path), "Đã xoá ảnh").then((ok) => {
                          if (ok) {
                            forgetPhotos([ph.path]);
                            reload();
                          }
                        })
                      }
                    >
                      <IconX />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Thông tin */}
      <section className="card pane">
        <h3 className="serif">Thông tin</h3>
        <Row label="Hình thức" value={RESTING_PLACE_KIND_LABEL[place.kind]} />
        <Row label="Cơ sở" value={place.cemetery_name} />
        <Row label="Nơi" value={place.location_name} />
        <Row label="Vị trí chi tiết" value={place.location_detail} />
        <Row label="Địa chỉ" value={place.address} />
        <Row label="Hướng" value={place.orientation} />
        <Row label="Trạng thái" value={RESTING_PLACE_STATUS_LABEL[place.status]} />
        <Row label="Năm xây" value={place.built_year ? String(place.built_year) : null} />
        <Row label="Vật liệu" value={place.material} />
        <Row label="Ghi chú" value={place.notes} />
        {dir && (
          <button type="button" className="btn ghost block" style={{ marginTop: 10 }} onClick={() => openMap(dir)}>
            <IconMapPin /> Chỉ đường
          </button>
        )}
      </section>

      {/* Người an nghỉ */}
      <section className="card pane">
        <h3 className="serif">Người an nghỉ ({place.occupants.length})</h3>
        {place.occupants.length === 0 ? (
          <div className="hintbox">Chưa gắn ai. {canEdit && "Bấm “Sửa” để gắn người trong gia phả."}</div>
        ) : (
          place.occupants.map((o) => (
            <button key={o.occupant_id} type="button" className="card relrow" onClick={() => openPerson(o.person_id)}>
              <img src={avatar(null, o.gender)} width={36} height={36} alt="" />
              <span style={{ minWidth: 0, flex: 1 }}>
                <b className="ell">{o.full_name}</b>
                {o.note && <span className="tiny" style={{ margin: 0 }}>{o.note}</span>}
              </span>
              <span className="go"><IconArrowRight /></span>
            </button>
          ))
        )}
      </section>

      {/* Lịch sử cải táng */}
      {(place.relocations.length > 0 || canEdit) && (
        <section className="card pane">
          <h3 className="serif sec-row">
            Lịch sử cải táng
            {canEdit && !relOpen && (
              <button type="button" className="btn ghost sm" onClick={() => setRelOpen(true)}><IconPlus /> Thêm</button>
            )}
          </h3>
          {place.relocations.length === 0 && !relOpen && <div className="hintbox">Chưa ghi lần cải táng nào (bốc mộ / sang cát).</div>}
          {place.relocations.map((r) => (
            <div key={r.id} className="grave-rel">
              <span style={{ minWidth: 0, flex: 1 }}>
                <b>{r.moved_on ? formatDate(r.moved_on) : "Chưa rõ ngày"}</b>
                {r.from_label && <span> · cải táng từ {r.from_label}</span>}
                {r.note && <span className="tiny" style={{ margin: 0 }}>{r.note}</span>}
              </span>
              {canEdit && (
                <button type="button" className="btn text dangertext sm" aria-label="Xoá" disabled={busy} onClick={() => run(() => removeRelocation(r.id), "Đã xoá").then((ok) => ok && reload())}>
                  <IconTrash />
                </button>
              )}
            </div>
          ))}
          {relOpen && (
            <div style={{ marginTop: 8 }}>
              <label className="lbl">Nơi cũ (trước khi dời về đây)
                <input className="field" style={{ marginTop: 4 }} value={relFrom} placeholder="vd: Nghĩa trang X, lô 3" onChange={(e) => setRelFrom(e.target.value)} />
              </label>
              <label className="lbl" style={{ display: "block", marginTop: 8 }}>Ngày cải táng (tuỳ chọn)
                <input className="field" style={{ marginTop: 4 }} type="date" value={relDate} onChange={(e) => setRelDate(e.target.value)} />
              </label>
              <label className="lbl" style={{ display: "block", marginTop: 8 }}>Ghi chú
                <input className="field" style={{ marginTop: 4 }} value={relNote} placeholder="vd: bốc mộ sang cát, người chủ trì…" onChange={(e) => setRelNote(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" className="btn neutral" style={{ flex: 1 }} onClick={() => setRelOpen(false)}>Huỷ</button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={busy || (!relFrom.trim() && !relDate && !relNote.trim())}
                  onClick={() =>
                    run(
                      () => addRelocation(graveId, { from_label: relFrom.trim() || null, moved_on: relDate || null, note: relNote.trim() || null }),
                      "Đã thêm lần cải táng",
                    ).then((ok) => {
                      if (!ok) return;
                      setRelOpen(false);
                      setRelFrom("");
                      setRelDate("");
                      setRelNote("");
                      reload();
                    })
                  }
                >
                  Lưu
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Nhắc tảo mộ / chạp họ */}
      {canEdit && (
        <section className="card pane">
          <h3 className="serif sec-row">
            Nhắc tảo mộ / chạp họ
            {!remOpen && (
              <button type="button" className="btn ghost sm" onClick={() => { setRTitle(`Tảo mộ ${title}`); setRemOpen(true); }}>
                <IconBell /> Đặt nhắc
              </button>
            )}
          </h3>
          {!remOpen ? (
            <p className="note" style={{ marginTop: 0 }}>Đặt ngày âm lịch (vd mùng 10 tháng Chạp) — cả họ theo dõi sẽ được nhắc trước hằng năm.</p>
          ) : (
            <div>
              <label className="lbl">Tên dịp
                <input className="field" style={{ marginTop: 4 }} value={rTitle} maxLength={150} onChange={(e) => setRTitle(e.target.value)} />
              </label>
              <div className="dmy" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 8 }}>
                <input className="field" inputMode="numeric" maxLength={2} placeholder="Ngày âm (1–30)" aria-label="Ngày âm" value={rDay} onChange={(e) => setRDay(e.target.value.replace(/\D/g, ""))} />
                <input className="field" inputMode="numeric" maxLength={2} placeholder="Tháng âm (1–12)" aria-label="Tháng âm" value={rMonth} onChange={(e) => setRMonth(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" className="btn neutral" style={{ flex: 1 }} onClick={() => setRemOpen(false)}>Huỷ</button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={!canRemind || busy}
                  onClick={() =>
                    run(
                      () =>
                        createEvent({
                          clan_id: clan.id,
                          title: rTitle.trim(),
                          event_type: "tomb_visit",
                          resting_place_id: graveId,
                          lunar_month: Number(rMonth),
                          lunar_day: Number(rDay),
                          is_yearly: true,
                        }).then(() => undefined),
                      "Đã đặt nhắc tảo mộ / chạp họ",
                    ).then((ok) => {
                      if (!ok) return;
                      setRemOpen(false);
                      setRDay("");
                      setRMonth("");
                    })
                  }
                >
                  Lưu nhắc
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {canEdit &&
        (confirmDelete ? (
          <section className="card pane dangerpane">
            <b style={{ display: "block", fontSize: 15 }}>Xoá nơi an nghỉ này?</b>
            <p className="note" style={{ marginTop: 4 }}>Xoá bản ghi mộ phần / tro cốt (không xoá hồ sơ người).</p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn neutral" style={{ flex: 1 }} disabled={busy} onClick={() => setConfirmDelete(false)}>Huỷ</button>
              <button type="button" className="btn danger" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => deleteRestingPlace(graveId), "Đã xoá").then((ok) => ok && onDeleted())}>
                {busy ? "Đang xoá…" : "Xoá"}
              </button>
            </div>
          </section>
        ) : (
          <button type="button" className="btn danger2 block" style={{ marginTop: 8 }} onClick={() => setConfirmDelete(true)}>
            <IconTrash /> Xoá
          </button>
        ))}
    </div>
  );
}

// ─── Thêm / sửa ────────────────────────────────────────────────────────

interface StagedOccupant {
  personId: string;
  name: string;
  gender: "M" | "F";
  occupantId: string | null;
}

export function GraveFormScreen({
  clan,
  graveId,
  onSaved,
}: {
  clan: ClanSummary;
  /** Không có = thêm mới. */
  graveId?: string;
  onSaved: (id: string, isNew: boolean) => void;
}) {
  const isEdit = !!graveId;
  const existing = useAsync(() => (graveId ? getRestingPlace(graveId) : Promise.resolve(null)), [graveId]);
  const cemeteries = useAsync(() => listCemeteries(clan.id), [clan.id]);

  const [kind, setKind] = useState<RestingPlaceKind>("grave");
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [orientation, setOrientation] = useState("");
  const [status, setStatus] = useState<RestingPlaceStatus>("existing");
  const [builtYear, setBuiltYear] = useState("");
  const [material, setMaterial] = useState("");
  const [notes, setNotes] = useState("");
  const [cemeteryId, setCemeteryId] = useState("");
  const [occupants, setOccupants] = useState<StagedOccupant[]>([]);
  const [origOccupants, setOrigOccupants] = useState<StagedOccupant[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const e = existing.data;
    if (!e) return;
    setKind(e.kind);
    setName(e.name ?? "");
    setLocationName(e.location_name ?? "");
    setLocationDetail(e.location_detail ?? "");
    setAddress(e.address ?? "");
    setLat(e.latitude != null ? String(e.latitude) : "");
    setLng(e.longitude != null ? String(e.longitude) : "");
    setOrientation(e.orientation ?? "");
    setStatus(e.status);
    setBuiltYear(e.built_year != null ? String(e.built_year) : "");
    setMaterial(e.material ?? "");
    setNotes(e.notes ?? "");
    setCemeteryId(e.cemetery_id ?? "");
    const occ = e.occupants.map((o) => ({ personId: o.person_id, name: o.full_name, gender: o.gender, occupantId: o.occupant_id }));
    setOccupants(occ);
    setOrigOccupants(occ);
  }, [existing.data]);

  const index = useAsync(() => (pickerOpen ? getKinshipIndex(clan.id) : Promise.resolve(null)), [clan.id, pickerOpen]);
  const candidates = useMemo(() => {
    if (!index.data) return [];
    const taken = new Set(occupants.map((o) => o.personId));
    return index.data.ordered.filter((p) => !taken.has(p.id) && matchesName(p.full_name, filter)).slice(0, 50);
  }, [index.data, occupants, filter]);

  if (isEdit && existing.loading) return <div className="page"><div className="sk" style={{ height: 360 }} /></div>;

  const labels = KIND_LOCATION_LABELS[kind];

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast("Máy không hỗ trợ định vị", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast("Đã lấy vị trí hiện tại");
      },
      () => toast("Không lấy được vị trí (cần cấp quyền định vị)", "error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationName.trim() && !name.trim()) {
      setError("Cần ít nhất tên hoặc nơi (nghĩa trang / chùa…).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fields = {
        kind,
        name: name.trim() || null,
        location_name: locationName.trim() || null,
        location_detail: labels.detail ? locationDetail.trim() || null : null,
        address: address.trim() || null,
        latitude: lat.trim() ? Number(lat) : null,
        longitude: lng.trim() ? Number(lng) : null,
        orientation: kind === "grave" ? orientation.trim() || null : null,
        status,
        built_year: builtYear.trim() ? Math.floor(Number(builtYear)) : null,
        material: material.trim() || null,
        notes: notes.trim() || null,
        cemetery_id: cemeteryId || null,
      };
      // Cùng trình tự với web: lưu bản ghi, rồi đối chiếu người an nghỉ.
      let id = graveId ?? "";
      if (isEdit) {
        await updateRestingPlace(id, fields);
        const staged = new Set(occupants.map((o) => o.personId));
        const orig = new Set(origOccupants.map((o) => o.personId));
        for (const o of occupants) if (!orig.has(o.personId)) await addOccupant(id, o.personId);
        for (const o of origOccupants) if (!staged.has(o.personId) && o.occupantId) await removeOccupant(o.occupantId);
      } else {
        id = (await createRestingPlace(clan.id, fields)).id;
        for (const o of occupants) await addOccupant(id, o.personId);
      }
      onSaved(id, !isEdit);
    } catch (err) {
      setError((err as Error).message);
      toast((err as Error).message, "error");
      setBusy(false);
    }
  };

  const text = (label: string, value: string, set: (v: string) => void, ph?: string, mode?: "numeric") => (
    <div className="fgroup">
      <label className="lbl">
        {label}
        <input className="field" style={{ marginTop: 4 }} value={value} placeholder={ph} inputMode={mode} onChange={(e) => set(e.target.value)} />
      </label>
    </div>
  );

  return (
    <form className="page" onSubmit={submit}>
      <section className="card pane">
        <h3 className="serif">Nơi an nghỉ</h3>
        <div className="fgroup">
          <label className="lbl">Hình thức
            <select className="field select" style={{ marginTop: 4, width: "100%" }} value={kind} onChange={(e) => setKind(e.target.value as RestingPlaceKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{RESTING_PLACE_KIND_LABEL[k]}</option>)}
            </select>
          </label>
        </div>
        <div className="fgroup">
          <label className="lbl">Trạng thái
            <select className="field select" style={{ marginTop: 4, width: "100%" }} value={status} onChange={(e) => setStatus(e.target.value as RestingPlaceStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{RESTING_PLACE_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
        {text("Tên gọi (tuỳ chọn)", name, setName, "vd: Mộ cụ Tổ, Tháp họ Cao")}
        {text(labels.name, locationName, setLocationName, labels.namePh)}
        {labels.detail && text(labels.detail, locationDetail, setLocationDetail, labels.detailPh)}
        {text("Địa chỉ", address, setAddress, ADDRESS_PLACEHOLDER)}
        <div className="fgroup">
          <label className="lbl">Cơ sở / nghĩa trang (tuỳ chọn)
            <select className="field select" style={{ marginTop: 4, width: "100%" }} value={cemeteryId} onChange={(e) => setCemeteryId(e.target.value)}>
              <option value="">— Không gắn —</option>
              {(cemeteries.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <p className="note">Danh sách cơ sở quản lý trên bản web.</p>
        </div>
      </section>

      <section className="card pane">
        <h3 className="serif sec-row">
          Toạ độ GPS
          <button type="button" className="btn ghost sm" onClick={useCurrentLocation}><IconMapPin /> Lấy vị trí hiện tại</button>
        </h3>
        <div className="dmy" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <input className="field" inputMode="decimal" placeholder="Vĩ độ" aria-label="Vĩ độ" value={lat} onChange={(e) => setLat(e.target.value)} />
          <input className="field" inputMode="decimal" placeholder="Kinh độ" aria-label="Kinh độ" value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
        <p className="note">Đứng tại mộ rồi bấm “Lấy vị trí hiện tại” để con cháu chỉ đường được.</p>
      </section>

      <section className="card pane">
        <h3 className="serif">Chi tiết</h3>
        {kind === "grave" && text("Hướng mộ (tuỳ chọn)", orientation, setOrientation, "vd: hướng Đông Nam")}
        {text("Năm xây (tuỳ chọn)", builtYear, setBuiltYear, "vd: 1990", "numeric")}
        {text("Vật liệu (tuỳ chọn)", material, setMaterial, "vd: đá xanh Thanh Hoá")}
        <div className="fgroup">
          <label className="lbl">Ghi chú
            <textarea className="field area" rows={3} style={{ marginTop: 4 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card pane">
        <h3 className="serif sec-row">
          Người an nghỉ ({occupants.length})
          {!pickerOpen && <button type="button" className="btn ghost sm" onClick={() => setPickerOpen(true)}><IconPlus /> Gắn người</button>}
        </h3>
        {occupants.length === 0 && !pickerOpen && <div className="hintbox">Chưa gắn ai.</div>}
        {occupants.map((o) => (
          <div key={o.personId} className="grave-rel">
            <b style={{ flex: 1, minWidth: 0 }} className="ell">{o.name}</b>
            <button type="button" className="btn text dangertext sm" aria-label={`Bỏ ${o.name}`} onClick={() => setOccupants((list) => list.filter((x) => x.personId !== o.personId))}>
              <IconX />
            </button>
          </div>
        ))}
        {pickerOpen && (
          <div style={{ marginTop: 8 }}>
            <input className="field" type="search" placeholder="Tìm theo tên — gõ không dấu cũng được" aria-label="Tìm người" value={filter} onChange={(e) => setFilter(e.target.value)} />
            {index.loading && <div className="sk" style={{ height: 120, marginTop: 8 }} />}
            <div className="picklist">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="card relrow"
                  onClick={() => setOccupants((list) => [...list, { personId: p.id, name: p.full_name, gender: p.gender, occupantId: null }])}
                >
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <b className="ell">{p.full_name}</b>
                    <span className="tiny" style={{ margin: 0 }}>{p.gender === "M" ? "Nam" : "Nữ"}{p.birth_year ? ` · sinh ${p.birth_year}` : ""}</span>
                  </span>
                  <span className="go"><IconPlus /></span>
                </button>
              ))}
            </div>
            <button type="button" className="btn text block" onClick={() => setPickerOpen(false)}>Xong</button>
          </div>
        )}
      </section>

      <div className="cta">
        {error && <p className="error" style={{ margin: "0 0 8px" }}>{error}</p>}
        <button type="submit" className="btn block" disabled={busy}>{busy ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Thêm nơi an nghỉ"}</button>
      </div>
    </form>
  );
}
