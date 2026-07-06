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
  addRoomModel,
  addRoomPhoto,
  deleteRoomItem,
  getMemoryRoom,
  listClanMembersWithPhotos,
  resolveRoomItems,
  updateMemoryRoom,
  updateRoomItem,
} from "@/lib/queries/memoryRooms";

const FRAME_EMPTY = "/textures/frame-empty.svg";
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
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["memory-room-items", roomId] });
  const onSaveItem = async (
    itemId: string,
    patch: { person_id?: string | null; image_url?: string | null },
  ) => {
    // Khung mặc định (id "new:") chưa có trong DB → THÊM mới; còn lại thì sửa.
    if (itemId.startsWith("new:")) await addRoomPhoto(roomId, patch);
    else await updateRoomItem(itemId, patch);
    invalidate();
  };
  const onAddModel = async (url: string, pos?: [number, number]) => {
    await addRoomModel(roomId, url, pos);
    invalidate();
  };
  const onDeleteItem = async (itemId: string) => {
    await deleteRoomItem(itemId);
    qc.invalidateQueries({ queryKey: ["memory-room-items", roomId] });
  };
  const onSaveModel = async (itemId: string, transform: unknown) => {
    await updateRoomItem(itemId, { transform });
    qc.invalidateQueries({ queryKey: ["memory-room-items", roomId] });
  };

  const { data: room } = useQuery({
    queryKey: ["memory-room", roomId],
    queryFn: () => getMemoryRoom(roomId),
    enabled: !!roomId && !!userId,
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["memory-room-items", roomId],
    queryFn: () => resolveRoomItems(roomId),
    enabled: !!roomId && !!userId,
  });
  const photos = items?.photos ?? [];
  const models = items?.models ?? [];
  // Khung trống (client-side, KHÔNG lưu DB): bấm để chọn ảnh → khi lưu mới insert
  // thật (kèm ảnh member/URL). Phòng rỗng → 8 khung mặc định cho mọi người xem;
  // phòng đã có ảnh → admin luôn thấy thêm 3 khung trống để "thêm ảnh". Nút "Mở
  // rộng phòng" thêm 4 khung trống mỗi lần bấm → hành lang dài thêm.
  const [extraSlots, setExtraSlots] = useState(0);
  const onExpand = () => setExtraSlots((n) => n + 4);
  const scenePhotos = useMemo(() => {
    const empty = (i: number) => ({
      id: `new:${i}`,
      itemId: `new:${i}`,
      personId: null as string | null,
      path: "",
      url: FRAME_EMPTY,
      title: "",
      subtitle: "",
    });
    const emptyCount = photos.length === 0 ? 8 : canEdit ? 3 : 0;
    const total = emptyCount + (canEdit ? extraSlots : 0);
    const pads = Array.from({ length: total }, (_, i) =>
      empty(photos.length + i),
    );
    return [...photos, ...pads];
  }, [photos, canEdit, extraSlots]);

  // theme lưu ở room.theme: là id preset ("white"…) HOẶC JSON palette tuỳ chỉnh.
  const [themeRaw, setThemeRaw] = useState("white");
  useEffect(() => {
    if (room?.theme) setThemeRaw(room.theme);
  }, [room?.theme]);
  const pal = useMemo(() => {
    const base = galleryPalette("white");
    if (themeRaw.trim().startsWith("{")) {
      try {
        return { ...base, ...JSON.parse(themeRaw) };
      } catch {
        return base;
      }
    }
    return galleryPalette(themeRaw);
  }, [themeRaw]);
  const presetId = themeRaw.startsWith("{") ? "" : themeRaw;

  const persistTheme = (raw: string) => {
    if (canEdit && roomId) updateMemoryRoom(roomId, { theme: raw }).catch(() => {});
  };
  const selectPreset = (id: string) => {
    setThemeRaw(id);
    persistTheme(id);
  };
  // Đổi màu phòng tuỳ ý (live: chỉ đổi local; persist khi rời ô chọn).
  const setRoomColor = (field: string, value: string) => {
    const next: Record<string, string> = { ...pal };
    if (field === "bg") {
      next.bg = value;
      next.bgTop = value;
      next.bgBottom = value;
    } else {
      next[field] = value;
    }
    setThemeRaw(JSON.stringify(next));
  };
  const commitRoomColor = () => persistTheme(themeRaw);

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

      {!isLoading && (
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
                  photos={scenePhotos}
                  pal={pal}
                  presets={PRESETS.map((p) => ({ id: p.id, name: p.name, swatch: p.pal.wall }))}
                  presetId={presetId}
                  onPreset={selectPreset}
                  canEdit={canEdit}
                  members={members}
                  onSaveItem={onSaveItem}
                  onExpand={onExpand}
                  models={models}
                  onAddModel={onAddModel}
                  onDeleteItem={onDeleteItem}
                  onSaveModel={onSaveModel}
                  onRoomColor={setRoomColor}
                  onRoomColorCommit={commitRoomColor}
                />
              </Suspense>
            </div>
          ) : photos.length > 0 ? (
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
          ) : (
            <EmptyState
              icon={<IconCamera className="h-10 w-10" />}
              title="Phòng chưa có ảnh"
              description="Thiết bị không hỗ trợ 3D. Thêm ảnh cho phòng để xem ở dạng danh sách."
            />
          )}
        </>
      )}
    </div>
  );
}
