import * as React from "react";

import { InSidePanelContext } from "@/components/panel/context";
import { cn } from "@/lib/utils";

/**
 * Hàng nút cuối một form / một thẻ.
 *
 * Vì sao cần component riêng thay vì `flex gap-3 justify-end`: cách cũ
 * **tràn ngang trên điện thoại**. Màn hẹp nhất ghi nhận được là 320px;
 * ba nút "Lưu" · "Lưu & thêm nữa" · "Hủy" cộng lại ~420px, nên nút đầu
 * bị đẩy khuất khỏi mép trái — đúng thứ người dùng cần bấm nhất lại là
 * thứ biến mất.
 *
 * Cách xử lý:
 *  - **Điện thoại**: xếp dọc, mỗi nút chiếm trọn chiều ngang. Không dùng
 *    `flex-wrap` vì nó cho ra hàng lẻ so le, nhìn như lỗi; mà nút hẹp
 *    cũng khó bấm hơn.
 *  - **Từ `sm` trở lên**: về lại một hàng, dồn phải như cũ.
 *
 * Thứ tự con **phải theo rule**: phá huỷ → phụ → chính (xem
 * docs/design-language.md). Một thứ tự đó cho ra đúng cả hai bố cục —
 * trên máy tính nút chính nằm ngoài cùng phải, trên điện thoại nó nằm
 * dưới cùng, tức gần ngón cái nhất.
 */
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const inPanel = React.useContext(InSidePanelContext);
  if (inPanel) return <PanelActionBar className={className}>{children}</PanelActionBar>;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 pt-2",
        "sm:flex-row sm:justify-end sm:gap-3",
        // Nút full-width ở màn hẹp, co lại theo nội dung từ sm.
        "[&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Thanh nút cuối form NẰM TRONG ngăn kéo (SidePanel): dính đáy ngăn kéo (kể cả
 * khi form ngắn — `mt-auto` trong cột flex của thân panel), nút phụ bên trái,
 * nút chính ngoài cùng phải, cùng nền / viền / khoảng đệm ở mọi form. Nút luôn
 * cỡ sm (h-10) — bằng các nút Xuất sổ / Chia sẻ — dù form khai báo size nào.
 */
export const PANEL_ACTIONS_CLASS =
  "sticky bottom-0 z-10 !mt-auto -mx-4 flex flex-row items-center justify-end gap-2 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:-mx-5 sm:px-5 [&>*]:w-auto [&>*]:h-10 [&>*]:px-4";

/**
 * Thanh nút dính đáy của ngăn kéo + một khoảng đệm 1rem phía trên để nội dung
 * không dính sát thanh nút. Khoảng đệm là phần tử riêng (không phải margin) vì
 * `space-y-*` của form sẽ ghi đè margin.
 */
export function PanelActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <div aria-hidden="true" className="!mt-0 h-4 shrink-0" />
      <div className={cn(PANEL_ACTIONS_CLASS, className)}>{children}</div>
    </>
  );
}
