/**
 * Vietnamese-aware client-side unaccent. Mirrors Postgres' f_unaccent()
 * wrapper used in our trigram search index. Lowercase + strip combining
 * diacritics + map đ → d.
 *
 * Used to normalize user search input before sending to the server so
 * the comparison is symmetric on both sides (`full_name_unaccent ILIKE
 * '%' || normalized || '%'`).
 */
export function unaccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
