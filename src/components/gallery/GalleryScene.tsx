import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, SRGBColorSpace, Vector3 } from "three";

import { IconMaximize, IconMinimize } from "@/components/icons";
import { isVideoUrl } from "@/lib/queries/galleryPhotos";
import type { GalleryPhoto } from "@/lib/queries/galleryPhotos";
import { matchesName } from "@/lib/unaccent";
import { ModelPedestal } from "./ModelPedestal";
import { PATTERN_TEXTURES } from "./patternTextures";
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
type Goto = { pos: Vector3; yaw?: number } | null;
type ScenePhoto = GalleryPhoto & { itemId?: string; personId?: string | null };
type ClanMember = { id: string; full_name: string; photo_path: string };
type ModelTransform = {
  rotY?: number;
  pedestalColor?: string;
  metal?: boolean;
  pedestalTexture?: string | null;
  pos?: [number, number]; // [x, z] vị trí đặt tuỳ ý; null = tự xếp
  pedestalStyle?: string; // box | low | tall | podium
};
const PEDESTAL_STYLES: { id: string; name: string }[] = [
  { id: "box", name: "Hộp" },
  { id: "low", name: "Thấp" },
  { id: "tall", name: "Cao" },
  { id: "podium", name: "Nhiều tầng" },
];
// Hoạ tiết bục lấy từ manifest tự sinh (PATTERN_TEXTURES) — xem import ở đầu file.
type SceneModel = {
  itemId: string;
  url: string;
  caption: string | null;
  transform?: unknown;
};
/** Bảng màu/chất liệu bục cho người dùng chọn. */
const PEDESTAL_OPTS: { name: string; color: string; metal: boolean }[] = [
  { name: "Trắng", color: "#ECECEE", metal: false },
  { name: "Đá xám", color: "#9A9A9E", metal: false },
  { name: "Gỗ", color: "#6E4B2C", metal: false },
  { name: "Đen", color: "#2B2B2E", metal: false },
  { name: "Vàng đồng", color: "#B8862A", metal: false },
];
type SaveItem = (
  itemId: string,
  patch: { person_id?: string | null; image_url?: string | null },
) => void | Promise<void>;

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
  frontRef,
}: {
  layout: RoomLayout;
  moveRef: React.MutableRefObject<Move>;
  lookRef: React.MutableRefObject<Look>;
  gotoRef: React.MutableRefObject<Goto>;
  onNear: (i: number) => void;
  /** Điểm trên sàn ~1.8m TRƯỚC MẶT camera (để đặt hiện vật mới ngay chỗ đứng). */
  frontRef: React.MutableRefObject<[number, number]>;
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
      let d = 0;
      if (goto.yaw != null) {
        d = goto.yaw - yaw.current;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        yaw.current += d * 0.12;
        pitch.current += (0 - pitch.current) * 0.12; // ngắm ngang khi tới trước bức
      }
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
      const speed = 2.0 * dt; // chậm vừa phải cho người lớn tuổi dễ điều khiển
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
    // Điểm ~1.8m trước mặt trên sàn (đặt hiện vật mới tại đây).
    frontRef.current = [
      pos.current.x - Math.sin(yaw.current) * 1.8,
      pos.current.z - Math.cos(yaw.current) * 1.8,
    ];

    // Bức đang ở CHÍNH GIỮA tầm nhìn (góc lệch nhỏ nhất) — để caption + nút Ngắm
    // bám đúng bức đang xem, không lấy bức lệch bên. Cách quãng cho nhẹ.
    tick.current += dt;
    if (tick.current > 0.25) {
      tick.current = 0;
      const sy = -Math.sin(yaw.current);
      const cz = -Math.cos(yaw.current);
      let best = -1;
      let bestDot = 0.55; // ngưỡng: phải khá thẳng trước mặt
      for (let i = 0; i < layout.frames.length; i++) {
        const p = layout.frames[i].position;
        const dx = p[0] - pos.current.x;
        const dz = p[2] - pos.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 9) continue;
        const dot = sy * (dx / dist) + cz * (dz / dist);
        if (dot > bestDot) {
          bestDot = dot;
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
  presets = [],
  presetId,
  onPreset,
  canEdit = false,
  members = [],
  onSaveItem,
  models = [],
  onAddModel,
  onDeleteItem,
  onSaveModel,
  onRoomColor,
  onRoomColorCommit,
}: {
  photos: ScenePhoto[];
  pal: GalleryPalette;
  presets?: { id: string; name: string; swatch: string }[];
  presetId?: string;
  onPreset?: (id: string) => void;
  canEdit?: boolean;
  members?: ClanMember[];
  onSaveItem?: SaveItem;
  models?: SceneModel[];
  onAddModel?: (url: string, pos?: [number, number]) => void | Promise<void>;
  onDeleteItem?: (itemId: string) => void | Promise<void>;
  onSaveModel?: (
    itemId: string,
    transform: ModelTransform,
  ) => void | Promise<void>;
  /** Đổi màu phòng tuỳ ý (live preview). field: wall/ceiling/floor/bg. */
  onRoomColor?: (field: string, value: string) => void;
  /** Lưu màu phòng (gọi khi rời ô chọn màu). */
  onRoomColorCommit?: () => void;
}) {
  const layout = useMemo(() => placePhotos(photos), [photos]);
  const total = layout.frames.length;
  const [near, setNear] = useState(0);
  const [detail, setDetail] = useState<ScenePhoto | null>(null);
  const [fs, setFs] = useState(false);
  const [addModelUrl, setAddModelUrl] = useState<string | null>(null); // null=đóng
  const [showRoomColors, setShowRoomColors] = useState(false);
  // Đang sửa hiện vật 3D nào (xoay/màu bục). null = không sửa.
  const [editModel, setEditModel] = useState<{
    itemId: string;
    rotY: number;
    pedestalColor: string;
    metal: boolean;
    pedestalTexture: string | null;
    pos: [number, number] | null;
    pedStyle: string;
  } | null>(null);
  const [placing, setPlacing] = useState(false); // đang chờ chạm sàn để đặt hiện vật
  useEffect(() => {
    if (!editModel) setPlacing(false);
  }, [editModel]);

  const moveRef = useRef<Move>({ f: 0, s: 0 });
  const lookRef = useRef<Look>({ dx: 0, dy: 0 });
  const gotoRef = useRef<Goto>(null);
  const dragged = useRef(false);
  const drag = useRef({ active: false, x: 0, y: 0 });
  const frontRef = useRef<[number, number]>([0, 0]); // điểm trước mặt để đặt hiện vật mới
  const detailOpen = useRef(false);
  useEffect(() => {
    detailOpen.current = !!detail;
    if (detail) moveRef.current = { f: 0, s: 0 };
  }, [detail]);

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
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!MOVE.includes(k)) return;
      if (isTyping() || detailOpen.current) return; // đang gõ / xem ảnh → không đi lại
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
    if (!dragged.current) setDetail(p as ScenePhoto);
  }, []);

  // Đến ĐỐI DIỆN + căn giữa CẢ CỤM chứa bức idx: tính bao của các khung cùng
  // cụm, lấy tâm, lùi vuông góc đủ xa để nhìn trọn cụm (không lệch theo 1 bức).
  const walkTo = useCallback(
    (idx: number) => {
      const f = layout.frames[idx];
      if (!f) return;
      const group = layout.frames.filter((g) => g.cluster === f.cluster);
      let minZ = Infinity;
      let maxZ = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const g of group) {
        minZ = Math.min(minZ, g.position[2] - g.w / 2);
        maxZ = Math.max(maxZ, g.position[2] + g.w / 2);
        minY = Math.min(minY, g.position[1] - g.h / 2);
        maxY = Math.max(maxY, g.position[1] + g.h / 2);
      }
      const cz = (minZ + maxZ) / 2;
      const cy = (minY + maxY) / 2;
      const extZ = maxZ - minZ;
      const extY = maxY - minY;
      // Lùi đủ xa để cụm lọt khung nhìn (fov ~68°, ước lượng tỉ lệ ngang 1.3).
      const vfov = (68 * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * 1.3);
      const dY = extY / 2 / Math.tan(vfov / 2);
      const dZ = extZ / 2 / Math.tan(hfov / 2);
      const D = Math.max(2.4, Math.max(dY, dZ) * 1.12 + 0.5);
      const wallX = f.position[0];
      const pos = new Vector3(wallX - Math.sign(wallX) * D, cy, cz);
      gotoRef.current = { pos, yaw: f.rotationY };
      setNear(idx);
    },
    [layout],
  );
  const go = (d: number) => walkTo((near + d + total) % total);

  // Nhấp đúp lên sàn → tự đi tới điểm đó (dễ cho người lớn tuổi).
  const walkToPoint = useCallback(
    (pt: { x: number; z: number }) => {
      const halfW = layout.width / 2 + 0.12;
      const x = clamp(pt.x, -halfW + 0.6, halfW - 0.6);
      const z = clamp(pt.z, -0.6, layout.length + 0.6);
      gotoRef.current = { pos: new Vector3(x, EYE, z) };
    },
    [layout],
  );

  // Đang "Di chuyển" hiện vật → chạm sàn để đặt hiện vật tại đó.
  const placeOnFloor = (pt: { x: number; z: number }) => {
    if (!placing || !editModel) return;
    const halfW = layout.width / 2 + 0.12;
    const x = clamp(pt.x, -halfW + 0.5, halfW - 0.5);
    const z = clamp(pt.z, -0.5, layout.length + 0.5);
    setEditModel((s) => (s ? { ...s, pos: [x, z] } : s));
    setPlacing(false);
  };

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
    "pointer-events-auto inline-flex h-8 items-center justify-center rounded-md border bg-card/90 px-2.5 text-xs text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card";

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
        <Room
          layout={layout}
          colors={pal}
          onFloorDoubleClick={walkToPoint}
          onFloorClick={placeOnFloor}
        />
        {layout.frames.map((f) => (
          <PhotoFrame
            key={f.photo.id}
            frame={f}
            matColor={pal.placeholder}
            onSelect={openDetail}
          />
        ))}
        {/* Hiện vật 3D trên bục — xen kẽ hai bên trục giữa, rải dọc phòng. */}
        {models.map((m, i) => {
          const editing = editModel?.itemId === m.itemId;
          const t = (m.transform ?? {}) as ModelTransform;
          const rotY = editing ? editModel.rotY : (t.rotY ?? 0);
          const pedestalColor = editing
            ? editModel.pedestalColor
            : (t.pedestalColor ?? pal.frame);
          const metal = editing ? editModel.metal : (t.metal ?? false);
          const textureUrl = editing
            ? editModel.pedestalTexture
            : (t.pedestalTexture ?? null);
          const pos = editing ? editModel.pos : (t.pos ?? null);
          const pedStyle = editing ? editModel.pedStyle : (t.pedestalStyle ?? "box");
          const position: [number, number, number] = pos
            ? [pos[0], 0, pos[1]]
            : [
                i % 2 === 0 ? -1.35 : 1.35,
                0,
                ((i + 1) / (models.length + 1)) * layout.length,
              ];
          return (
            <ModelPedestal
              key={m.itemId}
              url={m.url}
              rotY={rotY}
              pedestalColor={pedestalColor}
              metal={metal}
              textureUrl={textureUrl}
              pedStyle={pedStyle}
              position={position}
              onSelect={
                canEdit
                  ? () =>
                      setEditModel({
                        itemId: m.itemId,
                        rotY: t.rotY ?? 0,
                        pedestalColor: t.pedestalColor ?? pal.frame,
                        metal: t.metal ?? false,
                        pedestalTexture: t.pedestalTexture ?? null,
                        pos: t.pos ?? null,
                        pedStyle: t.pedestalStyle ?? "box",
                      })
                  : undefined
              }
            />
          );
        })}
        <FirstPerson
          layout={layout}
          moveRef={moveRef}
          lookRef={lookRef}
          gotoRef={gotoRef}
          onNear={onNear}
          frontRef={frontRef}
        />
      </Canvas>

      {/* Thêm hiện vật 3D (admin): panel dán URL GLB/GLTF */}
      {canEdit && onAddModel && addModelUrl !== null && (
        <div
          data-ui
          className="absolute left-1/2 top-14 z-20 w-[min(22rem,80%)] -translate-x-1/2 space-y-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xl"
        >
          <div className="text-sm font-medium">Thêm hiện vật 3D (GLB/GLTF)</div>
          <input
            value={addModelUrl}
            onChange={(e) => setAddModelUrl(e.target.value)}
            placeholder="Dán URL file .glb / .gltf (https://…)"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-primary"
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            File phải cho phép CORS (Poly Haven, Sketchfab CC0…). Không nhận link
            trang, chỉ link file .glb/.gltf trực tiếp.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!/^https?:\/\/.+/.test((addModelUrl ?? "").trim())}
              onClick={() => {
                const u = (addModelUrl ?? "").trim();
                if (/^https?:\/\/.+/.test(u)) {
                  const halfW = layout.width / 2 + 0.12;
                  const [fx, fz] = frontRef.current;
                  const pos: [number, number] = [
                    clamp(fx, -halfW + 0.5, halfW - 0.5),
                    clamp(fz, -0.5, layout.length + 0.5),
                  ];
                  onAddModel(u, pos);
                  setAddModelUrl(null);
                }
              }}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
            >
              Thêm
            </button>
            <button
              type="button"
              onClick={() => setAddModelUrl(null)}
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Góc trên phải: chọn tông phòng + toàn màn hình */}
      <div data-ui className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {canEdit && onAddModel && (
          <button
            type="button"
            onClick={() => setAddModelUrl((v) => (v === null ? "" : null))}
            title="Thêm hiện vật 3D"
            className="inline-flex h-8 items-center gap-1 rounded-md border bg-card/90 px-2.5 text-xs text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card"
          >
            + 3D
          </button>
        )}
        {presets.length > 0 && (
          <div className="flex items-center gap-1 rounded-md border bg-card/90 px-1.5 py-1 shadow-sm backdrop-blur">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPreset?.(p.id)}
                title={p.name}
                aria-label={`Tông phòng: ${p.name}`}
                className={`h-4 w-4 rounded-full border transition ${
                  p.id === presetId
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                    : "border-border hover:scale-110"
                }`}
                style={{ background: p.swatch }}
              />
            ))}
          </div>
        )}
        {canEdit && onRoomColor && (
          <button
            type="button"
            onClick={() => setShowRoomColors((v) => !v)}
            title="Màu phòng tuỳ chỉnh"
            className="inline-flex h-8 items-center rounded-md border bg-card/90 px-2.5 text-xs text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card"
          >
            Màu
          </button>
        )}
        <button
          type="button"
          onClick={() => setFs((v) => !v)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card/90 text-foreground shadow-sm backdrop-blur hover:border-primary hover:bg-card"
          aria-label={fs ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
          title={fs ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
        >
          {fs ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
        </button>
      </div>

      {/* Bảng màu phòng tuỳ chỉnh (admin) */}
      {canEdit && onRoomColor && showRoomColors && (
        <div
          data-ui
          className="absolute right-3 top-14 z-20 w-52 space-y-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xl"
        >
          <div className="text-sm font-medium">Màu phòng tuỳ chỉnh</div>
          {(
            [
              ["wall", "Tường"],
              ["ceiling", "Trần"],
              ["floor", "Sàn"],
              ["bg", "Nền"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <input
                type="color"
                value={(pal[field] ?? "#cccccc").slice(0, 7)}
                onChange={(e) => onRoomColor(field, e.target.value)}
                onBlur={() => onRoomColorCommit?.()}
                className="h-7 w-12 cursor-pointer rounded border bg-transparent"
              />
            </label>
          ))}
          <p className="text-[11px] leading-snug text-muted-foreground">
            Kéo chọn màu bất kỳ; hoặc dùng các "tông phòng" có sẵn ở trên.
          </p>
        </div>
      )}

      {/* Joystick đi lại (điện thoại) */}
      <Joystick onMove={(f, s) => (moveRef.current = { f, s })} />

      {/* Hướng dẫn */}
      <div
        data-ui
        className="pointer-events-none absolute left-3 top-3 max-w-[40%] rounded-lg border bg-background/85 px-2.5 py-1.5 text-xs leading-snug text-muted-foreground shadow-sm backdrop-blur"
      >
        <span className="hidden sm:inline">
          Kéo nhìn · WASD/<b className="text-foreground">nhấp đúp sàn</b> để đi · chạm khung xem
        </span>
        <span className="sm:hidden">
          Kéo nhìn · <b className="text-foreground">chạm đúp sàn</b> để đi
        </span>
      </div>

      {/* Caption + ◀ ▶ */}
      {frame && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3">
          <div
            data-ui
            className="pointer-events-auto max-w-full truncate rounded-lg border bg-background/85 px-3 py-1 text-center text-xs shadow-sm backdrop-blur"
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
            <button
              type="button"
              className={btn}
              onClick={() => walkTo(near)}
              title="Đến vị trí ngắm đẹp bức này"
              aria-label="Đến vị trí ngắm đẹp"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1 h-4 w-4"
              >
                <circle cx="12" cy="12" r="8" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              Ngắm
            </button>
            <button type="button" className={btn} onClick={() => setDetail(frame.photo)}>
              Xem ảnh
            </button>
            <button type="button" className={btn} onClick={() => go(1)} aria-label="Bức sau">
              ▶
            </button>
          </div>
        </div>
      )}

      {/* Xem chi tiết (+ sửa item nếu là admin/editor) — modal card */}
      {detail && (
        <div
          data-ui
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92%] w-full max-w-lg flex-col rounded-xl border bg-card text-card-foreground shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate font-semibold">
                  {detail.title || "Ảnh kỷ niệm"}
                </div>
                {detail.subtitle && (
                  <div className="truncate text-xs text-muted-foreground">
                    {detail.subtitle}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Đóng"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {/* Body */}
            <div className="space-y-4 overflow-y-auto p-4">
              {isVideoUrl(detail.url) ? (
                <video
                  src={detail.url}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="mx-auto max-h-[52vh] w-auto max-w-full rounded-lg"
                />
              ) : (
                <img
                  src={detail.url}
                  alt={detail.title}
                  className="mx-auto max-h-[52vh] w-auto max-w-full rounded-lg object-contain"
                />
              )}
              {canEdit && detail.itemId && onSaveItem && (
                <EditItemPanel
                  key={detail.itemId}
                  itemId={detail.itemId}
                  currentUrl={detail.personId ? "" : detail.url}
                  members={members}
                  onSave={async (patch) => {
                    await onSaveItem(detail.itemId!, patch);
                    setDetail(null);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sửa hiện vật 3D (admin): xoay + màu/chất liệu bục */}
      {editModel && (
        <div
          data-ui
          className="absolute bottom-3 left-1/2 z-20 w-[min(24rem,90%)] -translate-x-1/2 space-y-3 rounded-xl border bg-card p-3 text-card-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Chỉnh hiện vật 3D</span>
            <button
              type="button"
              onClick={() => setEditModel(null)}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>

          {/* Xoay */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Xoay hướng: {Math.round((editModel.rotY * 180) / Math.PI)}°
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={Math.round((editModel.rotY * 180) / Math.PI)}
              onChange={(e) =>
                setEditModel((s) =>
                  s ? { ...s, rotY: (Number(e.target.value) * Math.PI) / 180 } : s,
                )
              }
              className="w-full"
            />
          </div>

          {/* Kiểu bục */}
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Kiểu bục</div>
            <div className="flex flex-wrap gap-1.5">
              {PEDESTAL_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setEditModel((m) => (m ? { ...m, pedStyle: s.id } : m))
                  }
                  className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs ${
                    editModel.pedStyle === s.id
                      ? "border-primary text-primary"
                      : "hover:border-primary/60"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Màu / chất liệu bục */}
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Màu bục</div>
            <div className="flex flex-wrap items-center gap-2">
              {PEDESTAL_OPTS.map((o) => (
                <button
                  key={o.name}
                  type="button"
                  onClick={() =>
                    setEditModel((s) =>
                      s ? { ...s, pedestalColor: o.color, metal: o.metal } : s,
                    )
                  }
                  title={o.name}
                  className={`h-6 w-6 rounded-full border transition ${
                    editModel.pedestalColor === o.color
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      : "hover:scale-110"
                  }`}
                  style={{ background: o.color }}
                />
              ))}
              {/* Chọn màu tự do */}
              <input
                type="color"
                value={editModel.pedestalColor.slice(0, 7)}
                onChange={(e) =>
                  setEditModel((s) =>
                    s ? { ...s, pedestalColor: e.target.value } : s,
                  )
                }
                title="Chọn màu bất kỳ"
                className="h-6 w-8 cursor-pointer rounded border bg-transparent"
              />
            </div>
          </div>

          {/* Chất liệu bục (hoạ tiết SVG) — nhiều mẫu, cuộn để chọn */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Hoạ tiết ({PATTERN_TEXTURES.length})</span>
              <button
                type="button"
                onClick={() =>
                  setEditModel((s) => (s ? { ...s, pedestalTexture: null } : s))
                }
                className={`rounded border px-2 py-0.5 ${
                  editModel.pedestalTexture === null
                    ? "border-primary text-primary"
                    : ""
                }`}
              >
                Màu trơn
              </button>
            </div>
            <div className="grid max-h-28 grid-cols-6 gap-1.5 overflow-y-auto rounded-md border p-1.5">
              {PATTERN_TEXTURES.map((w) => (
                <button
                  key={w.url}
                  type="button"
                  onClick={() =>
                    setEditModel((s) =>
                      s ? { ...s, pedestalTexture: w.url } : s,
                    )
                  }
                  title={w.name}
                  className={`aspect-square overflow-hidden rounded border bg-white transition ${
                    editModel.pedestalTexture === w.url
                      ? "ring-2 ring-primary"
                      : "hover:scale-105"
                  }`}
                >
                  <img
                    src={w.url}
                    alt={w.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlacing((v) => !v)}
              className={`inline-flex h-8 items-center rounded-md border px-3 text-sm ${
                placing ? "border-primary text-primary" : ""
              }`}
            >
              {placing ? "Chạm sàn để đặt…" : "Di chuyển"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await onSaveModel?.(editModel.itemId, {
                  rotY: editModel.rotY,
                  pedestalColor: editModel.pedestalColor,
                  metal: editModel.metal,
                  pedestalTexture: editModel.pedestalTexture,
                  pos: editModel.pos ?? undefined,
                  pedestalStyle: editModel.pedStyle,
                });
                setEditModel(null);
              }}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm("Xoá hiện vật 3D này?")) {
                  await onDeleteItem?.(editModel.itemId);
                  setEditModel(null);
                }
              }}
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-destructive hover:bg-destructive/10"
            >
              Xoá
            </button>
            <button
              type="button"
              onClick={() => setEditModel(null)}
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Panel sửa item (admin): dán URL ảnh ngoài, hoặc chọn lại ảnh thành viên. */
function EditItemPanel({
  itemId,
  currentUrl,
  members,
  onSave,
}: {
  itemId: string;
  currentUrl: string;
  members: ClanMember[];
  onSave: (patch: {
    person_id?: string | null;
    image_url?: string | null;
  }) => Promise<void>;
}) {
  const [url, setUrl] = useState(currentUrl);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  void itemId;
  const matches = useMemo(
    () =>
      q.trim()
        ? members.filter((m) => matchesName(m.full_name, q)).slice(0, 20)
        : [],
    [members, q],
  );
  const run = async (patch: {
    person_id?: string | null;
    image_url?: string | null;
  }) => {
    setBusy(true);
    try {
      await onSave(patch);
    } finally {
      setBusy(false);
    }
  };
  const urlOk = /^https?:\/\/.+/.test(url.trim());

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="text-sm font-medium text-foreground">
        Thay ảnh / video cho khung này
      </div>

      {/* Dán URL ảnh ngoài — nút Áp dụng là icon outline nằm TRONG ô input */}
      <div className="relative">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Dán URL ảnh hoặc video (https://…)"
          className="h-9 w-full rounded-md border border-input bg-background pl-2.5 pr-9 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!urlOk || busy}
          onClick={() => run({ image_url: url.trim(), person_id: null })}
          title={urlOk ? "Áp dụng URL này" : "Dán URL ảnh hợp lệ (https://…)"}
          aria-label="Áp dụng URL này"
          className={`absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded transition-colors ${
            urlOk
              ? "text-red-600 hover:bg-red-500/15 dark:text-red-500"
              : "cursor-not-allowed text-muted-foreground/40"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Video nên dùng <b>link .mp4 trực tiếp</b> (chuột phải video đang phát →
        “Copy video address”). Link trang chia sẻ có thể không hiện trên tường.
      </p>

      {/* Hoặc chọn ảnh thành viên khác — dropdown NỔI (absolute) để không đẩy panel */}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hoặc tìm thành viên (có ảnh) để thay…"
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-primary"
        />
        {matches.length > 0 && (
          <ul className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-52 divide-y overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run({ person_id: m.id, image_url: null })}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
                >
                  {m.full_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
