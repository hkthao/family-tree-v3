import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import ZaloMiniApp from "zmp-vite-plugin";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

/**
 * Mini App sống chung repo với web và DÙNG CHUNG `src/lib` của web.
 *
 * `@` trỏ về `src/` của WEB (không phải của Mini App) vì các file trong
 * `src/lib` tự nhập lẫn nhau bằng `@/lib/...`; đổi nghĩa `@` ở đây là
 * mọi file dùng chung vỡ theo. Mã riêng của Mini App nhập bằng đường
 * dẫn tương đối.
 *
 * Chỉ nhập từ `@/lib` những file THUẦN LOGIC. File nào đụng tới PWA, web
 * push, tải file bằng link tạm hay router của web thì để yên bên web.
 */
export default defineConfig({
  root: "./src",
  base: "",
  // Biến môi trường đọc ở `zalo/` (không phải `zalo/src`): VITE_SUPABASE_*
  // nằm trong `zalo/.env.local`, cạnh `.env` do công cụ Zalo tạo.
  envDir: here,
  plugins: [react(), ZaloMiniApp()],
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "src"),
      // Thành phần 3D của web cần react-query; nó cài ở node_modules GỐC.
      // File trong `zalo/src` muốn nhập cùng bản đó (để chung một context)
      // thì phải chỉ đường, vì Node chỉ dò ngược từ `zalo/` lên.
      "@tanstack/react-query": path.resolve(
        repoRoot,
        "node_modules/@tanstack/react-query",
      ),
    },
    // Một bản React duy nhất, kể cả khi file dùng chung kéo theo thư viện
    // cài ở node_modules gốc của repo.
    dedupe: ["react", "react-dom"],
  },
  server: {
    // Mặc định Vite không cho đọc file ngoài thư mục gốc của dự án.
    fs: { allow: [repoRoot] },
  },
  optimizeDeps: {
    // Gom SẴN các thư viện chỉ được nạp lười (cây 2D/3D) ngay lúc khởi động
    // máy chủ dev. Không khai thì lần đầu bấm sang 2D/3D Vite mới phát hiện
    // ra chúng, gom lại giữa chừng và đổi mã phiên bản — trình duyệt đang
    // cầm địa chỉ cũ nên báo "Failed to fetch dynamically imported module".
    include: [
      "family-chart",
      "3d-force-graph",
      "three",
      "three-spritetext",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "@dqcai/vn-lunar",
    ],
  },
});
