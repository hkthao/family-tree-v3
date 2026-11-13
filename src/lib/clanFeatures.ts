import { msg } from "@lingui/core/macro";
import { lazyAs } from "@/lib/i18n/lazy";

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
  | "mosaic"
  | "heritage"
  | "graves"
  | "honor"
  | "fund"
  | "inlaws"
  | "ai_assistant";

export interface ClanFeatureDef {
  key: ClanFeatureKey;
  label: string;
  description: string;
}

/** Danh sách tính năng có thể bật/tắt (hiển thị ở trang Cài đặt). */
export const CLAN_FEATURES: ClanFeatureDef[] = lazyAs<ClanFeatureDef[]>([
  { key: "board", label: msg`Bảng tin`, description: msg`Diễn đàn/bảng tin nội bộ dòng họ.` },
  { key: "memory_room", label: msg`Phòng ký ức`, description: msg`Phòng trưng bày ảnh 3D.` },
  { key: "mosaic", label: msg`Ảnh ghép đại gia đình`, description: msg`Mỗi người góp một mảnh ảnh, ghép thành bức tranh chung.` },
  { key: "heritage", label: msg`Di sản dòng họ`, description: msg`Di sản, văn hoá, hiện vật.` },
  { key: "graves", label: msg`Mộ phần & tro cốt`, description: msg`Danh mục mộ phần, nghĩa trang.` },
  { key: "honor", label: msg`Bảng vàng công đức`, description: msg`Ghi nhận đóng góp công đức.` },
  { key: "fund", label: msg`Quỹ họ`, description: msg`Sổ quỹ thu chi dòng họ.` },
  { key: "inlaws", label: msg`Liên kết dòng họ`, description: msg`Liên kết chéo giữa các dòng họ (thông gia, họ tổ, họ hậu duệ, họ hàng).` },
  { key: "ai_assistant", label: msg`Trợ lý AI`, description: msg`Hỏi đáp về gia phả bằng lời — giỗ chạp, xưng hô, tra cứu người. Câu hỏi được gửi tới dịch vụ AI bên ngoài để xử lý (kèm tên, năm sinh/mất của người liên quan; không gửi ảnh hay tiểu sử).` },
]);

/** Tính năng `key` có đang bật cho dòng họ này không (mặc định: bật). */
export function isFeatureEnabled(
  disabled: string[] | null | undefined,
  key: ClanFeatureKey,
): boolean {
  return !(disabled ?? []).includes(key);
}
