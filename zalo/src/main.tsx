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

createRoot(document.getElementById("app")!).render(<App />);
