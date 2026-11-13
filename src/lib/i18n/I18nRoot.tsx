import { I18nProvider } from "@lingui/react";
import { useEffect, useState, type ReactNode } from "react";

import { currentLocale, i18n } from "./index";

/**
 * Gốc đa ngôn ngữ của app. Đổi ngôn ngữ thì **dựng lại cả cây giao diện** (key theo ngôn ngữ):
 * rất nhiều chuỗi nằm ở mã ngoài React (menu, thông báo, PDF…) gọi `t` lúc render, nên cách đơn giản
 * và chắc chắn là cho mọi thứ vẽ lại. Đổi ngôn ngữ là thao tác hiếm nên mất state cục bộ là chấp nhận được;
 * dữ liệu đã tải (React Query) và địa chỉ trang giữ nguyên.
 */
export function I18nRoot({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(currentLocale());
  useEffect(() => i18n.on("change", () => setLocale(currentLocale())), []);
  return (
    <I18nProvider i18n={i18n} key={locale}>
      {children}
    </I18nProvider>
  );
}
