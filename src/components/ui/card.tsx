import * as React from "react";

import { ActionArea } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { t } from "@lingui/core/macro";
interface CardCtx {
  collapsible: boolean;
  open: boolean;
  toggle: () => void;
}
const CardContext = React.createContext<CardCtx | null>(null);

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Mặc định true: card có CardHeader + CardContent/CardFooter tự thu gọn / mở rộng được. */
  collapsible?: boolean;
  /** Trạng thái ban đầu của card thu gọn được. */
  defaultOpen?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, children, collapsible = true, defaultOpen = true, ...props },
    ref,
  ) => {
    const [open, setOpen] = React.useState(defaultOpen);
    // Chỉ thu gọn được khi có phần thân để ẩn (card chỉ có header thì thôi).
    const hasBody = React.Children.toArray(children).some(
      (c) =>
        React.isValidElement(c) &&
        (c.type === CardContent || c.type === CardFooter),
    );
    const ctx = React.useMemo<CardCtx>(
      () => ({
        collapsible: collapsible && hasBody,
        open,
        toggle: () => setOpen((o) => !o),
      }),
      [collapsible, hasBody, open],
    );
    return (
      <CardContext.Provider value={ctx}>
        <div
          ref={ref}
          className={cn(
            "rounded-xl border bg-card text-card-foreground shadow-sm",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </CardContext.Provider>
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, onClick, ...props }, ref) => {
  const ctx = React.useContext(CardContext);
  const collapsible = !!ctx?.collapsible;
  const closed = collapsible && !ctx!.open;
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex flex-col space-y-1 rounded-t-xl border-b bg-muted/30 px-4 py-3 sm:px-5 [&:last-child]:rounded-b-xl [&:last-child]:border-b-0",
        collapsible && "cursor-pointer pr-12 sm:pr-14",
        closed && "rounded-b-xl border-b-0",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        if (!collapsible || e.defaultPrevented) return;
        // Bấm vào nút/liên kết/ô nhập bên trong header thì không thu gọn.
        if (
          (e.target as HTMLElement).closest(
            "a,button,input,select,textarea,label",
          )
        )
          return;
        ctx!.toggle();
      }}
      {...props}
    >
      {children}
      {collapsible && (
        <button
          type="button"
          onClick={ctx!.toggle}
          aria-expanded={ctx!.open}
          aria-label={ctx!.open ? t`Thu gọn` : t`Mở rộng`}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={ctx!.open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
          </svg>
        </button>
      )}
    </div>
  );
});
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base font-semibold leading-tight sm:text-lg",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const ctx = React.useContext(CardContext);
  const closed = !!ctx?.collapsible && !ctx.open;
  return (
    <div
      ref={ref}
      className={cn("p-4 sm:p-5", closed && "hidden", className)}
      {...props}
    />
  );
});
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const ctx = React.useContext(CardContext);
  const closed = !!ctx?.collapsible && !ctx.open;
  return (
    <ActionArea>
      <div
        ref={ref}
        className={cn(
          "flex items-center border-t px-4 py-3 sm:px-5",
          closed && "hidden",
          className,
        )}
        {...props}
      />
    </ActionArea>
  );
});
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
