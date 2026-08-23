import * as React from "react";

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
