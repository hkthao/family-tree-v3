import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { backgroundSuppressed, backgroundUrl, useBackground } from "@/lib/background";
import { getTheme, subscribeTheme, type Theme } from "@/lib/theme";

/** Trang công khai / chia sẻ giữ nền trơn (ngoài phạm vi hình nền). */
const PLAIN_PREFIXES = ["/share", "/khoe", "/login", "/signup", "/forgot-password", "/reset-password"];

function isDark(t: Theme): boolean {
  return t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/**
 * Lớp nền cố định dưới toàn app: tranh + một lớp phủ bằng chính màu nền (alpha = độ phủ người dùng chỉnh).
 * Thẻ vẫn đặc nên nội dung không đổi; chỉ lề, khe giữa thẻ và header/menu (bán trong suốt) lộ tranh.
 */
export function AppBackground() {
  const { id, dim } = useBackground();
  const { pathname } = useLocation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [theme, setLocalTheme] = useState<Theme>(() => getTheme());
  useEffect(() => subscribeTheme(setLocalTheme), []);

  const plain = PLAIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  useEffect(() => {
    // Trang trơn: gỡ cờ để layout lấy lại nền đặc.
    if (plain) delete document.documentElement.dataset.bg;
    else if (id && !backgroundSuppressed()) document.documentElement.dataset.bg = "on";
  }, [plain, id]);

  if (!id || plain || backgroundSuppressed()) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 print:hidden" style={{ zIndex: -1 }}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundUrl(id, isDark(theme), desktop)})` }}
      />
      <div className="absolute inset-0" style={{ backgroundColor: `hsl(var(--background) / ${dim})` }} />
    </div>
  );
}
