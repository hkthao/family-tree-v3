import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Box3,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from "three";

/** Bắt lỗi khi GLB hỏng/không tải được → không làm sập cả phòng. */
class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Nạp GLB/GLTF, tự canh: căn giữa + đặt đáy tại y=0, thu về chiều cao mục tiêu. */
function GltfModel({ url, targetH }: { url: string; targetH: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  const { s, px, py, pz } = useMemo(() => {
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetH / maxDim;
    return {
      s: scale,
      px: -center.x * scale,
      py: -box.min.y * scale,
      pz: -center.z * scale,
    };
  }, [model, targetH]);
  return (
    <group scale={s} position={[px / s, py / s, pz / s]}>
      <primitive object={model} />
    </group>
  );
}

/**
 * Một hiện vật 3D đặt trên BỤC trong phòng. Model tải theo `url` (GLB/GLTF,
 * cần host cho CORS). Bấm để chọn (admin có thể xoá).
 */
export function ModelPedestal({
  url,
  position,
  pedestalColor,
  rotY = 0,
  metal = false,
  textureUrl = null,
  pedStyle = "box",
  onSelect,
}: {
  url: string;
  position: [number, number, number];
  pedestalColor: string;
  /** Góc xoay hiện vật quanh trục Y (radian) — do người dùng chỉnh. */
  rotY?: number;
  /** Chất liệu bục: true = kim loại/bóng, false = nhám. */
  metal?: boolean;
  /** Ảnh vân (gỗ…) phủ lên bục; null = màu trơn. */
  textureUrl?: string | null;
  /** Kiểu bục: box (chuẩn) | low (thấp) | tall (cao) | podium (nhiều tầng). */
  pedStyle?: string;
  onSelect?: () => void;
}) {
  const { parts, top } = pedestalParts(pedStyle);
  const MODEL_H = 0.85; // chiều cao mục tiêu của hiện vật

  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const [base, setBase] = useState<Texture | null>(null);
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    if (!textureUrl) {
      setBase(null);
      return;
    }
    let alive = true;
    new TextureLoader().load(
      textureUrl,
      (t) => {
        if (!alive) return;
        const img = t.image as { width: number; height: number } | undefined;
        setAspect(img?.width && img?.height ? img.width / img.height : 1);
        setBase(t);
      },
      undefined,
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [textureUrl]);

  // 6 material/mặt hộp: mỗi mặt lặp theo ĐÚNG kích thước mặt đó (tile ~0.25m) →
  // mặt trên và mặt bên đều đặn như nhau, không méo, không dày đặc.
  const TILE = 0.25;
  const partFaceTex = useMemo(() => {
    return parts.map((p) => {
      // thứ tự material của BoxGeometry: +x, -x, +y, -y, +z, -z
      const faces: [number, number][] = [
        [p.d, p.h], // +x (phải)
        [p.d, p.h], // -x (trái)
        [p.w, p.d], // +y (trên)
        [p.w, p.d], // -y (dưới)
        [p.w, p.h], // +z (trước)
        [p.w, p.h], // -z (sau)
      ];
      if (!base) return faces.map(() => null);
      return faces.map(([fw, fh]) => {
        const c = base.clone();
        c.colorSpace = SRGBColorSpace;
        c.wrapS = c.wrapT = RepeatWrapping;
        c.anisotropy = maxAniso;
        c.repeat.set(fw / (TILE * aspect), fh / TILE);
        c.needsUpdate = true;
        return c;
      });
    });
  }, [base, aspect, parts, maxAniso]);
  useEffect(() => {
    return () => {
      for (const faces of partFaceTex) for (const c of faces) c?.dispose();
    };
  }, [partFaceTex]);

  const hover = (on: boolean) => {
    if (onSelect) document.body.style.cursor = on ? "pointer" : "grab";
  };
  return (
    <group position={position}>
      {/* Bục (một hoặc nhiều tầng) */}
      {parts.map((p, i) => (
        <mesh
          key={i}
          position={[0, p.y, 0]}
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            hover(true);
          }}
          onPointerOut={() => hover(false)}
        >
          <boxGeometry args={[p.w, p.h, p.d]} />
          {partFaceTex[i].map((t, f) => (
            <meshStandardMaterial
              key={f}
              attach={`material-${f}`}
              map={t ?? undefined}
              color={pedestalColor}
              roughness={metal ? 0.25 : 0.85}
              metalness={metal ? 0.85 : 0.05}
            />
          ))}
        </mesh>
      ))}
      {/* Hiện vật trên mặt bục (xoay theo rotY) */}
      <group position={[0, top + 0.02, 0]} rotation={[0, rotY, 0]}>
        <ModelBoundary>
          <Suspense fallback={null}>
            <GltfModel url={url} targetH={MODEL_H} />
          </Suspense>
        </ModelBoundary>
      </group>
    </group>
  );
}

/** Hình khối bục theo kiểu: trả các hộp {w,h,d,y tâm} + top (mặt trên). */
function pedestalParts(style: string): {
  parts: { w: number; h: number; d: number; y: number }[];
  top: number;
} {
  switch (style) {
    case "low":
      return { parts: [{ w: 0.8, h: 0.5, d: 0.8, y: 0.25 }], top: 0.5 };
    case "tall":
      return { parts: [{ w: 0.5, h: 1.45, d: 0.5, y: 0.725 }], top: 1.45 };
    case "podium":
      return {
        parts: [
          { w: 0.98, h: 0.3, d: 0.98, y: 0.15 },
          { w: 0.74, h: 0.3, d: 0.74, y: 0.45 },
          { w: 0.52, h: 0.3, d: 0.52, y: 0.75 },
        ],
        top: 0.9,
      };
    default: // box
      return { parts: [{ w: 0.62, h: 1.0, d: 0.62, y: 0.5 }], top: 1.0 };
  }
}
