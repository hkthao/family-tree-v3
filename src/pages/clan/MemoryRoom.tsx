import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { IconCamera } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { getGalleryPhotos } from "@/lib/queries/galleryPhotos";
import { hasWebGL } from "@/lib/webglSupport";
import type { GalleryPalette } from "@/components/gallery/GalleryScene";

const GalleryScene = lazy(() =>
  import("@/components/gallery/GalleryScene").then((m) => ({
    default: m.GalleryScene,
  })),
);

// Tông "bảo tàng trắng" như ảnh tham khảo — DÙNG CHUNG cho cả theme sáng/tối
// (phòng trưng bày ảnh nên trắng sáng để ảnh nổi + giống mẫu).
const MUSEUM: GalleryPalette = {
  bg: "#E8E8EA", // fog
  bgTop: "#FBFBFC", // gradient nền: trắng phía trên
  bgBottom: "#D9DADE", // hơi xám phía dưới
  floor: "#C6C6C9", // gạch xám nhạt
  wall: "#EAEAEE", // tường gần trắng
  ceiling: "#F7F7F8", // trần sáng hơn tường
  frame: "#FCFCFC", // khung trắng mảnh
  placeholder: "#DBDBDE",
};

export default function MemoryRoom() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const pal = MUSEUM;
  const webgl = useMemo(() => hasWebGL(), []);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["gallery-photos", clan.id, userId],
    queryFn: () => getGalleryPhotos(clan.id),
    enabled: !!userId,
    staleTime: PHOTO_URL_STALE_MS,
  });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Phòng ký ức" },
        ]}
      />
      <PageHeader
        icon={<IconCamera className="h-7 w-7" />}
        title="Phòng ký ức"
        description="Ảnh dòng họ trưng bày trong không gian 3D — đi dạo và ngắm như một phòng triển lãm."
      />

      {isLoading && <p className="text-muted-foreground">Đang tải ảnh…</p>}

      {!isLoading && (!photos || photos.length === 0) && (
        <EmptyState
          icon={<IconCamera className="h-10 w-10" />}
          title="Chưa có ảnh để trưng bày"
          description="Thêm ảnh chân dung cho thành viên (hoặc ảnh mộ phần) rồi quay lại để dựng phòng ký ức."
        />
      )}

      {!isLoading && photos && photos.length > 0 && (
        <>
          {webgl ? (
            <div className="h-[calc(100dvh-210px)] min-h-[440px] overflow-hidden rounded-xl border">
              <Suspense
                fallback={
                  <div className="grid h-full place-items-center text-muted-foreground">
                    Đang dựng phòng 3D…
                  </div>
                }
              >
                <GalleryScene photos={photos} pal={pal} />
              </Suspense>
            </div>
          ) : (
            // Dự phòng 2D khi thiết bị không hỗ trợ WebGL.
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => (
                <li
                  key={p.id}
                  className="overflow-hidden rounded-lg border bg-card"
                >
                  <img
                    src={p.url}
                    alt={p.title}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <div className="p-2">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    {p.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">
                        {p.subtitle}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
