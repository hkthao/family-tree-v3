import { useEffect, useMemo, useState, type FormEvent } from "react";

import { IconCheck } from "@/components/icons";
import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  EMPTY_LUNAR_CALENDAR_DATE,
  type CalendarDateValue,
} from "@/lib/personDates";
import {
  addChildToFamily,
  assignExistingParent,
  assignExistingSpouse,
  assignPersonToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { getKinshipIndex } from "@/lib/queries/kinship";
import { createPerson, getPerson, updatePerson } from "@/lib/queries/persons";
import { matchesName } from "@/lib/unaccent";

import { toast } from "../toast";
import { useAsync } from "../useAsync";
import { DateField } from "./EditPerson";

export type Relation = "parent" | "spouse" | "child";

/**
 * Thêm cha/mẹ, vợ/chồng hoặc con cho một người — CÙNG CHỨC NĂNG với ba
 * trang AddParent / AddSpouse / AddChild của web: tạo người mới, hoặc gắn
 * một người ĐÃ CÓ trong họ.
 *
 * Ghi dữ liệu bằng đúng các hàm của web và theo đúng trình tự của web:
 *   • cha/mẹ mới: tạo người → tìm/tạo gia đình (ghép với cha/mẹ còn lại
 *     nếu đã có) → trỏ birth_family_id của người gốc vào đó;
 *   • vợ/chồng mới: tạo người → tìm/tạo gia đình của hai người;
 *   • con mới: chọn cha/mẹ còn lại → tìm/tạo gia đình → thêm con vào;
 *   • người đã có: assignExistingParent / assignExistingSpouse /
 *     assignPersonToFamily — máy chủ chặn vòng lặp (con cháu thành cha mẹ…).
 * Danh sách ứng viên lọc y như web.
 */
const SOLO = "__solo__";
/** Hiện tối đa từng này ứng viên; còn lại thì gõ tên để lọc. */
const LIST_CAP = 50;

const TITLES: Record<Relation, string> = {
  parent: "Thêm cha / mẹ",
  spouse: "Thêm vợ / chồng",
  child: "Thêm con",
};
export const relationTitle = (r: Relation) => TITLES[r];

export function AddRelativeScreen({
  clanId,
  personId,
  relation,
  onSaved,
}: {
  clanId: string;
  personId: string;
  relation: Relation;
  onSaved: (msg: string) => void;
}) {
  const q = useAsync(async () => {
    const [focal, rels] = await Promise.all([getPerson(personId), getPersonRelationships(personId)]);
    return { focal, rels };
  }, [personId]);
  const focal = q.data?.focal;
  const rels = q.data?.rels;
  const spouses = rels?.spouses ?? [];
  const parents = rels?.parents ?? [];
  const hasFather = parents.some((p) => p.gender === "M");
  const hasMother = parents.some((p) => p.gender === "F");

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isLiving, setIsLiving] = useState(true);
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [death, setDeath] = useState<CalendarDateValue>(EMPTY_LUNAR_CALENDAR_DATE);
  const [otherParent, setOtherParent] = useState(SOLO);
  const [birthOrder, setBirthOrder] = useState("");
  const [filter, setFilter] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mặc định hợp lý theo người gốc: cha/mẹ thì vai còn trống (thiếu cha
  // thì cha); vợ/chồng thì khác giới; con thì gắn sẵn với vợ/chồng đầu tiên.
  useEffect(() => {
    if (!focal || !rels) return;
    if (relation === "parent") setGender(!hasFather ? "M" : !hasMother ? "F" : "M");
    else if (relation === "spouse") setGender(focal.gender === "M" ? "F" : "M");
    else if (spouses[0]) setOtherParent(spouses[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focal?.id, rels]);

  // Danh sách người trong họ chỉ tải khi chuyển sang "Chọn người đã có".
  const index = useAsync(
    () => (mode === "existing" ? getKinshipIndex(clanId) : Promise.resolve(null)),
    [clanId, mode],
  );

  const { shown, total } = useMemo(() => {
    const all = index.data?.ordered ?? [];
    if (!focal) return { shown: [], total: 0 };
    // Lọc y như web: vợ/chồng thì khác giới; con và cha/mẹ thì bỏ người
    // đã là vợ/chồng (và cha/mẹ hiện có, với ca thêm cha/mẹ).
    const excluded = new Set<string>([focal.id]);
    if (relation !== "spouse") for (const s of spouses) excluded.add(s.id);
    if (relation === "parent") for (const p of parents) excluded.add(p.id);
    const opposite = focal.gender === "M" ? "F" : "M";
    const matched = all
      .filter((p) => !excluded.has(p.id))
      .filter((p) => relation !== "spouse" || p.gender === opposite)
      .filter((p) => matchesName(p.full_name, filter));
    return { shown: matched.slice(0, LIST_CAP), total: matched.length };
  }, [index.data, focal, relation, spouses, parents, filter]);

  if (q.loading) return <div className="page"><div className="sk" style={{ height: 320 }} /></div>;
  if (q.error || !focal) {
    return (
      <div className="center">
        <p className="error">{q.error ?? "Không tìm thấy người này."}</p>
        <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
      </div>
    );
  }

  const otherLabel = focal.gender === "M" ? "Mẹ" : "Cha";
  const pickedName = () => index.data?.byId.get(pickedId ?? "")?.full_name ?? "người đã chọn";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "new" && !fullName.trim()) {
      setError("Họ tên không được để trống.");
      return;
    }
    if (mode === "existing" && !pickedId) {
      setError("Chọn một người trong danh sách để gắn.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "existing") {
        const id = pickedId!;
        if (relation === "parent") await assignExistingParent(focal.id, id);
        else if (relation === "spouse") await assignExistingSpouse(focal.id, id);
        else {
          const sp = otherParent === SOLO ? undefined : spouses.find((s) => s.id === otherParent);
          const family = await findOrCreateFamily({
            clanId,
            partnerA: { id: focal.id, gender: focal.gender },
            partnerB: sp ? { id: sp.id, gender: sp.gender } : null,
          });
          await assignPersonToFamily(id, family.id);
        }
        const what = relation === "parent" ? "cha/mẹ" : relation === "spouse" ? "vợ/chồng" : "con";
        onSaved(`Đã gắn ${pickedName()} làm ${what}`);
        return;
      }

      const deathValue = isLiving ? EMPTY_CALENDAR_DATE : death;
      const b = buildPersonDateColumns(birth);
      const d = buildPersonDateColumns(deathValue);
      const anniv = buildDeathAnniversary(deathValue);
      const dates = {
        birth_date: b.solar_date,
        birth_date_precision: b.solar_precision,
        birth_lunar_year: b.lunar_year,
        birth_lunar_month: b.lunar_month,
        birth_lunar_day: b.lunar_day,
        birth_lunar_is_leap: b.lunar_is_leap,
        death_date: d.solar_date,
        death_date_precision: d.solar_precision,
        death_lunar_year: d.lunar_year,
        death_lunar_month: d.lunar_month,
        death_lunar_day: d.lunar_day,
        death_lunar_is_leap: d.lunar_is_leap,
        death_anniv_lunar_month: anniv.death_anniv_lunar_month,
        death_anniv_lunar_day: anniv.death_anniv_lunar_day,
        death_anniv_lunar_is_leap: anniv.death_anniv_lunar_is_leap,
      };

      if (relation === "parent") {
        const parent = await createPerson({
          clan_id: clanId,
          full_name: fullName.trim(),
          gender,
          is_living: isLiving,
          ...dates,
        });
        const other = parents.find((p) => p.gender !== gender);
        const family = await findOrCreateFamily({
          clanId,
          partnerA: { id: parent.id, gender },
          partnerB: other ? { id: other.id, gender: other.gender } : null,
        });
        await updatePerson(focal.id, { birth_family_id: family.id });
        onSaved("Đã thêm cha/mẹ");
      } else if (relation === "spouse") {
        const spouse = await createPerson({
          clan_id: clanId,
          full_name: fullName.trim(),
          gender,
          is_living: isLiving,
          ...dates,
        });
        await findOrCreateFamily({
          clanId,
          partnerA: { id: focal.id, gender: focal.gender },
          partnerB: { id: spouse.id, gender },
        });
        onSaved("Đã thêm vợ/chồng");
      } else {
        const sp = otherParent === SOLO ? undefined : spouses.find((s) => s.id === otherParent);
        const family = await findOrCreateFamily({
          clanId,
          partnerA: { id: focal.id, gender: focal.gender },
          partnerB: sp ? { id: sp.id, gender: sp.gender } : null,
        });
        await addChildToFamily({
          clanId,
          family_id: family.id,
          full_name: fullName.trim(),
          gender,
          is_living: isLiving,
          birth_order: birthOrder.trim() ? Math.max(1, Math.floor(Number(birthOrder))) : null,
          ...dates,
        });
        onSaved("Đã thêm con");
      }
    } catch (err) {
      setError((err as Error).message);
      toast((err as Error).message, "error");
      setBusy(false);
    }
  };

  const relLabel =
    relation === "parent" ? "Cha / mẹ" : relation === "spouse" ? (focal.gender === "M" ? "Vợ" : "Chồng") : "Con";

  // Chọn cha/mẹ còn lại của người con — dùng cho cả người mới lẫn người đã có.
  const otherParentField = relation === "child" && (
    <div className="fgroup">
      <label className="lbl">
        {otherLabel} của người con này
        <select className="field select" style={{ marginTop: 4, width: "100%" }} value={otherParent} onChange={(e) => setOtherParent(e.target.value)}>
          {spouses.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          <option value={SOLO}>Chưa ghi {otherLabel.toLowerCase()}</option>
        </select>
      </label>
      {spouses.length === 0 && (
        <p className="note">
          {focal.full_name} chưa có vợ/chồng trong gia phả. Có thể thêm con trước, ghi {otherLabel.toLowerCase()} sau.
        </p>
      )}
    </div>
  );

  return (
    <form className="page" onSubmit={submit}>
      <p className="crumb">
        {relLabel} của <b>{focal.full_name}</b>
      </p>

      <div className="seg full" role="group" aria-label="Cách thêm">
        <button type="button" aria-pressed={mode === "new"} onClick={() => { setMode("new"); setError(null); }}>Người mới</button>
        <button type="button" aria-pressed={mode === "existing"} onClick={() => { setMode("existing"); setError(null); }}>Chọn người đã có</button>
      </div>

      {mode === "existing" ? (
        <section className="card pane">
          {otherParentField}
          <input
            className="field"
            type="search"
            placeholder="Tìm theo tên — gõ không dấu cũng được"
            aria-label="Tìm người trong họ"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {index.loading && <div className="sk" style={{ height: 160, marginTop: 10 }} />}
          {index.error && <p className="error">{index.error}</p>}
          {!index.loading && shown.length === 0 && (
            <div className="hintbox" style={{ marginTop: 10 }}>Không có ai phù hợp.</div>
          )}
          <div className="picklist">
            {shown.map((p) => (
              <button
                key={p.id}
                type="button"
                className="card relrow"
                aria-pressed={pickedId === p.id}
                onClick={() => setPickedId(p.id)}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b className="ell">{p.full_name}</b>
                  <span className="tiny" style={{ margin: 0 }}>
                    {p.gender === "M" ? "Nam" : "Nữ"}{p.birth_year ? ` · sinh ${p.birth_year}` : ""}
                  </span>
                </span>
                {pickedId === p.id && <span className="go"><IconCheck /></span>}
              </button>
            ))}
          </div>
          {total > shown.length && (
            <p className="note">Còn {total - shown.length} người nữa — gõ tên để lọc.</p>
          )}
        </section>
      ) : (
        <>
          <section className="card pane">
            <h3 className="serif">Thông tin chính</h3>
            <div className="fgroup">
              <label className="lbl">
                Họ tên
                <input className="field" style={{ marginTop: 4 }} value={fullName} autoFocus onChange={(e) => setFullName(e.target.value)} />
              </label>
            </div>
            <div className="fgroup frow">
              <span className="lbl" style={{ margin: 0 }}>{relation === "parent" ? "Là" : "Giới tính"}</span>
              <div className="seg" style={{ margin: 0 }} role="group" aria-label="Giới tính">
                <button type="button" aria-pressed={gender === "M"} onClick={() => setGender("M")}>{relation === "parent" ? "Cha" : "Nam"}</button>
                <button type="button" aria-pressed={gender === "F"} onClick={() => setGender("F")}>{relation === "parent" ? "Mẹ" : "Nữ"}</button>
              </div>
            </div>
            {relation === "parent" && (gender === "M" ? hasFather : hasMother) && (
              <p className="note" style={{ marginTop: 0 }}>
                {focal.full_name} đã có {gender === "M" ? "cha" : "mẹ"} trong gia phả.
              </p>
            )}
            <label className="fgroup frow">
              <span className="lbl" style={{ margin: 0 }}>Còn sống</span>
              <input type="checkbox" role="switch" className="switch" checked={isLiving} onChange={(e) => setIsLiving(e.target.checked)} />
            </label>

            {otherParentField}
            {relation === "child" && (
              <div className="fgroup">
                <label className="lbl">
                  Con thứ mấy (không bắt buộc)
                  <input className="field" style={{ marginTop: 4 }} inputMode="numeric" maxLength={2} placeholder="1 = con cả" value={birthOrder} onChange={(e) => setBirthOrder(e.target.value.replace(/\D/g, ""))} />
                </label>
              </div>
            )}
          </section>

          <section className="card pane">
            <h3 className="serif">Ngày sinh{!isLiving && " và ngày mất"}</h3>
            <DateField label="Ngày sinh" value={birth} onChange={setBirth} />
            {!isLiving && <DateField label="Ngày mất" value={death} onChange={setDeath} />}
          </section>
        </>
      )}

      <div className="cta">
        {error && <p className="error" style={{ margin: "0 0 8px" }}>{error}</p>}
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? "Đang lưu…" : mode === "existing" ? "Gắn người đã chọn" : relationTitle(relation)}
        </button>
      </div>
    </form>
  );
}
