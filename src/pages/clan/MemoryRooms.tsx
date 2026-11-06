import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Chip } from "@/components/Chip";
import { useConfirm } from "@/components/ConfirmDialog";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { GALLERY_PRESETS } from "@/components/gallery/palettes";
import { IconTile } from "@/components/IconTile";
import { IconArrowRight, IconCamera, IconGlobe, IconLink, IconPencil, IconSearch } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Textarea } from "@/components/ui/textarea";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging } from "@/hooks/useClientPaging";
import {
  createMemoryRoom,
  deleteMemoryRoom,
  listMemoryRooms,
  seedRoomFromMembers,
  updateMemoryRoom,
  type MemoryRoom,
} from "@/lib/queries/memoryRooms";
import { unaccent } from "@/lib/unaccent";

/** Trạng thái ngăn kéo: tạo phòng, xem (chỉ đọc) hoặc sửa thông tin một phòng. */
type PanelState =
  | { mode: "new" }
  | { mode: "view" | "edit"; room: MemoryRoom }
  | null;

const themeName = (theme: string) =>
  theme.trim().startsWith("{")
    ? "Tuỳ chỉnh"
    : (GALLERY_PRESETS.find((p) => p.id === theme)?.name ?? theme);
const themeWall = (theme: string) =>
  GALLERY_PRESETS.find((p) => p.id === theme)?.pal.wall ?? "#EAEAEE";

export default function MemoryRooms() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);
  const [search, setSearch] = useState("");

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["memory-rooms", clan.id, userId],
    queryFn: () => listMemoryRooms(clan.id),
    enabled: !!userId,
  });

  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return (rooms ?? []).filter(
      (r) => !q || unaccent(`${r.name} ${r.description ?? ""}`).toLowerCase().includes(q),
    );
  }, [rooms, search]);
  const paging = useClientPaging(filtered, 20);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memory-rooms", clan.id] });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteMemoryRoom(id),
    onSuccess: () => {
      invalidate();
      closePanel();
      toast.success("Đã xoá phòng");
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
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
        description="Các phòng trưng bày ảnh 3D của dòng họ — đi dạo và ngắm như một triển lãm."
        actionsBelow
        actions={canEdit ? <Fab onClick={() => setPanel({ mode: "new" })} label="Tạo phòng" /> : undefined}
      />

      <SearchInput
        label="Tìm phòng"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          paging.patchAndResetPage({});
        }}
        placeholder="Tìm theo tên phòng…"
      />

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={search.trim() ? <IconSearch className="h-10 w-10" /> : <IconCamera className="h-10 w-10" />}
          title={search.trim() ? "Không có phòng nào khớp" : "Chưa có phòng ký ức"}
          description={
            search.trim()
              ? "Thử bỏ bớt từ khoá."
              : canEdit
                ? "Bấm nút '+' để dựng phòng trưng bày ảnh đầu tiên."
                : "Quản trị/biên tập viên sẽ tạo phòng trưng bày ảnh."
          }
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((r) => (
            <RoomRow key={r.id} room={r} onOpen={() => setPanel({ mode: "view", room: r })} />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit="phòng"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={panel !== null}
        title={
          panel?.mode === "new" ? "Tạo phòng ký ức" : panel?.mode === "edit" ? "Sửa phòng" : "Phòng ký ức"
        }
        subtitle={
          panel?.mode === "new"
            ? "Phòng trưng bày ảnh 3D của dòng họ."
            : panel
              ? panel.room.name
              : undefined
        }
        onClose={closePanel}
        guard={panel?.mode !== "view"}
      >
        {panel && (
          <RoomForm
            key={panel.mode === "new" ? "new" : `${panel.mode}-${panel.room.id}`}
            clanId={clan.id}
            room={panel.mode === "new" ? null : panel.room}
            readOnly={panel.mode === "view"}
            canEdit={canEdit}
            onEdit={() => panel.mode === "view" && setPanel({ mode: "edit", room: panel.room })}
            onCancel={() =>
              setPanel(panel.mode === "edit" ? { mode: "view", room: panel.room } : null)
            }
            onSaved={() => {
              closePanel();
              invalidate();
            }}
            onDelete={
              panel.mode === "edit"
                ? async () => {
                    const ok = await confirm({
                      title: `Xoá phòng "${panel.room.name}"?`,
                      confirmLabel: "Xoá",
                      destructive: true,
                    });
                    if (ok) deleteM.mutate(panel.room.id);
                  }
                : undefined
            }
          />
        )}
      </SidePanel>
    </div>
  );
}

