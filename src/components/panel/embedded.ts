/** Cách một trang-form tự nhận mình đang chạy trong ngăn kéo (không breadcrumb / header, không chuyển route). */
export interface EmbeddedForm {
  /** Id bản ghi đang sửa; trống = tạo mới. */
  id?: string;
  /** Gọi sau khi lưu thành công (thay cho navigate). */
  onDone: (id?: string) => void;
  onCancel: () => void;
}
