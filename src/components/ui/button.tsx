import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        /**
         * Chỉ dùng cho điểm dừng CUỐI, không hoàn tác được: xoá tài khoản
         * vĩnh viễn, xoá sạch danh bạ. Nền đỏ đặc phải hiếm thì mới còn
         * sức cảnh báo.
         */
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        /**
         * Nút xoá THÔNG THƯỜNG (xoá một mục, có hộp xác nhận, khôi phục
         * được). Viền + chữ đỏ, không nền đặc — một danh sách mười dòng
         * mà mười nút nền đỏ thì mắt không còn biết nhìn đâu.
         *
         * Có sẵn thành variant để không phải nhớ ghép
         * `variant="outline" className="text-destructive"` ở từng chỗ,
         * mà trước đây mỗi nơi ghép một kiểu.
         */
        "destructive-outline":
          "border border-destructive/40 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive",
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 py-2",
        sm: "h-10 px-3",
        lg: "h-14 px-8 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
