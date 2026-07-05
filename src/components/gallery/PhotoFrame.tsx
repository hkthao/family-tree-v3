import { useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useState } from "react";
import {
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  VideoTexture,
  type Texture,
} from "three";

import { isVideoUrl } from "@/lib/queries/galleryPhotos";
import type { GalleryPhoto } from "@/lib/queries/galleryPhotos";
import type { PlacedFrame } from "./placement";

/** Hình chữ nhật BO GÓC (tâm ở gốc) — dùng cho mặt ảnh. */
function roundedRect(w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  const s = new Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Một khung ảnh treo tường: viền màu (theo style) + MAT TRẮNG, ảnh fit gọn bên
 * trong (contain) như tranh đóng khung thật. Cỡ khung do bố cục (slot) quyết
 * định. Texture nạp thủ công để ảnh lỗi không làm sập cả phòng.
 */
function PhotoFrameBase({
  frame,
  matColor,
  onSelect,
}: {
  frame: PlacedFrame;
  matColor: string;
  onSelect: (photo: GalleryPhoto) => void;
}) {
  const [tex, setTex] = useState<Texture | null>(null);
  const [aspect, setAspect] = useState(1.2);
  const url = frame.photo.url;
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());

  useEffect(() => {
    let alive = true;

    // Video: phát ngay trong khung bằng VideoTexture (muted + loop để tự chạy).
    if (isVideoUrl(url)) {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.src = url;
      const onMeta = () => {
        if (video.videoWidth && video.videoHeight)
          setAspect(video.videoWidth / video.videoHeight);
      };
      video.addEventListener("loadedmetadata", onMeta);
      const t = new VideoTexture(video);
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = maxAniso;
      video.play().catch(() => {});
      setTex(t);
      return () => {
        alive = false;
        video.removeEventListener("loadedmetadata", onMeta);
        video.pause();
        video.removeAttribute("src");
        video.load();
        t.dispose();
      };
    }

    // Ảnh tĩnh
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (t) => {
        if (!alive) return;
        t.colorSpace = SRGBColorSpace;
        t.anisotropy = maxAniso;
        t.needsUpdate = true;
        setTex(t);
        const img = t.image as { width: number; height: number } | undefined;
        if (img?.width && img?.height) setAspect(img.width / img.height);
      },
      undefined,
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [url, maxAniso]);

  const { w, h, style } = frame;
  const b = style.border;
  const innerW = Math.max(0.1, w - 2 * b); // vùng mat trắng
  const innerH = Math.max(0.1, h - 2 * b);
  const margin = Math.min(innerW, innerH) * 0.06; // mat trắng MỎNG đều
  const areaW = innerW - 2 * margin;
  const areaH = innerH - 2 * margin;

  // Mặt ảnh lấp đầy vùng ảnh (cover) + bo góc nhẹ, UV remap 0..1.
  const photoGeo = useMemo(() => {
    const r = Math.min(areaW, areaH) * 0.03; // bo góc nhẹ (không quá tròn)
    const g = new ShapeGeometry(roundedRect(areaW, areaH, r), 6);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (uv.getX(i) + areaW / 2) / areaW,
        (uv.getY(i) + areaH / 2) / areaH,
      );
    }
    uv.needsUpdate = true;
    return g;
  }, [areaW, areaH]);
  useEffect(() => () => photoGeo.dispose(), [photoGeo]);

  // COVER: cắt ảnh cho lấp đầy khung theo tỉ lệ (không méo, không viền trống).
  useEffect(() => {
    if (!tex) return;
    const areaAspect = areaW / areaH;
    if (aspect > areaAspect) {
      const rx = areaAspect / aspect;
      tex.repeat.set(rx, 1);
      tex.offset.set((1 - rx) / 2, 0);
    } else {
      const ry = aspect / areaAspect;
      tex.repeat.set(1, ry);
      tex.offset.set(0, (1 - ry) / 2);
    }
    tex.needsUpdate = true;
  }, [tex, aspect, areaW, areaH]);

  return (
    <group position={frame.position} rotation={[0, frame.rotationY, 0]}>
      {/* Viền khung + đổ bóng lên tường */}
      <mesh position={[0, 0, -style.depth / 2 - 0.005]} castShadow>
        <boxGeometry args={[w, h, style.depth]} />
        <meshStandardMaterial color={style.color} roughness={0.6} />
      </mesh>
      {/* Mat trắng */}
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[innerW, innerH]} />
        <meshStandardMaterial color="#FBFBFA" />
      </mesh>
      {/* Ảnh (fit trong mat) — bo góc nhẹ */}
      <mesh
        position={[0, 0, 0.014]}
        geometry={photoGeo}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(frame.photo);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "grab";
        }}
      >
        {tex ? (
          <meshBasicMaterial map={tex} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={matColor} />
        )}
      </mesh>
    </group>
  );
}

export const PhotoFrame = memo(PhotoFrameBase);
