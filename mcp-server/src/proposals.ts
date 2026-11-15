/**
 * Kiểm lại đề xuất do AI bên ngoài gửi — thuần hàm, không import gì (test được độc lập).
 *
 * Không tin đầu vào: AI có thể bịa, hoặc bị một trường `bio` độc hại xui. Mọi đề xuất chỉ
 * đi vào hàng chờ `contributions`; admin nhìn rồi mới duyệt. Kiểm ở đây để (1) lỗi báo
 * ngay cho AI tự sửa, (2) không để payload hỏng làm `apply_contribution` nổ lúc duyệt
 * (nó ép kiểu ::date, ::int trong SQL).
 */

import { EDITABLE_FIELDS } from "./specs.ts";

export const MAX_TEXT = 4000;
export const MAX_NAME = 100;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
  const y = Number(s.slice(0, 4));
  return y >= 1 && y < 2100;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;

/** Chuẩn hoá `changes` của edit_person; chỉ giữ trường được phép. */
export function validateChanges(raw: unknown): Result<Record<string, unknown>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("`changes` phải là một object.");
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(k)) {
      return fail(`Trường "${k}" không được phép sửa. Cho phép: ${EDITABLE_FIELDS.join(", ")}.`);
    }
    switch (k) {
      case "gender":
        if (v !== "M" && v !== "F") return fail("gender phải là M hoặc F.");
        out[k] = v;
        break;
      case "is_living":
        if (typeof v !== "boolean") return fail("is_living phải là true/false.");
        out[k] = v;
        break;
      case "birth_date":
      case "death_date":
        if (!isValidDate(v)) return fail(`${k} phải dạng YYYY-MM-DD hợp lệ.`);
        out[k] = v;
        out[`${k}_precision`] = "day";
        break;
      case "death_anniv_lunar_month":
        if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 12) {
          return fail("death_anniv_lunar_month phải từ 1 đến 12.");
        }
        out[k] = v;
        break;
      case "death_anniv_lunar_day":
        if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 30) {
          return fail("death_anniv_lunar_day phải từ 1 đến 30.");
        }
        out[k] = v;
        break;
      default: {
        const s = str(v, k === "bio" ? MAX_TEXT : MAX_NAME * 2);
        if (!s) return fail(`${k} trống hoặc quá dài.`);
        out[k] = s;
      }
    }
  }
  if (Object.keys(out).length === 0) return fail("`changes` trống.");
  const b = out.birth_date as string | undefined;
  const d = out.death_date as string | undefined;
  if (b && d && b > d) return fail("Ngày sinh muộn hơn ngày mất.");
  return { ok: true, value: out };
}

export function validateNewPerson(a: Record<string, unknown>): Result<Record<string, unknown>> {
  const full_name = str(a.full_name, MAX_NAME);
  if (!full_name) return fail("full_name trống hoặc quá dài.");
  if (a.gender !== "M" && a.gender !== "F") return fail("gender phải là M hoặc F.");
  const out: Record<string, unknown> = { full_name, gender: a.gender };
  if (a.is_living !== undefined) {
    if (typeof a.is_living !== "boolean") return fail("is_living phải là true/false.");
    out.is_living = a.is_living;
  }
  for (const k of ["birth_date", "death_date"] as const) {
    if (a[k] === undefined) continue;
    if (!isValidDate(a[k])) return fail(`${k} phải dạng YYYY-MM-DD hợp lệ.`);
    out[k] = a[k];
    out[`${k}_precision`] = "day";
  }
  if (out.birth_date && out.death_date && (out.birth_date as string) > (out.death_date as string)) {
    return fail("Ngày sinh muộn hơn ngày mất.");
  }
  for (const k of ["birth_place", "burial_place", "bio"] as const) {
    if (a[k] === undefined) continue;
    const s = str(a[k], k === "bio" ? MAX_TEXT : MAX_NAME * 2);
    if (!s) return fail(`${k} trống hoặc quá dài.`);
    out[k] = s;
  }
  if (a.relation_as !== undefined || a.relation_of_person_id !== undefined) {
    if (a.relation_as !== "child" && a.relation_as !== "spouse") {
      return fail("relation_as phải là child hoặc spouse.");
    }
    if (typeof a.relation_of_person_id !== "string" || !UUID_RE.test(a.relation_of_person_id)) {
      return fail("relation_of_person_id phải là id lấy từ search_person.");
    }
    out.relation = { as: a.relation_as, of_person_id: a.relation_of_person_id };
  }
  return { ok: true, value: out };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateNote(v: unknown): Result<string> {
  const s = str(v, MAX_TEXT);
  return s ? { ok: true, value: s } : fail("note trống hoặc quá dài.");
}
