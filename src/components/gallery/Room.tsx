import { MeshReflectorMaterial } from "@react-three/drei";
import { useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

import type { RoomLayout } from "./placement";

export type RoomColors = {
  floor: string;
  wall: string;
  ceiling: string;
};

/** Kết cấu gạch lát nền nhạt (đường ron mờ) — nhân với màu sàn. */
function useTileTexture(repeatX: number, repeatY: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
  }, [repeatX, repeatY]);
}

/** Hộp phòng (hành lang) trắng sáng kiểu bảo tàng: sàn gạch phản chiếu nhẹ,
 *  tường nhận bóng đổ của khung tranh. Màu cấu hình. */
export function Room({
  layout,
  colors,
}: {
  layout: RoomLayout;
  colors: RoomColors;
}) {
  const halfW = layout.width / 2 + 0.12;
  const h = layout.height;
  const zMin = -1.2;
  const zMax = layout.length + 1.2;
  const depth = zMax - zMin;
  const zMid = (zMin + zMax) / 2;
  const tile = useTileTexture(
    Math.max(2, Math.round((halfW * 2) / 1.3)),
    Math.max(2, Math.round(depth / 1.3)),
  );

  return (
    <group>
      {/* Sàn gạch, phản chiếu mờ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zMid]} receiveShadow>
        <planeGeometry args={[halfW * 2, depth]} />
        <MeshReflectorMaterial
          resolution={512}
          mirror={0.3}
          blur={[300, 100]}
          mixBlur={1}
          mixStrength={0.7}
          roughness={0.85}
          depthScale={0.6}
          map={tile}
          color={colors.floor}
        />
      </mesh>
      {/* Trần */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, zMid]}>
        <planeGeometry args={[halfW * 2, depth]} />
        <meshStandardMaterial color={colors.ceiling} />
      </mesh>
      {/* Tường trái (quay mặt +X) — nhận bóng khung */}
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[-halfW, h / 2, zMid]}
        receiveShadow
      >
        <planeGeometry args={[depth, h]} />
        <meshStandardMaterial color={colors.wall} />
      </mesh>
      {/* Tường phải (quay mặt −X) — nhận bóng khung */}
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[halfW, h / 2, zMid]}
        receiveShadow
      >
        <planeGeometry args={[depth, h]} />
        <meshStandardMaterial color={colors.wall} />
      </mesh>
      {/* Tường đầu (z nhỏ) */}
      <mesh position={[0, h / 2, zMin]}>
        <planeGeometry args={[halfW * 2, h]} />
        <meshStandardMaterial color={colors.wall} />
      </mesh>
      {/* Tường cuối (z lớn, quay mặt −Z) */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, h / 2, zMax]}>
        <planeGeometry args={[halfW * 2, h]} />
        <meshStandardMaterial color={colors.wall} />
      </mesh>
    </group>
  );
}
