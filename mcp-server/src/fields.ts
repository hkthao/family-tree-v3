/**
 * Trường của một người — MỘT nguồn cho cả schema tool (specs.ts) lẫn kiểm tra đầu vào.
 * Thuần hàm, không import gì (test được độc lập).
 *
 * Khác proposals.ts (chỉ các cột `apply_contribution` hiểu): đây là bộ trường cho tool GHI THẲNG,
 * bám các cột của bảng `persons` mà form sửa người trong app cho sửa.
 */

export class UserError extends Error {}

/** Thao tác nguy hiểm / công khai: bắt buộc confirm=true và lý do (ghi vào nhật ký admin). Trả lý do đã làm sạch. */
export function requireConfirm(a: Record<string, unknown>): string {
  if (a.confirm !== true) throw new UserError("Thao tác này cần confirm=true — chỉ đặt sau khi người dùng đã yêu cầu rõ ràng đúng việc này.");
  const reason = typeof a.reason === "string" ? a.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) throw new UserError("Cần reason (5–500 ký tự) giải thích vì sao làm việc này.");
  return reason;
}

type Kind = "text" | "bool" | "int" | "date" | "gender" | "uuid";

interface FieldDef {
  kind: Kind;
  /** text: độ dài tối đa · int: [min, max] */
  max?: number;
  range?: [number, number];
  /** Cho phép null = xoá trống. */
  nullable: boolean;
  description: string;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (description: string, max = 300): FieldDef => ({ kind: "text", max, nullable: true, description });
const int = (description: string, min: number, max: number): FieldDef => ({
  kind: "int",
  range: [min, max],
  nullable: true,
  description,
});
const lunarMonth = (d: string) => int(d, 1, 12);
const lunarDay = (d: string) => int(d, 1, 30);
const lunarYear = (d: string) => int(d, 1, 2100);
const bool = (description: string): FieldDef => ({ kind: "bool", nullable: false, description });

export const PERSON_FIELDS: Record<string, FieldDef> = {
  full_name: { kind: "text", max: 200, nullable: false, description: "Họ và tên đầy đủ" },
  gender: { kind: "gender", nullable: false, description: "M = nam, F = nữ" },
  is_living: bool("Còn sống (true) hay đã mất (false)"),
  courtesy_name: text("Tên tự", 200),
  posthumous_name: text("Tên thụy / tên huý", 200),
  nickname: text("Tên thường gọi / biệt danh", 200),
  birth_date: { kind: "date", nullable: true, description: "Ngày sinh dương lịch: YYYY-MM-DD, hoặc chỉ YYYY-MM / YYYY nếu không rõ ngày" },
  death_date: { kind: "date", nullable: true, description: "Ngày mất dương lịch: YYYY-MM-DD, hoặc YYYY-MM / YYYY" },
  birth_lunar_year: lunarYear("Năm sinh âm lịch"),
  birth_lunar_month: lunarMonth("Tháng sinh âm lịch (1-12)"),
  birth_lunar_day: lunarDay("Ngày sinh âm lịch (1-30)"),
  birth_lunar_is_leap: bool("Tháng sinh âm lịch là tháng nhuận"),
  death_lunar_year: lunarYear("Năm mất âm lịch"),
  death_lunar_month: lunarMonth("Tháng mất âm lịch (1-12)"),
  death_lunar_day: lunarDay("Ngày mất âm lịch (1-30)"),
  death_lunar_is_leap: bool("Tháng mất âm lịch là tháng nhuận"),
  death_anniv_lunar_month: lunarMonth("Tháng giỗ hằng năm (âm lịch, 1-12)"),
  death_anniv_lunar_day: lunarDay("Ngày giỗ hằng năm (âm lịch, 1-30)"),
  death_anniv_lunar_is_leap: bool("Giỗ rơi vào tháng nhuận"),
  birth_place: text("Nơi sinh"),
  burial_place: text("Nơi an táng"),
  bio: text("Tiểu sử / ghi chú dài", 20000),
  birth_order: int("Con thứ mấy trong gia đình (1 = con cả)", 1, 99),
  lifespan_years: int("Hưởng thọ (tuổi), chỉ cho người đã mất", 0, 150),
  branch_id: { kind: "uuid", nullable: true, description: "Id chi/nhánh (từ list_branches); null = bỏ khỏi chi" },
};

const jsonType = (d: FieldDef): Record<string, unknown> => {
  const base: Record<string, unknown> = { description: d.description };
  const t = d.kind === "bool" ? "boolean" : d.kind === "int" ? "integer" : "string";
  base.type = d.nullable ? [t, "null"] : t;
  if (d.kind === "gender") base.enum = ["M", "F"];
  if (d.kind === "int" && d.range) {
    base.minimum = d.range[0];
    base.maximum = d.range[1];
  }
  if (d.kind === "text" && d.max) base.maxLength = d.max;
  return base;
};

/** JSON Schema `properties` của các trường người; `only` giới hạn tập con. */
export function personProperties(only?: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, d] of Object.entries(PERSON_FIELDS)) if (!only || only.includes(k)) out[k] = jsonType(d);
  return out;
}

