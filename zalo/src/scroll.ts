/**
 * Cuộn màn hình đang xem về đầu. Mỗi màn hình là một khung cuộn riêng
 * (xem `.screen` trong app.css) nên `window.scrollTo` không còn tác dụng.
 */
export function scrollTopScreen(): void {
  document.querySelector(".screen.top")?.scrollTo({ top: 0 });
}
