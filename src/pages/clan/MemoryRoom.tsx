import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { IconCamera } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import {
  getMemoryRoom,
  listClanMembersWithPhotos,
  resolveRoomPhotos,
  updateMemoryRoom,
  updateRoomItem,
} from "@/lib/queries/memoryRooms";
import { hasWebGL } from "@/lib/webglSupport";
import { GALLERY_PRESETS as PRESETS, galleryPalette } from "@/components/gallery/palettes";

const GalleryScene = lazy(() =>
  import("@/components/gallery/GalleryScene").then((m) => ({
    default: m.GalleryScene,
  })),
);

export default function MemoryRoom() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const { roomId = "" } = useParams();
  const webgl = useMemo(() => hasWebGL(), []);
  const qc = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["gallery-members", clan.id],
    queryFn: () => listClanMembersWithPhotos(clan.id),
    enabled: canEdit && !!userId,
  });
  const onSaveItem = async (
    itemId: string,
    patch: { person_id?: string | null; image_url?: string | null },
  ) => {
    await updateRoomItem(itemId, patch);
    qc.invalidateQueries({ queryKey: ["memory-room-photos", roomId] });
  };

  const { data: room } = useQuery({
    queryKey: ["memory-room", roomId],
    queryFn: () => getMemoryRoom(roomId),
    enabled: !!roomId && !!userId,
  });

  const { data: photos, isLoading } = useQuery({
    queryKey: ["memory-room-photos", roomId],
    queryFn: () => resolveRoomPhotos(roomId),
    enabled: !!roomId && !!userId,
  });

  const [presetId, setPresetId] = useState("white");
  useEffect(() => {
    if (room?.theme) setPresetId(room.theme);
  }, [room?.theme]);
  const selectPreset = (id: string) => {
    setPresetId(id);
    if (canEdit && roomId) updateMemoryRoom(roomId, { theme: id }).catch(() => {});
  };
  const pal = galleryPalette(presetId);

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Phòng ký ức", to: `/clans/${clan.id}/memory-room` },
          { label: room?.name ?? "…" },
        ]}
      />
      <PageHeader
        icon={<IconCamera className="h-7 w-7" />}
        title={room?.name ?? "Phòng ký ức"}
        description="Kéo để nhìn quanh · WASD/phím mũi tên (hoặc joystick) để đi · chạm khung để xem ảnh."
      />

      {isLoading && <p className="text-muted-foreground">Đang tải ảnh…</p>}

      {!isLoading && (!photos || photos.length === 0) && (
        <EmptyState
          icon={<IconCamera className="h-10 w-10" />}
          title="Phòng chưa có ảnh"
          description="Thêm ảnh cho phòng (nạp từ thành viên hoặc thêm ảnh) để bắt đầu trưng bày."
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
                <GalleryScene
                  photos={photos}
                  pal={pal}
                  presets={PRESETS.map((p) => ({ id: p.id, name: p.name, swatch: p.pal.wall }))}
                  presetId={presetId}
                  onPreset={selectPreset}
                  canEdit={canEdit}
                  members={members}
                  onSaveItem={onSaveItem}
                />
              </Suspense>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-lg border bg-card">
                  <img src={p.url} alt={p.title} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="p-2">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    {p.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{p.subtitle}</p>
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
