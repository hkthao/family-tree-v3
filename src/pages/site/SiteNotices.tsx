import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { IconLogIn, IconShield, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SITE_PAGE_PATH } from "@/lib/siteSections";

import { useSite } from "./siteContext";

/** Cùng khoá với màn Share cũ: đóng ở bên nào thì bên kia cũng không hiện lại. */
const NOTICE_KEY = "family-tree:share-notice-dismissed";

/**
 * Hai khối nhắc nằm dưới thanh đầu của trang dòng họ:
 *  - lưu ý quyền riêng tư "Thông tin nhạy cảm đã được ẩn" (đóng được, nhớ theo thiết bị);
 *  - với dòng họ CÔNG KHAI: lời mời "Đăng nhập để xem đầy đủ & cùng vun đắp" (đăng nhập xong vào thẳng dòng họ).
 * Không hiện ở: link tập trung (QR người / mộ / di sản / thiệp: chỉ một mục) và trang Cây (khung cây chiếm trọn màn hình,
 * hai khối này đẩy cây xuống và làm trang phải cuộn). Điện thoại: gọn một dòng, bỏ câu giải thích dài.
 */
export function SiteNotices() {
  const { access, data, focus } = useSite();
  const { pathname } = useLocation();
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const onTree = pathname
    .replace(/\/+$/, "")
    .endsWith(`/${SITE_PAGE_PATH.tree}`);
  if (focus || onTree) return null;
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
    <div className="container max-w-6xl space-y-2 pt-2 print-hide sm:pt-3">
      {open && (
        <div
          role="note"
          className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5 sm:items-start sm:gap-3 sm:p-3"
        >
          <IconShield className="h-5 w-5 shrink-0 text-primary sm:mt-0.5" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{t`Thông tin nhạy cảm đã được ẩn`}</p>
            <p className="hidden text-muted-foreground sm:block">{t`Ngày tháng, nơi chốn của người còn sống không hiển thị ở bản xem này.`}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
            aria-label={t`Đóng thông báo`}
            title={t`Đóng`}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}
      {publicClan && (
        <div className="flex justify-center">
          <Button
            asChild
            size="sm"
            className="h-auto max-w-full whitespace-normal px-3 py-2 text-center text-sm max-sm:w-full"
          >
            <Link
              to={`/login?next=${encodeURIComponent(`/clans/${data.clan_id}`)}`}
            >
              <IconLogIn className="mr-1.5 h-4 w-4 shrink-0" />
              <span className="sm:hidden">{t`Đăng nhập để xem đầy đủ`}</span>
              <span className="hidden sm:inline">{t`Đăng nhập để xem đầy đủ & cùng vun đắp`}</span>
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
