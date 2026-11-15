import type { ComponentType } from "react";

import type { ChipTone } from "@/components/Chip";
import { IconLock, IconPencil, IconSend } from "@/components/icons";
import type { ApiToken, ApiTokenScope } from "@/lib/queries/api-tokens";

import { t } from "@lingui/core/macro";

/** Gói quyền → nhãn, mô tả, màu và icon. Một nguồn cho chip, ô icon và lời giải thích ở form. */
export function scopeMeta(scope: ApiTokenScope): {
  label: string;
  hint: string;
  tone: ChipTone;
  icon: ComponentType<{ className?: string }>;
} {
  switch (scope) {
    case "write":
      return {
        label: t`Đọc + ghi trực tiếp`,
        hint: t`AI thêm, sửa, xoá người ngay, với đúng quyền hiện tại của người tạo token (bị hạ vai trò thì token hạ theo). Mọi thay đổi ghi vào nhật ký dưới tên người tạo và khôi phục được.`,
        tone: "orange",
        icon: IconPencil,
      };
    case "propose":
      return {
        label: t`Đọc + đề xuất`,
        hint: t`AI gửi thêm/sửa/ghi chú vào hàng chờ Đóng góp. Chỉ ghi vào gia phả khi admin dòng họ duyệt.`,
        tone: "warning",
        icon: IconSend,
      };
    default:
      return {
        label: t`Chỉ đọc`,
        hint: t`AI tra cứu người, quan hệ, giỗ, tư liệu. Không thay đổi được gì.`,
        tone: "info",
        icon: IconLock,
      };
  }
}

export type ApiTokenStatus = "active" | "revoked" | "expired";

export function tokenStatus(tk: Pick<ApiToken, "revoked_at" | "expires_at">): ApiTokenStatus {
  if (tk.revoked_at) return "revoked";
  return new Date(tk.expires_at) > new Date() ? "active" : "expired";
}

export function statusMeta(s: ApiTokenStatus): { label: string; tone: ChipTone } {
  return s === "active"
    ? { label: t`Đang dùng`, tone: "success" }
    : s === "revoked"
      ? { label: t`Đã thu hồi`, tone: "neutral" }
      : { label: t`Hết hạn`, tone: "warning" };
}
