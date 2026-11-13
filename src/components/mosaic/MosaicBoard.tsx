import { useId, useRef, useState } from "react";

import type { MosaicTile } from "@/lib/queries/mosaics";

import {
  CELL,
  TAB_MARGIN,
  cellPath,
  gridRows,
  gridTotal,
  type MosaicVariant,
} from "./jigsaw";

import { t } from "@lingui/core/macro";
type Drag = {
  id: string;
  from: number;
  dx: number;
  dy: number;
  moved: boolean;
};

/**
 * Bức ảnh ghép dạng puzzle (SVG). Mỗi mảnh = ảnh cắt theo viền răng cưa; ô
 * chưa có mảnh hiện ô gỗ. Ở chế độ sắp xếp, kéo mảnh (chuột/cảm ứng) thả vào
 * ô khác để di chuyển / đổi chỗ.
 */
/** Tông màu chung cho ảnh mảnh: bớt rực, ngả ấm. */
const TILE_FILTER = "sepia(0.3) saturate(0.8) contrast(0.95) brightness(1.02)";

/** Bán kính bo góc của bức (đơn vị SVG, 1 ô = 100). */
const BOARD_RADIUS = 7;

const cells0 = (n: number) => Array.from({ length: n }, (_, i) => i);

export function MosaicBoard({
  seed,
  variant,
  cols,
  slots,
  tiles,
  arrange,
  canMove,
  canAdd,
  onSelect,
  onAdd,
  onMove,
}: {
  seed: string;
  variant: MosaicVariant;
  cols: number;
  slots: number;
  tiles: MosaicTile[];
  arrange: boolean;
  canMove: (t: MosaicTile) => boolean;
  canAdd: boolean;
  onSelect: (t: MosaicTile) => void;
  onAdd: (slot: number) => void;
  onMove: (tileId: string, slot: number) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const maxPos = tiles.reduce((m, t) => Math.max(m, t.position), -1);
  const total = gridTotal(maxPos, slots, cols);
  const rows = gridRows(total, cols);
  const W = cols * CELL;
  const H = rows * CELL;
  const bySlot = new Map(tiles.map((t) => [t.position, t]));
  const firstEmpty = cells0(total).find((i) => !bySlot.has(i)) ?? -1;

  /** Toạ độ con trỏ trong hệ SVG. */
  const toSvg = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * (W + 2 * m) - m,
      y: ((e.clientY - rect.top) / rect.height) * (H + 2 * m) - m,
    };
  };
  const slotAt = (x: number, y: number) => {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    return c < 0 || c >= cols || r < 0 || r >= rows || r * cols + c >= total
      ? null
      : r * cols + c;
  };

  const startDrag = (e: React.PointerEvent, t: MosaicTile) => {
    if (!arrange || !canMove(t)) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    origin.current = toSvg(e);
    setDrag({ id: t.id, from: t.position, dx: 0, dy: 0, moved: false });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toSvg(e);
    const dx = p.x - origin.current.x;
    const dy = p.y - origin.current.y;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > 6 });
    setHover(slotAt(p.x, p.y));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const t = tiles.find((x) => x.id === drag.id);
    const p = toSvg(e);
    const target = slotAt(p.x, p.y);
    const moved = drag.moved;
    setDrag(null);
    setHover(null);
    if (!t) return;
    if (!moved) onSelect(t);
    else if (target !== null && target !== drag.from) onMove(t.id, target);
  };

  const cells = Array.from({ length: total }, (_, i) => i);
  const m = CELL * TAB_MARGIN;

  const renderTile = (t: MosaicTile) => {
    const r = Math.floor(t.position / cols);
    const c = t.position % cols;
    const clipId = `${uid}-${t.id}`;
    // Puzzle: ảnh tràn ra để phủ kín răng; Lưới: ảnh vừa đúng ô.
    const pad = variant === "puzzle" ? m : 0;
    const dragging = drag?.id === t.id;
    const movable = arrange && canMove(t);
    return (
      <g
        key={t.id}
        transform={dragging ? `translate(${drag.dx} ${drag.dy})` : undefined}
        opacity={dragging ? 0.9 : t.status === "hidden" ? 0.45 : 1}
        style={{
          cursor: movable ? (dragging ? "grabbing" : "grab") : "pointer",
          touchAction: movable ? "none" : undefined,
        }}
        onPointerDown={(e) => startDrag(e, t)}
        onClick={() => {
          if (!movable) onSelect(t);
        }}
      >
        <clipPath id={clipId}>
          <path d={cellPath(variant, seed, r, c, rows, cols, total)} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={c * CELL - pad}
            y={r * CELL - pad}
            width={CELL + 2 * pad}
            height={CELL + 2 * pad}
            fill="#d9d2c7"
          />
          {t.url && (
            <image
              href={t.url}
              x={c * CELL - pad}
              y={r * CELL - pad}
              width={CELL + 2 * pad}
              height={CELL + 2 * pad}
              preserveAspectRatio="xMidYMid slice"
              // Phủ một tông ấm chung lên mọi ảnh để các mảnh hài hoà.
              style={{ filter: TILE_FILTER }}
            />
          )}
        </g>
        {variant === "puzzle" ? (
          <>
            {/* Viền: bóng mờ bên dưới + nét kem sáng bên trên */}
            <path
              d={cellPath(variant, seed, r, c, rows, cols, total)}
              fill="none"
              stroke="rgba(40,25,10,0.4)"
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <path
              d={cellPath(variant, seed, r, c, rows, cols, total)}
              fill="none"
              stroke="rgba(255,246,228,0.92)"
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </>
        ) : (
          <path
            d={cellPath(variant, seed, r, c, rows, cols, total)}
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={0.8}
          />
        )}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`${-m} ${-m} ${W + 2 * m} ${H + 2 * m}`}
      className="block h-auto w-full select-none"
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={() => {
        setDrag(null);
        setHover(null);
      }}
      role="img"
      aria-label={t`Bức ảnh đại gia đình ghép mảnh`}
    >
      <defs>
        {/* Bo tròn nhẹ bốn góc của cả bức */}
        <clipPath id={`${uid}-board`}>
          <rect width={W} height={H} rx={BOARD_RADIUS} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-board)`}>
        {/* Ô trống: gỗ + răng cưa để nhìn ra chỗ cần ghép */}
        {cells
          .filter((i) => !bySlot.has(i))
          .map((i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const isTarget = hover === i && drag?.moved;
            return (
              <g
                key={i}
                style={{ cursor: canAdd && !arrange ? "pointer" : "default" }}
                onClick={() => canAdd && !arrange && onAdd(i)}
              >
                <path
                  d={cellPath(variant, seed, r, c, rows, cols, total)}
                  fill={isTarget ? "#c9a46b" : "#a9824f"}
                  fillOpacity={isTarget ? 0.9 : 0.55}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={1}
                />
                {canAdd && !arrange && i === firstEmpty && (
                  <text
                    x={c * CELL + CELL / 2}
                    y={r * CELL + CELL / 2 + 8}
                    textAnchor="middle"
                    fontSize={26}
                    fill="#fff"
                    fillOpacity={0.85}
                  >
                    +
                  </text>
                )}
              </g>
            );
          })}
        {tiles.filter((t) => t.id !== drag?.id).map(renderTile)}
        {drag && tiles.filter((t) => t.id === drag.id).map(renderTile)}
      </g>
    </svg>
  );
}
