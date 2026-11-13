import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { IconCamera, IconGrave, IconPlus, IconX } from "@/components/icons";
import { ImageLightbox, type LightboxImage } from "@/components/ImageLightbox";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import {
  getSignedPhotoUrlMap,
  PHOTO_URL_STALE_MS,
  uploadRestingPlacePhoto,
} from "@/lib/photoUpload";
import {
  addPhoto,
  getRestingPlace,
  removePhoto,
} from "@/lib/queries/restingPlaces";

import { t } from "@lingui/core/macro";
/** Giới hạn ảnh mỗi nơi an nghỉ (cùng giá trị ở trang chi tiết). */
const MAX_GRAVE_PHOTOS = 12;

/**
 * Mục "Hình ảnh" của một nơi an nghỉ, dùng trong ngăn kéo xem / sửa. `editable=false` (xem) chỉ
 * hiện ảnh và phóng to; `editable` thêm nút Thêm ảnh và dấu X gỡ ảnh. Thêm hoặc gỡ ảnh được lưu
 * NGAY (không chờ nút Lưu của form), như ở trang chi tiết.
 */
export function RestingPlacePhotosSection({
  placeId,
  editable,
}: {
  placeId: string;
  editable: boolean;
}) {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const { data: place } = useQuery({
    queryKey: ["resting-place", placeId, userId],
    queryFn: () => getRestingPlace(placeId),
  });
  const photos = place?.photos ?? [];

  const { data: photoUrls } = useQuery({
    queryKey: [
      "resting-place-photos",
      placeId,
      photos.map((p) => p.path).join(","),
    ],
    queryFn: () => getSignedPhotoUrlMap(photos.map((p) => p.path)),
    enabled: photos.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });

  const images: LightboxImage[] = photos.flatMap((ph) => {
    const src = photoUrls?.get(ph.path);
    return src ? [{ src, caption: ph.caption }] : [];
  });
  const full = photos.length >= MAX_GRAVE_PHOTOS;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["resting-place", placeId] });
    qc.invalidateQueries({ queryKey: ["resting-places", clan.id] });
  };

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      if (full)
        throw new Error(t`Tối đa ${MAX_GRAVE_PHOTOS} ảnh mỗi nơi an nghỉ.`);
      const { path } = await uploadRestingPlacePhoto(clan.id, placeId, file);
      await addPhoto(placeId, path, null, photos.length);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t`Đã thêm ảnh`);
    },
    onError: (e) =>
      toast.error(t`Không thêm được ảnh`, {
        description: (e as Error).message,
      }),
  });

  const removeM = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) =>
      removePhoto(id, path),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(t`Không xoá được ảnh`, { description: (e as Error).message }),
  });

  return (
    <section className="space-y-2">
      <h3 className="inline-flex items-center gap-2 text-base font-semibold">
        <IconCamera className="h-5 w-5" />
        Hình ảnh
        {photos.length > 0 ? ` (${photos.length}/${MAX_GRAVE_PHOTOS})` : ""}
      </h3>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t`Chưa có ảnh.`}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((ph) => {
            const src = photoUrls?.get(ph.path);
            const idx = src ? images.findIndex((im) => im.src === src) : -1;
            return (
              <div
                key={ph.id}
                className="relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                {src ? (
                  <button
                    type="button"
                    onClick={() => setLightboxIdx(idx)}
                    className="h-full w-full cursor-zoom-in"
                    aria-label={t`Xem ảnh lớn`}
                  >
                    <img
                      src={src}
                      alt={ph.caption ?? ""}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <IconGrave className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeM.mutate({ id: ph.id, path: ph.path })}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background"
                    aria-label={t`Xoá ảnh`}
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editable && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              // Ảnh lưu ngay: không để SidePanel coi là "thay đổi chưa lưu".
              e.stopPropagation();
              const f = e.target.files?.[0];
              if (f) uploadM.mutate(f);
              e.target.value = "";
            }}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={uploadM.isPending || full}
              title={full ? t`Tối đa ${MAX_GRAVE_PHOTOS} ảnh` : undefined}
              onClick={() => fileRef.current?.click()}
            >
              <IconPlus className="mr-1 h-4 w-4" />
              {uploadM.isPending ? t`Đang tải…` : t`Thêm ảnh`}
            </Button>
          </div>
        </>
      )}

      {lightboxIdx !== null && lightboxIdx >= 0 && images.length > 0 && (
        <ImageLightbox
          images={images}
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </section>
  );
}
