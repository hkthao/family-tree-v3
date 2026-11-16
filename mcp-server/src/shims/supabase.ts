/**
 * Thay `@/lib/supabase` của FE khi gộp code dựng PDF vào server MCP.
 *
 * FE tạo client bằng `import.meta.env.VITE_*` (không có ở đây). Mọi hàm truy vấn của app đều nhận `client`
 * làm tham số cuối nên server luôn truyền client của chủ token; nếu có chỗ quên truyền thì lỗi RÕ RÀNG thay
 * vì lặng lẽ dùng một client sai danh tính.
 */
const fail = (): never => {
  throw new Error("Thiếu client Supabase: hàm này phải được gọi với client của người dùng.");
};
export const supabase = new Proxy({}, { get: fail }) as never;
export const SUPABASE_URL = "";
