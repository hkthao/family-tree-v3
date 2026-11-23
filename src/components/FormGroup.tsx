import { IconChevronDown, IconChevronUp } from "@/components/icons";

import { t } from "@lingui/core/macro";
/**
 * Một nhóm ô nhập dạng card: thanh tiêu đề riêng (số thứ tự, tên nhóm, nhãn
 * Bắt buộc / Tuỳ chọn) tách khỏi phần thân bằng đường kẻ, để lướt qua là phân
 * biệt được nhóm nào. Nhóm tuỳ chọn (`collapsible`) thu gọn sẵn cho form ngắn.
 */
export function FormGroup({
  step,
  title,
  desc,
  collapsible,
  defaultOpen,
  badge,
  children,
}: {
  /** Số thứ tự; bỏ trống khi card đứng một mình (vd. trang Cài đặt). */
  step?: number;
  title: string;
  desc: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Nhãn cạnh tên nhóm. Mặc định: nhóm thu gọn được là Tuỳ chọn, còn lại là Bắt buộc. */
  badge?: "required" | "optional" | "none";
  children: React.ReactNode;
}) {
  const kind = badge ?? (collapsible ? "optional" : "required");
  const head = (
    <>
      {step !== undefined && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {step}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="text-base font-semibold">{title}</span>
          {kind !== "none" && (
            <span
              className={
                kind === "optional"
                  ? "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  : "rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              }
            >
              {kind === "optional" ? t`Tuỳ chọn` : t`Bắt buộc`}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          {desc}
        </span>
      </span>
    </>
  );
  const card =
    "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm";
  const headCls = "flex items-start gap-3 bg-muted/30 px-4 py-3";
  if (!collapsible) {
    return (
      <section className={card}>
        <div className={`${headCls} border-b`}>{head}</div>
        <div className="space-y-5 p-4">{children}</div>
      </section>
    );
  }
  return (
    <details open={defaultOpen} className={`group ${card}`}>
      <summary
        className={`${headCls} cursor-pointer list-none hover:bg-muted/60 group-open:border-b [&::-webkit-details-marker]:hidden`}
      >
        {head}
        {/* Cùng kiểu nút chevron đơn của CardHeader thu gọn được (ui/card.tsx). */}
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground group-open:hidden"
          title={t`Mở rộng`}
        >
          <IconChevronDown className="h-4 w-4" />
        </span>
        <span
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground group-open:inline-flex"
          title={t`Thu gọn`}
        >
          <IconChevronUp className="h-4 w-4" />
        </span>
      </summary>
      <div className="space-y-5 p-4">{children}</div>
    </details>
  );
}
