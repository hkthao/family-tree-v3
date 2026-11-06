import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { IconCamera, IconLink, IconPlus, IconX } from "@/components/icons";
import { ImageLightbox, type LightboxImage } from "@/components/ImageLightbox";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS, uploadHeritagePhoto } from "@/lib/photoUpload";
import {
  addMedia,
  clanHeritageStorageBytes,
  formatBytes,
  getHeritageItem,
  HERITAGE_CLAN_QUOTA_BYTES,
  removeMedia,
  setCoverMedia,
  validateExternalMedia,
  type HeritageMedia,
} from "@/lib/queries/heritage";

/** Giới hạn để chặn phình dung lượng storage VPS (cùng giá trị ở trang chi tiết). */
const MAX_PHOTOS = 12;

/**
 * Mục "Hình ảnh" của một mục di sản, dùng trong ngăn kéo xem / sửa. `editable=false` (xem) chỉ
 * hiện ảnh và phóng to; `editable` thêm nút Chụp / Tải ảnh / Liên kết ngoài và dấu X gỡ ảnh.
 * Thêm hoặc gỡ ảnh được lưu NGAY (không chờ nút Lưu của form), như ở trang chi tiết.
 */
export function HeritagePhotosSection({ itemId, editable }: { itemId: string; editable: boolean }) {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const { data: item } = useQuery({
    queryKey: ["heritage-item", itemId, userId],
    queryFn: () => getHeritageItem(itemId),
  });
  const photos = (item?.media ?? []).filter((m) => m.kind === "photo");

  // Chỉ ký URL cho file trong bucket; link ngoài dùng trực tiếp.
  const bucketPaths = (item?.media ?? []).map((m) => m.path).filter((p): p is string => !!p);
  const { data: mediaUrls } = useQuery({
    queryKey: ["heritage-media-urls", itemId, bucketPaths.join(",")],
    queryFn: () => getSignedPhotoUrlMap(bucketPaths),
    enabled: !!item && bucketPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });
  const srcOf = (m: HeritageMedia): string | undefined =>
    m.external_url ?? (m.path ? mediaUrls?.get(m.path) : undefined);

  const photoImages: LightboxImage[] = photos.flatMap((ph) => {
    const src = srcOf(ph);
    return src ? [{ src, caption: ph.caption }] : [];
  });
  const lightboxIndexOf = (ph: HeritageMedia) => photoImages.findIndex((im) => im.src === srcOf(ph));

  const { data: storageBytes } = useQuery({
    queryKey: ["heritage-storage", clan.id, userId],
    queryFn: () => clanHeritageStorageBytes(clan.id),
    enabled: editable && !!userId,
  });
  const overQuota = (storageBytes ?? 0) >= HERITAGE_CLAN_QUOTA_BYTES;
  const full = photos.length >= MAX_PHOTOS;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["heritage-item", itemId] });
    qc.invalidateQueries({ queryKey: ["heritage-storage", clan.id] });
    qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
  };

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      if (full) throw new Error(`Tối đa ${MAX_PHOTOS} ảnh mỗi mục.`);
      if (overQuota)
        throw new Error(`Dòng họ đã dùng hết ${formatBytes(HERITAGE_CLAN_QUOTA_BYTES)}. Hãy xoá bớt ảnh/ghi âm cũ.`);
      const { path, bytes } = await uploadHeritagePhoto(clan.id, itemId, file);
      const { id } = await addMedia(itemId, { kind: "photo", path, bytes, sort: photos.length });
      // ảnh đầu tiên → đặt làm ảnh đại diện
      if (!item?.cover_media_id && photos.length === 0) await setCoverMedia(itemId, id);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã thêm ảnh");
    },
    onError: (e) => toast.error("Không thêm được ảnh", { description: (e as Error).message }),
  });

  const linkM = useMutation({
    mutationFn: async (url: string) => {
      const check = validateExternalMedia("photo", url);
      if (!check.ok) throw new Error(check.error);
      await addMedia(itemId, { kind: "photo", external_url: url.trim(), sort: photos.length });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã thêm ảnh từ liên kết");
    },
    onError: (e) => toast.error("Không thêm được", { description: (e as Error).message }),
  });

  const removeM = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string | null }) => removeMedia(id, path),
    onSuccess: invalidate,
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const busy = uploadM.isPending || linkM.isPending;

  return (
    <section className="space-y-2">
      <h3 className="inline-flex items-center gap-2 text-base font-semibold">
        <IconCamera className="h-5 w-5" />
        Hình ảnh{photos.length > 0 ? ` (${photos.length}/${MAX_PHOTOS})` : ""}
      </h3>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có ảnh.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((ph) => (
            <div key={ph.id} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
              {srcOf(ph) ? (
                <button
                  type="button"
                  onClick={() => setLightboxIdx(lightboxIndexOf(ph))}
                  className="h-full w-full cursor-zoom-in"
                  aria-label="Xem ảnh lớn"
                >
                  <img
                    src={srcOf(ph)}
                    alt={ph.caption ?? ""}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : null}
              {editable && (
                <button
                  type="button"
                  onClick={() => removeM.mutate({ id: ph.id, path: ph.path })}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background"
                  aria-label="Xoá ảnh"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
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
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              // Ảnh lưu ngay: không để SidePanel coi là "thay đổi chưa lưu".
              e.stopPropagation();
              const f = e.target.files?.[0];
              if (f) uploadM.mutate(f);
              e.target.value = "";
            }}
          />
          {/* Nút của riêng mục này (tác động vào ảnh ngay), xếp phụ → chính. */}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || full}
              title="Dán link ảnh có sẵn trên mạng — không tốn dung lượng"
              onClick={() => {
                const u = window.prompt("Dán link ảnh (https://…):");
                if (u?.trim()) linkM.mutate(u.trim());
              }}
            >
              <IconLink className="mr-1 h-4 w-4" /> Liên kết ngoài
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || full || overQuota}
              onClick={() => fileRef.current?.click()}
            >
              <IconPlus className="mr-1 h-4 w-4" /> {uploadM.isPending ? "Đang tải…" : "Tải ảnh"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || full || overQuota}
              onClick={() => cameraRef.current?.click()}
            >
              <IconCamera className="mr-1 h-4 w-4" /> Chụp ảnh
            </Button>
          </div>
        </>
      )}

      {lightboxIdx !== null && photoImages.length > 0 && (
        <ImageLightbox
          images={photoImages}
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </section>
  );
}
