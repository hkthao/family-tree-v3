import { createContext, useContext, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Đang ở chế độ XEM (trong ReadOnlyFieldset readOnly) — Label dùng để bỏ đuôi "(tuỳ chọn)", ô số tiền hiện dạng đọc. */
const ReadOnlyContext = createContext(false);
export const useReadOnlyView = () => useContext(ReadOnlyContext);

/**
 * Khung bọc các ô của một form: `readOnly` thì khoá toàn bộ ô (`fieldset disabled`) nhưng
 * giữ chữ rõ nét (không mờ như ô bị khoá thông thường) và ẩn mọi nút gắn `data-edit-only`.
 * Dùng cho ngăn kéo "xem" tái dùng chính form sửa — xem docs/design-language.md §Ngăn kéo xem / sửa.
 */
export function ReadOnlyFieldset({
  readOnly,
  className,
  children,
}: {
  readOnly: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      disabled={readOnly}
      className={cn(
        "m-0 min-w-0 space-y-3 border-0 p-0",
        readOnly &&
          // `read-view` (index.css): ô nhập hiện như chữ để ĐỌC — bỏ khung/nền/icon/mũi tên, ẩn dòng trống.
          "read-view [&_:disabled]:!cursor-default [&_:disabled]:!opacity-100 [&_[data-edit-only]]:hidden",
        className,
      )}
    >
      <ReadOnlyContext.Provider value={readOnly}>
        {children}
      </ReadOnlyContext.Provider>
    </fieldset>
  );
}
