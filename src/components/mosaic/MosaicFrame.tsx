import type { ReactNode } from "react";

/** Vàng kim của viền thẻ cây gia phả (Tree.tsx) và nét chỉ/góc nhạt hơn. */
const EDGE = "#B8862A";
const INNER = "#D4A94A";

/** Góc chữ L vàng — cùng họa tiết "chạm khắc 4 góc" của thẻ trên cây. */
function CornerL({ className, d }: { className: string; d: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 22 22"
      className={`pointer-events-none absolute h-[22px] w-[22px] ${className}`}
    >
      <path
        d={d}
        fill="none"
        stroke={INNER}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Khung bức ảnh ghép — dùng lại ngôn ngữ thẻ của cây gia phả: nền thẻ
 * (`--tree-card-*`, tự đổi theo sáng/tối), viền vàng bo 4px, đường chỉ mảnh bên
 * trong và bốn góc chữ L.
 */
export function MosaicFrame({ children }: { children: ReactNode }) {
  const card = {
    background: "var(--tree-card-male)",
    color: "var(--tree-card-text)",
    border: `2px solid ${EDGE}`,
    borderRadius: 4,
  } as const;

  return (
    <figure className="mx-auto w-full max-w-5xl">
      <div className="relative p-5 shadow-md sm:p-7" style={card}>
        {/* Đường chỉ mảnh bên trong */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[6px]"
          style={{
            border: `1px solid ${INNER}`,
            opacity: 0.4,
            borderRadius: 2,
          }}
        />
        <CornerL className="left-[5px] top-[5px]" d="M2 14V2H14" />
        <CornerL className="right-[5px] top-[5px]" d="M8 2H20V14" />
        <CornerL className="bottom-[5px] left-[5px]" d="M2 8V20H14" />
        <CornerL className="bottom-[5px] right-[5px]" d="M20 8V20H8" />

        <div className="relative">{children}</div>
      </div>
    </figure>
  );
}
