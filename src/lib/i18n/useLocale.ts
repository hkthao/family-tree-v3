import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";
import { updateMyLocale } from "@/lib/queries/profile";

import { activateLocale, type Locale } from "./index";

/**
 * Đổi ngôn ngữ giao diện: bật ngay + nhớ trên máy; người đã đăng nhập còn được lưu vào hồ sơ để
 * dùng trên thiết bị khác và để email/push gửi đúng ngôn ngữ. Lỗi lưu hồ sơ không chặn việc đổi.
 */
export function useChangeLocale(): (locale: Locale) => Promise<void> {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  return useCallback(
    async (locale: Locale) => {
      await activateLocale(locale);
      if (!userId) return;
      qc.setQueryData(["profile-locale", userId], locale);
      try {
        await updateMyLocale(userId, locale);
      } catch {
        /* chưa lưu được hồ sơ (vd cột chưa có): lựa chọn vẫn áp dụng trên máy này */
      }
    },
    [qc, userId],
  );
}
