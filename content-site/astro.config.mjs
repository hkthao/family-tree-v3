import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Xuất ra .html (…/le-hoi/hoi-den-hung.html) để URL trùng với trang landing hiện tại.
export default defineConfig({
  site: "https://donghoviet.thaohk.com",
  build: { format: "file" },
  trailingSlash: "never",
  integrations: [
    // Trang tìm kiếm không đưa vào sitemap (đã noindex).
    sitemap({ filter: (page) => !page.includes("/tim-kiem") }),
  ],
});
