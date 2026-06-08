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

/**
 * Diacritic-insensitive substring match for Vietnamese names. Empty
 * query matches everything — callers can short-circuit "no filter" by
 * passing `""`. Use this for client-side person pickers; the server-
 * side list query already does the same on `full_name_unaccent`.
 */
export function matchesName(fullName: string, query: string): boolean {
  const needle = unaccent(query);
  if (!needle) return true;
  return unaccent(fullName).includes(needle);
}
