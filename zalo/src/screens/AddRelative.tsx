import { useEffect, useState, type FormEvent } from "react";

import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  EMPTY_LUNAR_CALENDAR_DATE,
  type CalendarDateValue,
} from "@/lib/personDates";
import {
  addChildToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { createPerson, getPerson } from "@/lib/queries/persons";

import { toast } from "../toast";
import { useAsync } from "../useAsync";
import { DateField } from "./EditPerson";

/**
 * Thêm vợ/chồng hoặc con cho một người.
 *
 * Ghi dữ liệu bằng đúng các hàm của web (`createPerson`,
 * `findOrCreateFamily`, `addChildToFamily`) và theo đúng trình tự của web:
 *   • vợ/chồng: tạo người → tạo (hoặc dùng lại) gia đình của hai người;
 *   • con: chọn cha/mẹ còn lại → tìm (hoặc tạo) gia đình đó → thêm con vào.
 * Gia phả Việt hay thiếu tên vợ, nên "cha/mẹ còn lại" có lựa chọn "Chưa ghi"
 * — con vẫn thêm được dưới một mình người này.
 *
 * Chưa có ở đây so với web: gắn một người ĐÃ CÓ trong họ làm vợ/chồng/con
 * (chỉ tạo người mới), và thêm nhiều con một lượt.
 */
const SOLO = "__solo__";

export function AddRelativeScreen({
  clanId,
  personId,
  relation,
  onSaved,
}: {
  clanId: string;
  personId: string;
  relation: "spouse" | "child";
  onSaved: () => void;
}) {
  const q = useAsync(async () => {
    const [focal, rels] = await Promise.all([getPerson(personId), getPersonRelationships(personId)]);
    return { focal, rels };
  }, [personId]);
  const focal = q.data?.focal;
  const spouses = q.data?.rels.spouses ?? [];

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isLiving, setIsLiving] = useState(true);
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [death, setDeath] = useState<CalendarDateValue>(EMPTY_LUNAR_CALENDAR_DATE);
  const [otherParent, setOtherParent] = useState(SOLO);
  const [birthOrder, setBirthOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mặc định hợp lý theo người gốc: vợ/chồng thì khác giới; con thì gắn
  // sẵn với người vợ/chồng đầu tiên (ca phổ biến nhất).
  useEffect(() => {
    if (!focal) return;
    if (relation === "spouse") setGender(focal.gender === "M" ? "F" : "M");
    else if (spouses[0]) setOtherParent(spouses[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focal?.id]);

  if (q.loading) return <div className="page"><div className="sk" style={{ height: 320 }} /></div>;
  if (q.error || !focal) {
    return (
      <div className="center">
        <p className="error">{q.error ?? "Không tìm thấy người này."}</p>
        <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Họ tên không được để trống.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
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

      if (relation === "spouse") {
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
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      toast((err as Error).message, "error");
      setBusy(false);
    }
  };

  const otherLabel = focal.gender === "M" ? "Mẹ" : "Cha";

  return (
    <form className="page" onSubmit={submit}>
      <p className="crumb">
        {relation === "spouse" ? (focal.gender === "M" ? "Vợ" : "Chồng") : "Con"} của <b>{focal.full_name}</b>
      </p>

      <section className="card pane">
        <h3 className="serif">Thông tin chính</h3>
        <div className="fgroup">
          <label className="lbl">
            Họ tên
            <input className="field" style={{ marginTop: 4 }} value={fullName} autoFocus onChange={(e) => setFullName(e.target.value)} />
          </label>
        </div>
        <div className="fgroup frow">
          <span className="lbl" style={{ margin: 0 }}>Giới tính</span>
          <div className="seg" style={{ margin: 0 }} role="group" aria-label="Giới tính">
            <button type="button" aria-pressed={gender === "M"} onClick={() => setGender("M")}>Nam</button>
            <button type="button" aria-pressed={gender === "F"} onClick={() => setGender("F")}>Nữ</button>
          </div>
        </div>
        <label className="fgroup frow">
          <span className="lbl" style={{ margin: 0 }}>Còn sống</span>
          <input type="checkbox" role="switch" className="switch" checked={isLiving} onChange={(e) => setIsLiving(e.target.checked)} />
        </label>

        {relation === "child" && (
          <>
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
            <div className="fgroup">
              <label className="lbl">
                Con thứ mấy (không bắt buộc)
                <input className="field" style={{ marginTop: 4 }} inputMode="numeric" maxLength={2} placeholder="1 = con cả" value={birthOrder} onChange={(e) => setBirthOrder(e.target.value.replace(/\D/g, ""))} />
              </label>
            </div>
          </>
        )}
      </section>

      <section className="card pane">
        <h3 className="serif">Ngày sinh{!isLiving && " và ngày mất"}</h3>
        <DateField label="Ngày sinh" value={birth} onChange={setBirth} />
        {!isLiving && <DateField label="Ngày mất" value={death} onChange={setDeath} />}
      </section>

      <div className="cta">
        {error && <p className="error" style={{ margin: "0 0 8px" }}>{error}</p>}
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? "Đang lưu…" : relation === "spouse" ? "Thêm vợ/chồng" : "Thêm con"}
        </button>
      </div>
    </form>
  );
}
