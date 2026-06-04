import { useLocation, useNavigate } from "react-router-dom";

interface Props {
  /**
   * Where to go if there's no in-app history to pop (deep link,
   * refresh, or external entry). Pick the most natural "parent" of
   * the current screen — e.g. the list page for a detail screen.
   */
  fallback: string;
  /** Label shown after the arrow. Defaults to "Quay lại". */
  label?: string;
  className?: string;
}

/**
 * Context-aware back link.
 *
 * Hardcoded `<Link to={listPage}>` back buttons sent users to a list
 * even when they came from a different page — annoying when you
 * just clicked through Tree → Person → Edit and want to land back on
 * the Person, not the People list.
 *
 * React Router stamps each entry in its history stack with a `key`,
 * except the initial entry which gets the literal "default". So
 * `location.key !== "default"` is a reliable test for "the user
 * navigated here from somewhere inside the app" — if so, pop the
 * stack; otherwise use the explicit fallback so deep links / refresh
 * still land somewhere sensible.
 */
export function BackLink({ fallback, label = "Quay lại", className }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const canGoBack = location.key !== "default";

  return (
    <button
      type="button"
      onClick={() => {
        if (canGoBack) navigate(-1);
        else navigate(fallback, { replace: true });
      }}
      className={
        className ??
        "text-sm text-muted-foreground hover:text-foreground hover:underline"
      }
    >
      ← {label}
    </button>
  );
}
