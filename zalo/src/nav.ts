/**
 * Một CHỒNG "việc cần hoàn tác" duy nhất cho nút quay lại.
 *
 * Nút quay lại (của Zalo, hay vuốt ngược trên Android) chỉ biết lùi lịch
 * sử trình duyệt. Mỗi bước tiến trong app — mở một màn hình mới, hay nhảy
 * sang tab khác bằng một nút trong nội dung — đẩy một mốc lịch sử kèm cách
 * hoàn tác đúng bước đó. Lùi là gỡ mốc trên cùng và chạy cách hoàn tác của
 * nó, nên luôn về đúng chỗ vừa rời đi.
 *
 * Trước đây chỉ việc mở màn hình mới có mốc: bấm "Phả hệ" ở Tổng quan
 * (đổi tab, không có mốc) rồi lùi là rơi thẳng về trang chủ.
 */
const undoStack: (() => void)[] = [];

export function pushBack(undo: () => void): void {
  window.history.pushState({ depth: undoStack.length }, "");
  undoStack.push(undo);
}

/** Gắn một lần ở gốc app; trả về hàm gỡ. */
export function listenBack(): () => void {
  const onPop = () => undoStack.pop()?.();
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
