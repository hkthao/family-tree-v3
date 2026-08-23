import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface ActionRouted {
  label: string;
  to: string;
  icon?: React.ReactNode;
}

interface ActionClick {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

type Action = ActionRouted | ActionClick;

interface Props {
  /**
   * Large illustrative icon. Pass a sized icon component, e.g.
   *   <IconUsers className="h-12 w-12" />
   * Wrapped in a circle background here.
   */
  icon?: React.ReactNode;
  title: string;
  /** Optional second line under the title; can include markup. */
  description?: React.ReactNode;
  /** Primary CTA (filled button). */
  primary?: Action | null;
  /** Secondary CTA (outline button). */
  secondary?: Action | null;
  /** Tertiary CTA — extra option alongside the primary path.
   * Rendered as an outline button (same weight as secondary) so all
   * non-primary actions sit at the same visual level. */
  tertiary?: Action | null;
}

/**
 * Centered empty-state card used wherever a list, page, or section
 * has nothing to show yet. Replaces ad-hoc "Chưa có…" paragraphs so
 * the cream paper card + seal-red title + CTA are consistent across
 * pages. Pure presentation — caller passes title / description / icon
 * / actions; no internal state.
 */
export function EmptyState({ icon, title, description, primary, secondary, tertiary }: Props) {
  return (
    <div className="rounded-lg border bg-card text-center py-10 sm:py-14 px-6 space-y-4">
      {icon && (
        <div
          aria-hidden="true"
          className="mx-auto h-20 w-20 rounded-full bg-muted/40 inline-flex items-center justify-center text-muted-foreground"
        >
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="clan-name text-xl font-semibold text-primary">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {description}
          </p>
        )}
      </div>
      {(primary || secondary || tertiary) && (
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {primary && renderAction(primary, "default")}
          {secondary && renderAction(secondary, "outline")}
          {tertiary && renderAction(tertiary, "outline")}
        </div>
      )}
    </div>
  );
}

function renderAction(a: Action, variant: "default" | "outline") {
  const content = (
    <>
      {a.icon}
      {a.label}
    </>
  );
  // icon-audit: ok — `content` do nơi gọi truyền vào, đã gồm icon nếu cần
  if ("to" in a) {
    return (
      <Button asChild variant={variant}>
        <Link to={a.to}>{content}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={a.onClick}>
      {content}
    </Button>
  );
}
