import type { BookWatermarkId } from "./bookWatermarks";

/**
 * Địa chỉ các tệp tĩnh mà Sổ gia phả PDF cần: phông chữ, logo bìa, ảnh minh
 * hoạ nam/nữ, hình nền mờ.
 *
 * Mặc định là đường dẫn tuyệt đối của TRANG WEB ("/fonts/…"). Zalo Mini App
 * chạy dưới một địa chỉ khác và không có các đường dẫn đó, nên nó đóng gói
 * tệp riêng rồi gọi `setPdfAssets` trước khi dựng sổ. Gom về một chỗ để
 * thêm một tệp mới thì chỉ phải nhớ khai ở đây, không phải dò từng nơi dùng.
 */
export interface PdfAssets {
  font400: string;
  font600: string;
  /**
   * Font tiêu đề theo lựa chọn "Font" của cây (id → [đậm vừa, đậm]).
   * Thiếu id đang chọn thì lùi về playfair.
   */
  nameFonts: Record<string, [string, string]>;
  logo: string;
  avatarM: string;
  avatarF: string;
  /** Ghi đè địa chỉ hình nền mờ theo id; thiếu thì dùng địa chỉ mặc định. */
  watermarks: Partial<Record<BookWatermarkId, string>>;
}

export const pdfAssets: PdfAssets = {
  font400: "/fonts/be-vietnam-pro-400.ttf",
  font600: "/fonts/be-vietnam-pro-600.ttf",
  nameFonts: {
    playfair: ["/fonts/name-playfair-600.ttf", "/fonts/name-playfair-700.ttf"],
    cormorant: ["/fonts/name-cormorant-600.ttf", "/fonts/name-cormorant-700.ttf"],
    charm: ["/fonts/name-charm-400.ttf", "/fonts/name-charm-700.ttf"],
    playwrite: ["/fonts/name-playwrite-400.ttf", "/fonts/name-playwrite-400.ttf"],
    dancing: ["/fonts/name-dancing-600.ttf", "/fonts/name-dancing-700.ttf"],
  },
  logo: "/icons/app-icon-192.png",
  avatarM: "/avatars/male-royal.png",
  avatarF: "/avatars/female-royal.png",
  watermarks: {},
};

/** Gọi TRƯỚC khi dựng sổ lần đầu (phông chỉ đăng ký một lần). */
export function setPdfAssets(next: Partial<PdfAssets>): void {
  Object.assign(pdfAssets, next);
}
