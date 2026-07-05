import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, SRGBColorSpace, Vector3 } from "three";

import { IconMaximize, IconMinimize } from "@/components/icons";
import type { GalleryPhoto } from "@/lib/queries/galleryPhotos";
import { PhotoFrame } from "./PhotoFrame";
import { EYE, placePhotos, type RoomLayout } from "./placement";
import { Room } from "./Room";

export type GalleryPalette = {
  bg: string; // màu sương mù (fog)
  bgTop: string; // nền gradient — trên
  bgBottom: string; // nền gradient — dưới
  floor: string;
  wall: string;
  ceiling: string;
  frame: string;
  placeholder: string;
};

type Move = { f: number; s: number };
type Look = { dx: number; dy: number };
type Goto = { pos: Vector3; yaw: number } | null;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Nền gradient (thay nền đen thuần) — đặt làm scene.background. */
function GradientBackground({ top, bottom }: { top: string; bottom: string }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const prev = scene.background;
    scene.background = tex;
    return () => {
      scene.background = prev;
      tex.dispose();
    };
  }, [scene, top, bottom]);
  return null;
}

/**
 * Điều khiển ngôi thứ nhất: kéo để nhìn quanh, phím/joystick để đi; va chạm
 * tường (kẹp trong phòng). Khi bấm ◀ ▶ (gotoRef) thì tự bước tới trước bức đó.
 */
function FirstPerson({
  layout,
  moveRef,
  lookRef,
  gotoRef,
  onNear,
}: {
  layout: RoomLayout;
  moveRef: React.MutableRefObject<Move>;
  lookRef: React.MutableRefObject<Look>;
  gotoRef: React.MutableRefObject<Goto>;
  onNear: (i: number) => void;
}) {
  const { camera } = useThree();
  const yaw = useRef(Math.PI); // nhìn dọc hành lang (+Z)
  const pitch = useRef(0);
  const pos = useRef(new Vector3(0, EYE, layout.length * 0.1));
  const fwd = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const tick = useRef(0);

  const halfW = layout.width / 2 + 0.12;
  const minX = -halfW + 0.6;
  const maxX = halfW - 0.6;
  const minZ = -0.6;
  const maxZ = layout.length + 0.6;

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const goto = gotoRef.current;
    if (goto) {
      pos.current.lerp(goto.pos, 0.09);
      let d = goto.yaw - yaw.current;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      yaw.current += d * 0.12;
      pitch.current += (0 - pitch.current) * 0.12;
      if (pos.current.distanceTo(goto.pos) < 0.06 && Math.abs(d) < 0.02)
        gotoRef.current = null;
    } else {
      yaw.current -= lookRef.current.dx * 0.004;
      pitch.current = clamp(
        pitch.current - lookRef.current.dy * 0.004,
        -1.1,
        1.1,
      );
      lookRef.current.dx = 0;
      lookRef.current.dy = 0;
      fwd.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
      right.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
      const speed = 3.4 * dt;
      const m = moveRef.current;
      pos.current
        .addScaledVector(fwd, m.f * speed)
        .addScaledVector(right, m.s * speed);
      pos.current.x = clamp(pos.current.x, minX, maxX);
      pos.current.z = clamp(pos.current.z, minZ, maxZ);
      pos.current.y = EYE;
    }
    camera.position.copy(pos.current);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");

    // Tìm bức đang ở trước mặt (cho caption) — cách quãng cho nhẹ.
    tick.current += dt;
    if (tick.current > 0.3) {
      tick.current = 0;
      const sy = -Math.sin(yaw.current);
      const cz = -Math.cos(yaw.current);
      let best = -1;
      let bestScore = Infinity;
      for (let i = 0; i < layout.frames.length; i++) {
        const p = layout.frames[i].position;
        const dx = p[0] - pos.current.x;
        const dz = p[2] - pos.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 7) continue;
        const dot = sy * (dx / dist) + cz * (dz / dist);
        if (dot < 0.35) continue;
        const score = dist / dot;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best >= 0) onNear(best);
    }
  });
  return null;
}

/**
 * Cảnh phòng trưng bày (R3F). Tách riêng để lazy-load → gói three/R3F thành
 * chunk riêng, không nằm trong bundle chính.
 */
