/** Kiểm biến môi trường TRƯỚC khi nạp handler (handler tạo client Supabase ngay lúc nạp). */
const REQUIRED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[mcp-server] thiếu biến môi trường: ${missing.join(", ")}`);
  process.exit(1);
}
