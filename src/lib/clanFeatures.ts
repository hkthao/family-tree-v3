/**
 * Feature-flags theo dòng họ (opt-out). Admin có thể TẮT các tính năng
 * phụ để nav gọn cho dòng họ mình. Lõi (Tổng quan / Cây / Danh bạ / Sự
 * kiện / Hôm nay) luôn bật, không nằm ở đây.
 *
 * Lưu ở clans.disabled_features (text[]): chứa key đang TẮT. Rỗng = bật hết.
 */

export type ClanFeatureKey =
  | "board"
  | "memory_room"
  | "heritage"
  | "graves"
  | "honor"
  | "fund"
  | "inlaws";

export interface ClanFeatureDef {
  key: ClanFeatureKey;
  label: string;
  description: string;
}

/** Danh sách tính năng có thể bật/tắt (hiển thị ở trang Cài đặt). */
export const CLAN_FEATURES: ClanFeatureDef[] = [
  { key: "board", label: "Bảng tin", description: "Diễn đàn/bảng tin nội bộ dòng họ." },
  { key: "memory_room", label: "Phòng ký ức", description: "Phòng trưng bày ảnh 3D." },
  { key: "heritage", label: "Di sản dòng họ", description: "Di sản, văn hoá, hiện vật." },
  { key: "graves", label: "Mộ phần & tro cốt", description: "Danh mục mộ phần, nghĩa trang." },
  { key: "honor", label: "Bảng vàng công đức", description: "Ghi nhận đóng góp công đức." },
  { key: "fund", label: "Quỹ họ", description: "Sổ quỹ thu chi dòng họ." },
  { key: "inlaws", label: "Liên kết thông gia", description: "Liên kết chéo giữa các dòng họ." },
];

/** Tính năng `key` có đang bật cho dòng họ này không (mặc định: bật). */
export function isFeatureEnabled(
  disabled: string[] | null | undefined,
  key: ClanFeatureKey,
): boolean {
  return !(disabled ?? []).includes(key);
}