export function GalleryScene({
  photos,
  pal,
}: {
  photos: GalleryPhoto[];
  pal: GalleryPalette;
}) {
  const layout = useMemo(() => placePhotos(photos), [photos]);
  const total = layout.frames.length;
  const [near, setNear] = useState(0);
  const [detail, setDetail] = useState<GalleryPhoto | null>(null);
  const [fs, setFs] = useState(false);

  const moveRef = useRef<Move>({ f: 0, s: 0 });
  const lookRef = useRef<Look>({ dx: 0, dy: 0 });
  const gotoRef = useRef<Goto>(null);
  const dragged = useRef(false);
  const drag = useRef({ active: false, x: 0, y: 0 });

  // Esc thoát toàn màn hình.
  useEffect(() => {
    if (!fs) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setFs(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [fs]);

  // Phím WASD / mũi tên để đi.
  useEffect(() => {
    const keys = new Set<string>();
    const MOVE = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    const apply = () => {
      const f =
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const s =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      moveRef.current = { f, s };
    };
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!MOVE.includes(k)) return;
      if (k.startsWith("arrow")) e.preventDefault();
      keys.add(k);
      apply();
    };
    const ku = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      apply();
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  const onNear = useCallback(
    (i: number) => setNear((prev) => (prev === i ? prev : i)),
    [],
  );
  const openDetail = useCallback((p: GalleryPhoto) => {
    if (!dragged.current) setDetail(p);
  }, []);

  // Bước tới trước một bức (dùng cho ◀ ▶).
  const walkTo = useCallback(
    (idx: number) => {
      const f = layout.frames[idx];
      if (!f) return;
      const p = new Vector3(f.viewFrom[0], f.viewFrom[1], f.viewFrom[2]);
      const dx = f.position[0] - p.x;
      const dz = f.position[2] - p.z;
      gotoRef.current = { pos: p, yaw: Math.atan2(-dx, -dz) };
      setNear(idx);
    },
    [layout],
  );
  const go = (d: number) => walkTo((near + d + total) % total);

  // Kéo (chuột/chạm) để nhìn quanh — bỏ qua khi bấm trúng nút (data-ui).
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    drag.current = { active: true, x: e.clientX, y: e.clientY };
    dragged.current = false;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
    lookRef.current.dx += dx;
    lookRef.current.dy += dy;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true;
  };
  const onUp = () => {
    drag.current.active = false;
  };

  const frame = layout.frames[near];
  const btn =
    "pointer-events-auto inline-flex h-9 items-center justify-center rounded-md border bg-card/90 px-3 text-sm text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card";

  return (
    <div
      className={
        fs ? "fixed inset-0 z-[60] bg-background" : "relative h-full w-full"
      }
      style={{ touchAction: "none", cursor: "grab" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <Canvas shadows="percentage" dpr={[1, 1.5]} camera={{ fov: 68 }}>
        <GradientBackground top={pal.bgTop} bottom={pal.bgBottom} />
        <fog attach="fog" args={[pal.bg, 22, 70]} />
        <ambientLight intensity={1.15} />
        <hemisphereLight args={[pal.ceiling, pal.floor, 0.9]} />
        <directionalLight
          position={[5, 10, 6]}
          intensity={0.45}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-camera-far={45}
        />
        <Room layout={layout} colors={pal} />
        {layout.frames.map((f) => (
          <PhotoFrame
            key={f.photo.id}
            frame={f}
            matColor={pal.placeholder}
            onSelect={openDetail}
          />
        ))}
        <FirstPerson
          layout={layout}
          moveRef={moveRef}
          lookRef={lookRef}
          gotoRef={gotoRef}
          onNear={onNear}
        />
      </Canvas>

      {/* Nút toàn màn hình */}
      <button
        data-ui
        type="button"
        onClick={() => setFs((v) => !v)}
        className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card/90 text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card"
        aria-label={fs ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
        title={fs ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
      >
        {fs ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
      </button>

      {/* Joystick đi lại (điện thoại) */}
      <Joystick onMove={(f, s) => (moveRef.current = { f, s })} />

      {/* Hướng dẫn */}
      <div
        data-ui
        className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-lg border bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur"
      >
        <span className="hidden sm:inline">
          Kéo chuột để nhìn quanh · W A S D / phím mũi tên để đi · chạm khung để xem ảnh.
        </span>
        <span className="sm:hidden">
          Kéo để nhìn · dùng cần joystick để đi · chạm khung để xem ảnh.
        </span>
      </div>

      {/* Caption + ◀ ▶ */}
      {frame && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
          <div
            data-ui
            className="pointer-events-auto max-w-full truncate rounded-lg border bg-background/85 px-3 py-1.5 text-center text-sm shadow-sm backdrop-blur"
          >
            <span className="font-medium text-foreground">{frame.photo.title}</span>
            {frame.photo.subtitle && (
              <span className="ml-2 text-muted-foreground">{frame.photo.subtitle}</span>
            )}
          </div>
          <div data-ui className="pointer-events-auto flex items-center gap-2">
            <button type="button" className={btn} onClick={() => go(-1)} aria-label="Bức trước">
              ◀
            </button>
            <span className="rounded-md bg-background/80 px-2 py-1 text-xs tabular-nums text-muted-foreground backdrop-blur">
              {near + 1}/{total}
            </span>
            <button type="button" className={btn} onClick={() => setDetail(frame.photo)}>
              Xem ảnh
            </button>
            <button type="button" className={btn} onClick={() => go(1)} aria-label="Bức sau">
              ▶
            </button>
          </div>
        </div>
      )}

      {/* Xem chi tiết */}
      {detail && (
        <button
          data-ui
          type="button"
          onClick={() => setDetail(null)}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
          aria-label="Đóng"
        >
          <img
            src={detail.url}
            alt={detail.title}
            className="max-h-[78%] max-w-full rounded-lg object-contain shadow-2xl"
          />
          <div className="text-center text-white">
            <div className="font-semibold">{detail.title}</div>
            {detail.subtitle && (
              <div className="text-sm text-white/70">{detail.subtitle}</div>
            )}
          </div>
          <span className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
            ✕
          </span>
        </button>
      )}
    </div>
  );
}

/** Cần điều khiển ảo (điện thoại) → viết vector di chuyển vào moveRef. */
function Joystick({ onMove }: { onMove: (f: number, s: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 42;
  const handle = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let ox = e.clientX - (r.left + r.width / 2);
    let oy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(ox, oy) || 1;
    if (len > R) {
      ox = (ox / len) * R;
      oy = (oy / len) * R;
    }
    setKnob({ x: ox, y: oy });
    onMove(-oy / R, ox / R);
  };
  const end = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      data-ui
      ref={ref}
      onPointerDown={(e) => {
        active.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        handle(e);
      }}
      onPointerMove={(e) => active.current && handle(e)}
      onPointerUp={end}
      onPointerCancel={end}
      className="pointer-events-auto absolute bottom-3 left-3 z-10 h-28 w-28 touch-none rounded-full border bg-background/60 backdrop-blur sm:hidden"
    >
      <div
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-primary/70"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
    </div>
  );
}
