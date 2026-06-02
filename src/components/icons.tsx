/**
 * Inline stroke icons (Lucide-style). No runtime dependency — just SVG
 * with currentColor so each icon inherits the surrounding text colour.
 *
 * Every icon accepts an optional `className` so callers can size + tint
 * it (`h-4 w-4`, `text-destructive`, etc.). All icons render with
 * aria-hidden by default; provide an external label if the icon is the
 * only interactive cue.
 */

interface IconProps {
  className?: string;
}

function Svg({
  children,
  className = "h-4 w-4",
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

export function IconPencil(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </Svg>
  );
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

export function IconUpload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </Svg>
  );
}

export function IconLogIn(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </Svg>
  );
}

export function IconLogOut(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function IconUserPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </Svg>
  );
}

export function IconCopy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export function IconUnlock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </Svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  );
}

export function IconList(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </Svg>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </Svg>
  );
}

export function IconLayoutVertical(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="14" width="6" height="5" rx="1" />
      <rect x="15" y="14" width="6" height="5" rx="1" />
      <path d="M12 8 V11 M6 14 V11 H18 V14" />
    </Svg>
  );
}

export function IconLayoutHorizontal(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="9" width="5" height="6" rx="1" />
      <rect x="14" y="3" width="5" height="6" rx="1" />
      <rect x="14" y="15" width="5" height="6" rx="1" />
      <path d="M8 12 H11 M14 6 H11 V18 H14" />
    </Svg>
  );
}

export function IconUndo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </Svg>
  );
}

export function IconTree(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="4" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="6" cy="20" r="2" />
      <circle cx="18" cy="20" r="2" />
      <line x1="12" y1="6" x2="6" y2="10" />
      <line x1="12" y1="6" x2="18" y2="10" />
      <line x1="6" y1="14" x2="6" y2="18" />
      <line x1="18" y1="14" x2="18" y2="18" />
    </Svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  );
}

export function IconBellOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

export function IconPrinter(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </Svg>
  );
}

export function IconSun(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </Svg>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
}

export function IconPhoneDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
      <path d="M12 8v6" />
      <path d="m9 11 3 3 3-3" />
    </Svg>
  );
}
