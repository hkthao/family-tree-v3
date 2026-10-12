import { createRoot } from "react-dom/client";

import "zmp-ui/zaui.css";

import { initTheme } from "@/lib/theme";

import appConfig from "../app-config.json";
import { App } from "./App";

declare global {
  interface Window {
    APP_CONFIG?: unknown;
  }
}

if (!window.APP_CONFIG) window.APP_CONFIG = appConfig;

// Sáng/tối: dùng chung bộ quản lý theme của web (lưu lựa chọn trên máy,
// mặc định theo chế độ của máy, đặt lớp "dark" trên <html>). CSS của Mini
// App và thành phần cây 3D của web đều đọc lớp đó.
initTheme();

createRoot(document.getElementById("app")!).render(<App />);
