/**
 * Kiểu ảnh xem trước (1200×630) của trang chủ dòng họ khi dán link lên Facebook / Zalo. Mỗi kiểu chỉ là bộ màu + kiểu nền; thêm kiểu
 * mới = thêm một dòng vào CLAN_OG_STYLES (ClanOgImage tự dựng). Màu viết sẵn (không dùng biến CSS) để html-to-image xuất đúng.
 */
export type ClanOgStyleId = "classic" | "paper" | "crimson";

export interface ClanOgStyle {
  id: ClanOgStyleId;
  label: string;
  /** Nền toàn ảnh (CSS background). */
  background: string;
  /** Màu chữ chính, chữ phụ, nhấn (tên "Gia phả…", viền, số liệu). */
  text: string;
  muted: string;
  accent: string;
  /** Viền khung trong + nền ô số liệu. */
  frame: string;
  statBg: string;
}

export const CLAN_OG_STYLES: ClanOgStyle[] = [
  {
    id: "classic",
    label: "Cổ điển",
    background: "radial-gradient(circle at 15% 10%, #3a2a24, #1a1612 65%)",
    text: "#efe9db",
    muted: "#bab1a3",
    accent: "#d4a045",
    frame: "rgba(212,160,69,.45)",
    statBg: "rgba(255,255,255,.06)",
  },
  {
    id: "paper",
    label: "Giấy dó",
    background: "linear-gradient(135deg, #f6efe0, #e9dcc0)",
    text: "#2b1d14",
    muted: "#6f5a47",
    accent: "#a3262a",
    frame: "rgba(163,38,42,.45)",
    statBg: "rgba(163,38,42,.08)",
  },
  {
    id: "crimson",
    label: "Đỏ thắm",
    background: "linear-gradient(135deg, #7a1d22, #3d0f12)",
    text: "#fbf1e4",
    muted: "#e5c9b4",
    accent: "#f0c15a",
    frame: "rgba(240,193,90,.55)",
    statBg: "rgba(255,255,255,.08)",
  },
];

export function clanOgStyle(id: string | null | undefined): ClanOgStyle {
  return CLAN_OG_STYLES.find((s) => s.id === id) ?? CLAN_OG_STYLES[0];
}
