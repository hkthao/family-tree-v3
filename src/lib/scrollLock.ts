/**
 * Khoá cuộn trang (body) có ĐẾM, dùng chung cho mọi lớp phủ (ngăn kéo, menu trái, lightbox, hộp thoại…).
 *
 * Trước đây mỗi nơi tự "nhớ overflow cũ → đặt hidden → trả lại giá trị cũ" (SidePanel còn đặt thẳng ""). Cách đó chỉ
 * đúng khi các lớp đóng NGƯỢC thứ tự mở; đóng lệch (vd menu trái + ngăn kéo, lightbox trong ngăn kéo) thì body kẹt ở
 * `overflow: hidden` → trang không cuộn tới cuối được nữa cho tới khi tải lại. Giờ: còn ≥1 lớp giữ khoá thì khoá,
 * lớp cuối nhả thì mở. Hàm nhả gọi nhiều lần cũng chỉ tính một.
 */
let holders = 0;

export function lockBodyScroll(): () => void {
  holders += 1;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) document.body.style.overflow = "";
  };
}
