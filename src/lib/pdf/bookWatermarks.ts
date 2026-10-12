/**
 * Các hình nền mờ in chìm dưới mỗi trang Sổ gia phả.
 *
 * Nằm ở file riêng, KHÔNG nhập gì từ @react-pdf: hộp "Xuất sổ" cần bảng
 * này để liệt kê lựa chọn, mà kéo theo cả trình dựng PDF (~1,5MB) vào
 * trang Cây chỉ để vẽ một ô chọn thì phí.
 *
 * Thêm hình mới: đặt PNG TRẮNG ĐEN, nền trong suốt vào /public/watermarks
 * rồi khai thêm một mục ở đây. Giữ trắng đen để hình không tranh màu với
 * huy hiệu đời và khung trang.
 */
export const BOOK_WATERMARKS = {
  dragon: {
    label: "Rồng",
    src: "/watermarks/dragon.png",
    /** rộng / cao của hình */
    ratio: 1602 / 731,
    // Hình thang xám (nhiều mảng nhạt) nên phải đậm hơn hình mực đen
    // đặc thì in ra mới thấy ngang nhau.
    opacity: 0.11,
  },
  phoenix: {
    label: "Phượng",
    src: "/watermarks/phoenix.png",
    ratio: 1200 / 1502,
    opacity: 0.06,
  },
} as const;

export type BookWatermarkId = keyof typeof BOOK_WATERMARKS;
