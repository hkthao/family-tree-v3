interface Props {
  className?: string;
  /** Pixel size — applied to both width + height. Default 28. */
  size?: number;
}

/**
 * App logo (con triện). Renders the SVG from /public so a single source
 * (public/icons/app-icon.svg) drives favicon, manifest, AND in-app marks.
 */
export function AppLogo({ className, size = 28 }: Props) {
  return (
    <img
      src="/icons/app-icon.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      draggable={false}
    />
  );
}
