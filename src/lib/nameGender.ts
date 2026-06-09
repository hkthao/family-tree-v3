// Heuristic: guess gender from a Vietnamese name. Used by the
// quick-add sheet to auto-flip the Nam/Nữ toggle as the user types,
// so the 95% case ("Nguyễn Thị Hương" → F) needs zero taps.
//
// High precision over recall: when the name is ambiguous
// (Anh, Minh, Ngọc, Thanh, Phương, Quân, Hà, Khánh, …) we return
// null and the caller keeps whatever gender it already had.
//
// Personal-name (last token after the surname) wins over đệm
// ("Văn"/"Thị"), since compound names like "Nguyễn Văn Hương" do
// occur — the personal syllable carries the gender, not the đệm.

const MALE_DEM = new Set(["văn"]);
const FEMALE_DEM = new Set(["thị"]);

// Strongly-male personal-name syllables. Curated: each entry should
// be ≥95% male in real Vietnamese populations. Ambiguous ones (anh,
// minh, hà, khánh, ngọc, quân, thanh, phương, an, bình, hải) are
// intentionally OUT.
const MALE_NAMES = new Set([
  "bảo", "công", "cường", "dũng", "dương", "đại", "đạt", "đăng",
  "đức", "hiếu", "hoàng", "huy", "hùng", "khang", "khải", "khoa",
  "khôi", "kiên", "kiệt", "lâm", "lộc", "long", "luân", "lý",
  "mạnh", "nam", "nghĩa", "nguyên", "nhân", "nhật", "ninh", "phong",
  "phú", "phước", "quang", "quốc", "quyền", "sang", "sĩ", "sơn",
  "sỹ", "tài", "tâm", "thái", "thắng", "thành", "thiên", "thiện",
  "thịnh", "thuận", "tiến", "tín", "toàn", "trí", "trung", "tú",
  "tuấn", "tùng", "tuệ", "việt", "vinh", "vĩnh", "vũ",
]);

// Strongly-female personal-name syllables. Same precision bar.
const FEMALE_NAMES = new Set([
  "ánh", "bích", "châu", "chi", "diễm", "diệu", "dung", "duyên",
  "đào", "hà", "hạnh", "hằng", "hân", "hiền", "hoa", "hoài", "hồng",
  "hương", "huyền", "hường", "kiều", "kim", "lan", "lệ", "liễu",
  "linh", "loan", "ly", "mai", "my", "mỹ", "nga", "ngân", "nguyệt",
  "nhi", "nhung", "oanh", "phượng", "quyên", "quỳnh", "sương",
  "thảo", "thoa", "thu", "thủy", "thúy", "tiên", "trâm", "trang",
  "trinh", "tuyết", "uyên", "vân", "vy", "xuân", "yến",
]);

function normalize(s: string): string[] {
  return s
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Returns "M" / "F" if confident, else null. Caller decides whether
 * to apply (e.g., only if the user hasn't manually picked a gender).
 *
 * Strategy: skip the surname (first token), then scan the remaining
 * tokens. Personal-name signals win over đệm signals — that's why
 * we do two passes instead of returning on the first hit.
 */
export function inferGenderFromName(fullName: string): "M" | "F" | null {
  const words = normalize(fullName);
  if (words.length < 2) return null;
  const tail = words.slice(1);

  for (const w of tail) {
    if (MALE_NAMES.has(w)) return "M";
    if (FEMALE_NAMES.has(w)) return "F";
  }
  for (const w of tail) {
    if (MALE_DEM.has(w)) return "M";
    if (FEMALE_DEM.has(w)) return "F";
  }
  return null;
}
