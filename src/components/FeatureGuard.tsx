import { Navigate } from "react-router-dom";

import { useClanContext } from "@/hooks/useClanContext";
import { isFeatureEnabled, type ClanFeatureKey } from "@/lib/clanFeatures";

/**
 * Chặn route của một tính năng phụ đã bị dòng họ TẮT (feature-flags).
 * Đặt trong cây route dưới ClanLayout — đọc clan từ outlet context; nếu
 * tính năng tắt thì đá về trang Tổng quan của dòng họ.
 */
export function FeatureGuard({
  feature,
  children,
}: {
  feature: ClanFeatureKey;
  children: React.ReactNode;
}) {
  const { clan } = useClanContext();
  if (!isFeatureEnabled(clan.disabled_features, feature)) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }
  return <>{children}</>;
}
