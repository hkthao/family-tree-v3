import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
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
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative w-full">
        <span
          className="pointer-events-none absolute left-3 top-5 -translate-y-1/2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden="true"
        >
          {icon}
        </span>
        <Textarea id={id} className={`pl-10 ${className ?? ""}`} {...props} />
      </div>
    </div>
  );
}
