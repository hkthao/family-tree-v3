import { useEffect, useState, type FormEvent } from "react";

import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  loadCalendarDateValue,
  type CalendarDateValue,
} from "@/lib/personDates";
import { getPerson, updatePerson } from "@/lib/queries/persons";

import { toast } from "../toast";
import { useAsync } from "../useAsync";

/**
 * Sửa thông tin cơ bản của một người.
 *
 * Phần GHI dữ liệu dùng nguyên của web: `updatePerson`, và đặc biệt là
 * `buildPersonDateColumns` + `buildDeathAnniversary` — hai hàm này quy đổi
 * dương ↔ âm và tính ngày giỗ. Tự viết lại chỗ đó mà lệch một ngày là có
 * nhà cúng giỗ sai ngày.
 *
 * Chỉ sửa các trường cơ bản. Những trường web có mà ở đây KHÔNG có (ảnh,
 * thứ tự con, tuổi thọ ghi tay, Thuỷ tổ, chi…) không nằm trong lệnh cập
 * nhật nên giữ nguyên giá trị cũ, không bị xoá mất.
 */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CalendarDateValue;
  onChange: (v: CalendarDateValue) => void;
}) {
  const part = (k: "day" | "month" | "year") => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, parts: { ...value.parts, [k]: e.target.value.replace(/\D/g, "") } });
  return (
    <div className="fgroup">
      <div className="frow">
        <span className="lbl" style={{ margin: 0 }}>{label}</span>
        <div className="seg" style={{ margin: 0 }} role="group" aria-label={`Loại lịch của ${label}`}>
          <button type="button" aria-pressed={value.mode === "solar"} onClick={() => onChange({ ...value, mode: "solar", isLeap: false })}>Dương</button>
          <button type="button" aria-pressed={value.mode === "lunar"} onClick={() => onChange({ ...value, mode: "lunar" })}>Âm</button>
        </div>
      </div>
      <div className="dmy">
        <input className="field" inputMode="numeric" maxLength={2} placeholder="Ngày" aria-label={`${label}: ngày`} value={value.parts.day} onChange={part("day")} />
        <input className="field" inputMode="numeric" maxLength={2} placeholder="Tháng" aria-label={`${label}: tháng`} value={value.parts.month} onChange={part("month")} />
        <input className="field" inputMode="numeric" maxLength={4} placeholder="Năm" aria-label={`${label}: năm`} value={value.parts.year} onChange={part("year")} />
      </div>
      {value.mode === "lunar" && (
        <label className="check" style={{ marginTop: 6, fontSize: 14 }}>
          <input type="checkbox" checked={value.isLeap} onChange={(e) => onChange({ ...value, isLeap: e.target.checked })} />
          <span>Tháng nhuận</span>
        </label>
      )}
      <p className="note" style={{ marginTop: 4 }}>
        Không nhớ đủ thì để trống ngày, hoặc cả ngày và tháng.
        {value.mode === "lunar" && " Ngày giỗ có thể chỉ ghi ngày và tháng âm."}
      </p>
    </div>
  );
}

export function EditPersonScreen({
  personId,
  onSaved,
}: {
  personId: string;
  onSaved: () => void;
}) {
  const q = useAsync(() => getPerson(personId), [personId]);
  const person = q.data;

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isLiving, setIsLiving] = useState(true);
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [death, setDeath] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [courtesy, setCourtesy] = useState("");
  const [nickname, setNickname] = useState("");
  const [posthumous, setPosthumous] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [burialPlace, setBurialPlace] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!person) return;
    setFullName(person.full_name);
    setGender(person.gender);
    setIsLiving(person.is_living);
    setBirth(
      loadCalendarDateValue({
        solarDate: person.birth_date,
        solarPrecision: person.birth_date_precision,
        lunarYear: person.birth_lunar_year,
        lunarMonth: person.birth_lunar_month,
        lunarDay: person.birth_lunar_day,
      }),
    );
    setDeath(
      loadCalendarDateValue(
        {
          solarDate: person.death_date,
          solarPrecision: person.death_date_precision,
          lunarYear: person.death_lunar_year,
          lunarMonth: person.death_lunar_month,
          lunarDay: person.death_lunar_day,
        },
        // Ưu tiên âm lịch cho ngày mất: giỗ thường chỉ nhớ ngày/tháng âm.
        true,
      ),
    );
    setCourtesy(person.courtesy_name ?? "");
    setNickname(person.nickname ?? "");
    setPosthumous(person.posthumous_name ?? "");
    setBirthPlace(person.birth_place ?? "");
    setBurialPlace(person.burial_place ?? "");
    setBio(person.bio ?? "");
  }, [person]);

  if (q.loading) return <div className="page"><div className="sk" style={{ height: 360 }} /></div>;
  if (q.error || !person) {
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
      // Người còn sống thì không có ngày mất / ngày giỗ.
      const deathValue = isLiving ? EMPTY_CALENDAR_DATE : death;
      const b = buildPersonDateColumns(birth);
      const d = buildPersonDateColumns(deathValue);
      const anniv = buildDeathAnniversary(deathValue);
      await updatePerson(personId, {
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
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
        courtesy_name: courtesy.trim() || null,
        nickname: nickname.trim() || null,
        posthumous_name: posthumous.trim() || null,
        birth_place: birthPlace.trim() || null,
        burial_place: burialPlace.trim() || null,
        bio: bio.trim() ? bio : null,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      toast((err as Error).message, "error");
      setBusy(false);
    }
  };

  const text = (label: string, value: string, set: (v: string) => void, extra?: { placeholder?: string }) => (
    <div className="fgroup">
      <label className="lbl">
        {label}
        <input className="field" style={{ marginTop: 4 }} value={value} placeholder={extra?.placeholder} onChange={(e) => set(e.target.value)} />
      </label>
    </div>
  );

  return (
    <form className="page" onSubmit={submit}>
      <section className="card pane">
        <h3 className="serif">Thông tin chính</h3>
        {text("Họ tên", fullName, setFullName)}
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
      </section>

      <section className="card pane">
        <h3 className="serif">Ngày sinh{!isLiving && " và ngày mất"}</h3>
        <DateField label="Ngày sinh" value={birth} onChange={setBirth} />
        {!isLiving && <DateField label="Ngày mất" value={death} onChange={setDeath} />}
      </section>

      <section className="card pane">
        <h3 className="serif">Tên khác và nơi chốn</h3>
        {text("Tên tự", courtesy, setCourtesy)}
        {text("Tên húy", nickname, setNickname)}
        {text("Tên thụy", posthumous, setPosthumous)}
        {text("Nơi sinh", birthPlace, setBirthPlace)}
        {!isLiving && text("Nơi an táng", burialPlace, setBurialPlace)}
      </section>

      <section className="card pane">
        <h3 className="serif">Tiểu sử</h3>
        <textarea className="field area" rows={6} aria-label="Tiểu sử" value={bio} onChange={(e) => setBio(e.target.value)} />
      </section>

      <div className="cta">
        {error && <p className="error" style={{ margin: "0 0 8px" }}>{error}</p>}
        <button type="submit" className="btn block" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button>
      </div>
    </form>
  );
}
