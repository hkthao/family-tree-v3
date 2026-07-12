import * as React from "react";

import { IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Visible-but-screen-reader-only label. Required for accessibility. */
  label: string;
  /** Nội dung nhét BÊN TRONG ô, sát phải (vd nút làm mới) — tiết kiệm 1 hàng. */
  rightSlot?: React.ReactNode;
}

/**
 * Search-with-icon input. Used everywhere a "tìm kiếm" field appears so
 * the affordance is identical across screens.
 *
 * The icon is decorative; `label` becomes aria-label so screen readers
 * still announce what the field is for.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, Props>(
  function SearchInput({ label, className, rightSlot, ...rest }, ref) {
    return (
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={ref}
          type="search"
          aria-label={label}
          className={cn("h-10 pl-9", rightSlot && "pr-11", className)}
          {...rest}
        />
        {rightSlot && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {rightSlot}
          </div>
        )}
      </div>
    );
  },
);
