import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Link } from "react-router-dom";

import { IconLogIn, IconShield, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useSite } from "./siteContext";

/** Cùng khoá với màn Share cũ: đóng ở bên nào thì bên kia cũng không hiện lại. */
const NOTICE_KEY = "family-tree:share-notice-dismissed";

/**
 * Hai khối nhắc nằm dưới thanh đầu của trang dòng họ:
 *  - lưu ý quyền riêng tư "Thông tin nhạy cảm đã được ẩn" (đóng được, nhớ theo thiết bị);
 *  - với dòng họ CÔNG KHAI: lời mời "Đăng nhập để xem đầy đủ & cùng vun đắp" (đăng nhập xong vào thẳng dòng họ).
 * Link tập trung (QR người / mộ / di sản / thiệp) không hiện: chỉ có một mục, không cần.
 */
export function SiteNotices() {
  const { access, data, focus } = useSite();
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  if (focus) return null;
  const publicClan = !access.token && !!access.clanId;
  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      /* chế độ riêng tư: bỏ qua */
    }
  };

  return (
    <div className="container max-w-6xl space-y-2 pt-3 print-hide">
      {open && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
        >
          <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{t`Thông tin nhạy cảm đã được ẩn`}</p>
            <p className="text-muted-foreground">{t`Ngày tháng, nơi chốn của người còn sống không hiển thị ở bản xem này.`}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={t`Đóng thông báo`}
            title={t`Đóng`}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}
      {publicClan && (
        <div className="flex justify-center">
          {/* Chữ dài: cho phép xuống dòng để không tràn ngang ở màn 390px. */}
          <Button
            asChild
            size="sm"
            className="h-auto max-w-full whitespace-normal px-3 py-2 text-center text-sm"
          >
            <Link
              to={`/login?next=${encodeURIComponent(`/clans/${data.clan_id}`)}`}
            >
              <IconLogIn className="mr-1.5 h-4 w-4 shrink-0" />
              {t`Đăng nhập để xem đầy đủ & cùng vun đắp`}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
