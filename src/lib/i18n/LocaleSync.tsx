import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getMyLocale } from "@/lib/queries/profile";

import { activateLocale, currentLocale, isLocale } from "./index";

/**
 * Người đã đăng nhập: áp ngôn ngữ đã lưu trong hồ sơ (đồng bộ giữa các thiết bị). `?lang=` trên
 * địa chỉ (link chia sẻ) thắng, để người gửi link chọn được ngôn ngữ cho người nhận.
 */
export function LocaleSync() {
  const { user } = useAuth();
  const userId = user?.id;
  const { data } = useQuery({
    queryKey: ["profile-locale", userId],
    queryFn: () => getMyLocale(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  useEffect(() => {
    if (!isLocale(data)) return;
    if (new URLSearchParams(window.location.search).has("lang")) return;
    if (data !== currentLocale()) void activateLocale(data);
  }, [data]);
  return null;
}