/** "1990" | "1990-05" | "1990-05-06" → ngày + độ chính xác; sai → UserError. */
export function parseFlexDate(v: unknown, field: string): { date: string; precision: "day" | "month" | "year" } {
  const s = typeof v === "string" ? v.trim() : "";
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(s);
  if (!m) throw new UserError(`${field} phải dạng YYYY-MM-DD (hoặc YYYY-MM / YYYY).`);
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : 1;
  const d = m[3] ? Number(m[3]) : 1;
  const iso = `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const back = new Date(`${iso}T00:00:00Z`);
  if (y < 1 || y >= 2100 || Number.isNaN(back.getTime()) || back.toISOString().slice(0, 10) !== iso) {
    throw new UserError(`${field} không phải ngày hợp lệ.`);
  }
  return { date: iso, precision: m[3] ? "day" : m[2] ? "month" : "year" };
}

/**
 * Chuẩn hoá các trường người → payload cột DB. Không tin đầu vào: chỉ nhận trường trong PERSON_FIELDS,
 * đúng kiểu/khoảng, trường nào null thì (nếu cho phép) xoá trống. `branch_id` chỉ kiểm dạng UUID ở đây —
 * thuộc đúng dòng họ hay không do nơi gọi kiểm (cần truy vấn).
 */
export function normalizePerson(input: unknown, opts: { requireNameAndGender?: boolean } = {}): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new UserError("Dữ liệu phải là một object.");
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const def = PERSON_FIELDS[k];
    if (!def) throw new UserError(`Trường "${k}" không được phép. Cho phép: ${Object.keys(PERSON_FIELDS).join(", ")}.`);
    if (v === null) {
      if (!def.nullable) throw new UserError(`${k} không được để trống.`);
      out[k] = null;
      if (def.kind === "date") out[`${k}_precision`] = null;
      continue;
    }
    switch (def.kind) {
      case "text": {
        if (typeof v !== "string") throw new UserError(`${k} phải là chuỗi.`);
        const t = v.trim();
        if (!t && !def.nullable) throw new UserError(`${k} không được để trống.`);
        if (t.length > (def.max ?? 300)) throw new UserError(`${k} quá dài (tối đa ${def.max}).`);
        out[k] = t === "" ? null : t;
        break;
      }
      case "bool":
        if (typeof v !== "boolean") throw new UserError(`${k} phải là true/false.`);
        out[k] = v;
        break;
      case "int": {
        const [lo, hi] = def.range!;
        if (!Number.isInteger(v) || (v as number) < lo || (v as number) > hi) throw new UserError(`${k} phải là số nguyên từ ${lo} đến ${hi}.`);
        out[k] = v;
        break;
      }
      case "gender":
        if (v !== "M" && v !== "F") throw new UserError("gender phải là M hoặc F.");
        out[k] = v;
        break;
      case "uuid":
        if (typeof v !== "string" || !UUID_RE.test(v)) throw new UserError(`${k} phải là id (UUID).`);
        out[k] = v;
        break;
      case "date": {
        const p = parseFlexDate(v, k);
        out[k] = p.date;
        out[`${k}_precision`] = p.precision;
        break;
      }
    }
  }
  if (opts.requireNameAndGender) {
    if (!out.full_name) throw new UserError("full_name là bắt buộc.");
    if (!out.gender) throw new UserError("gender là bắt buộc (M hoặc F).");
  }
  if (typeof out.birth_date === "string" && typeof out.death_date === "string" && out.birth_date > out.death_date) {
    throw new UserError("Ngày sinh muộn hơn ngày mất.");
  }
  if (Object.keys(out).length === 0) throw new UserError("Không có trường nào để ghi.");
  return out;
}
