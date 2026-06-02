interface Props {
  /** Adds spacing / text alignment classes from the caller. */
  className?: string;
}

/**
 * Renders the baked-in app version + short commit SHA — used in
 * the drawer footer (post-login) and the auth pages (login /
 * signup) so a user reporting a bug can quickly tell support
 * which build they're on. Build date sits in the hover title.
 *
 * The three constants come from vite.config.ts `define`. Format
 * stays in one place so future bumps to layout (e.g. drop the
 * SHA, add a tag) only touch this file.
 */
export function AppVersion({ className }: Props) {
  return (
    <p
      className={`text-[10px] text-muted-foreground/70 font-mono ${className ?? ""}`}
      title={`Build ${__APP_BUILD_DATE__}`}
    >
      v{__APP_VERSION__} · {__APP_COMMIT__}
    </p>
  );
}
