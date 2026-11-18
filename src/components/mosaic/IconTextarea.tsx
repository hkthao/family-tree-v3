import type { ReactNode } from "react";

import { Textarea, type TextareaProps } from "@/components/ui/textarea";

/**
 * Ô nhiều dòng trình bày giống `Input` có icon: nhãn thường ở trên, icon nằm trong ô,
 * sát mép trái và canh theo dòng đầu (không canh giữa như Input vì ô cao nhiều dòng).
 */
export function IconTextarea({
  id,
  label,
  icon,
  className,
  ...props
}: Omit<TextareaProps, "label" | "icon"> & {
  id: string;
  label: string;
  icon: ReactNode;
}) {
  // Textarea nay tự đặt icon trong ô (canh dòng đầu) — giữ tên cũ cho các nơi đang gọi.
  return (
    <Textarea
      id={id}
      label={label}
      icon={icon}
      className={className}
      {...props}
    />
  );
}