function RoomRow({ room, onOpen }: { room: MemoryRoom; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        {room.cover_image_url ? (
          <img
            src={room.cover_image_url}
            alt=""
            loading="lazy"
            className="min-h-14 w-14 shrink-0 self-stretch rounded-lg border object-cover"
          />
        ) : (
          <IconTile icon={IconCamera} tone="violet" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{room.name}</p>
          {room.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
          )}
          <RecordDates
            createdAt={room.created_at}
            updatedAt={room.updated_at}
            className="mt-0.5 text-xs text-muted-foreground/80"
          />
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {room.is_public && (
              <Chip tone="primary" icon={<IconGlobe />}>
                Công khai
              </Chip>
            )}
            <Chip
              tone="neutral"
              icon={
                <span
                  className="inline-block rounded-full border"
                  style={{ background: themeWall(room.theme), width: 12, height: 12 }}
                />
              }
            >
              {themeName(room.theme)}
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

function RoomForm({
  clanId,
  room,
  readOnly,
  canEdit,
  onEdit,
  onCancel,
  onSaved,
  onDelete,
}: {
  clanId: string;
  /** null = tạo phòng mới. */
  room: MemoryRoom | null;
  readOnly: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(room?.name ?? "");
  const [theme, setTheme] = useState(room?.theme ?? "white");
  const [description, setDescription] = useState(room?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(room?.cover_image_url ?? "");
  const [seed, setSeed] = useState(true);
  const [err, setErr] = useState("");

  const saveM = useMutation({
    mutationFn: async () => {
      if (room) {
        await updateMemoryRoom(room.id, {
          name: name.trim() || "Phòng ký ức",
          theme,
          description: description.trim() || null,
          cover_image_url: coverUrl.trim() || null,
        });
        return null;
      }
      const created = await createMemoryRoom(clanId, {
        name: name.trim() || "Phòng ký ức",
        theme,
        description: description.trim() || undefined,
        cover_image_url: coverUrl.trim() || null,
      });
      if (seed) {
        try {
          await seedRoomFromMembers(created.id);
        } catch {
          /* seed lỗi không chặn tạo phòng */
        }
      }
      return created;
    },
    onSuccess: (created) => {
      if (created) {
        // Tạo xong vào thẳng phòng như trước.
        navigate(`/clans/${clanId}/memory-room/${created.id}`);
        onSaved();
        return;
      }
      toast.success("Đã cập nhật phòng");
      onSaved();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[memory-room save]", e);
      setErr(
        /max_memory_rooms/.test(msg)
          ? "Đã đạt giới hạn số phòng ký ức của dòng họ này."
          : `Không lưu được phòng: ${msg}`,
      );
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        saveM.mutate();
      }}
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="room-name">Tên phòng</Label>
          <Input
            id="room-name"
            icon={<IconCamera />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Ảnh kỷ niệm dòng họ"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="room-desc">Mô tả (tuỳ chọn)</Label>
          <Textarea
            id="room-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Vài dòng giới thiệu phòng…"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Tông phòng</legend>
          <div className="flex flex-wrap gap-2">
            {GALLERY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTheme(p.id)}
                className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition ${
                  theme === p.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/60"
                }`}
              >
                <span className="h-4 w-4 rounded-full border" style={{ background: p.pal.wall }} />
                {p.name}
              </button>
            ))}
          </div>
          {theme.trim().startsWith("{") && (
            <p className="text-xs text-muted-foreground">
              Phòng đang dùng bảng màu tuỳ chỉnh (đổi ngay trong phòng). Chọn một tông ở đây sẽ thay thế.
            </p>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="room-cover">Ảnh đại diện (tuỳ chọn)</Label>
          <div className="flex items-center gap-2">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
              {coverUrl.trim() ? (
                <img src={coverUrl.trim()} alt="" className="h-full w-full object-cover" />
              ) : (
                <IconCamera className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <Input
              id="room-cover"
              icon={<IconLink />}
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="Dán URL ảnh (https://…) — bỏ trống dùng ảnh mặc định"
              className="min-w-0 flex-1"
            />
          </div>
        </div>

        {!room && (
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={seed}
              onChange={(e) => setSeed(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-medium">Nạp sẵn ảnh thành viên</span>
              <span className="block text-sm text-muted-foreground">
                Lấy ảnh từ danh sách thành viên (chỉ người có ảnh).
              </span>
            </span>
          </label>
        )}
      </ReadOnlyFieldset>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {readOnly ? (
        <FormActions>
          {canEdit && (
            <Button type="button" variant="outline" onClick={onEdit}>
              <IconPencil className="mr-1.5 h-4 w-4" />
              Sửa
            </Button>
          )}
          {/* Phòng là trải nghiệm 3D nên vào phòng là hành động chính. */}
          <Button asChild>
            <Link to={`/clans/${clanId}/memory-room/${room!.id}`}>
              <IconArrowRight className="mr-1.5 h-4 w-4" />
              Vào phòng
            </Link>
          </Button>
        </FormActions>
      ) : (
        <ViewEditActions
          readOnly={false}
          onEdit={onEdit}
          onCancel={onCancel}
          onDelete={onDelete}
          saving={saveM.isPending}
          saveLabel={room ? "Lưu" : "Tạo phòng"}
        />
      )}
    </form>
  );
}
