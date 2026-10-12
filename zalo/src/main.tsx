import { createRoot } from "react-dom/client";

import "zmp-ui/zaui.css";

import appConfig from "../app-config.json";
import { App } from "./App";

declare global {
  interface Window {
    APP_CONFIG?: unknown;
  }
}

if (!window.APP_CONFIG) window.APP_CONFIG = appConfig;

// Thành phần dùng chung với web (cây 3D) chọn bảng màu theo lớp "dark" trên
// <html>, còn CSS của Mini App theo chế độ sáng/tối của máy. Đặt lớp đó theo
// máy để hai bên khớp nhau.
const darkQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
const syncDark = () =>
  document.documentElement.classList.toggle("dark", !!darkQuery?.matches);
syncDark();
darkQuery?.addEventListener?.("change", syncDark);

createRoot(document.getElementById("app")!).render(<App />);
