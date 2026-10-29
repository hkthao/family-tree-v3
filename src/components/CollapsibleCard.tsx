import { useState, type ReactNode } from "react";

import { IconChevronDown, IconChevronUp } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Thẻ có tiêu đề bấm được để thu gọn / mở rộng nội dung (mũi tên bên phải).
 * Dùng cho các khối dài ở màn chi tiết để người xem điện thoại cuộn ít hơn.
 */
export function CollapsibleCard({
  title,
  header,
  titleClassName,
  contentClassName,
  defaultOpen = true,
  children,
}: {
  title: ReactNode;
  /** Phần mô tả dưới tiêu đề, luôn hiện kể cả khi thu gọn. */
  header?: ReactNode;
  titleClassName?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader className={open ? "" : "pb-6"}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardTitle className={titleClassName}>{title}</CardTitle>
          <span
            className="shrink-0 text-muted-foreground"
            title={open ? "Thu gọn" : "Mở rộng"}
            aria-hidden="true"
          >
            {open ? <IconChevronUp className="h-5 w-5" /> : <IconChevronDown className="h-5 w-5" />}
          </span>
        </button>
        {header}
      </CardHeader>
      {open && <CardContent className={contentClassName}>{children}</CardContent>}
    </Card>
  );
}
