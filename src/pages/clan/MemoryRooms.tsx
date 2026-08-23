import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { IconCamera, IconPlus } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { RecordDates } from "@/components/RecordDates";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { GALLERY_PRESETS } from "@/components/gallery/palettes";
import {
  createMemoryRoom,
  deleteMemoryRoom,
  listMemoryRooms,
  seedRoomFromMembers,
} from "@/lib/queries/memoryRooms";

export default function MemoryRooms() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("white");
  const [coverUrl, setCoverUrl] = useState("");
  const [seed, setSeed] = useState(true);
  const [err, setErr] = useState("");

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["memory-rooms", clan.id, userId],
    queryFn: () => listMemoryRooms(clan.id),
    enabled: !!userId,
  });

  const createM = useMutation({
    mutationFn: async () => {
      const room = await createMemoryRoom(clan.id, {
        name: name.trim() || "Phòng ký ức",
        theme,
        cover_image_url: coverUrl.trim() || null,
      });
      if (seed) {
        try {
          await seedRoomFromMembers(room.id);
        } catch {
          /* seed lỗi không chặn tạo phòng */
        }
      }
      return room;
    },
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ["memory-rooms", clan.id] });
      navigate(`/clans/${clan.id}/memory-room/${room.id}`);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[memory-room create]", e);
      setErr(
        /max_memory_rooms/.test(msg)
          ? "Đã đạt giới hạn số phòng ký ức của dòng họ này."
          : `Không tạo được phòng: ${msg}`,
      );
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteMemoryRoom(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["memory-rooms", clan.id] }),
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
        actions={
          canEdit ? (
            <Button type="button" size="sm" onClick={() => setOpen((v) => !v)}>
              <IconPlus className="mr-1.5 h-4 w-4" /> Tạo phòng
            </Button>
          ) : undefined
        }
      />

      {open && canEdit && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Tên phòng</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Ảnh kỷ niệm dòng họ"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tông phòng</label>
            <div className="flex flex-wrap gap-2">
              {GALLERY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTheme(p.id)}
                  className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition ${
                    theme === p.id
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-primary/60"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border"
                    style={{ background: p.pal.wall }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Ảnh đại diện (tuỳ chọn)
            </label>
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                {coverUrl.trim() ? (
                  <img src={coverUrl.trim()} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IconCamera className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="Dán URL ảnh (https://…) — bỏ trống dùng ảnh mặc định"
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={seed}
              onChange={(e) => setSeed(e.target.checked)}
            />
            Nạp sẵn ảnh từ danh sách thành viên (chỉ người có ảnh)
          </label>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => createM.mutate()}
              disabled={createM.isPending}
            >
              <IconPlus className="h-4 w-4 mr-1.5" />
              {createM.isPending ? "Đang tạo…" : "Tạo phòng"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setErr("");
              }}
            >
              Huỷ
            </Button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {!isLoading && (!rooms || rooms.length === 0) && (
        <EmptyState
          icon={<IconCamera className="h-10 w-10" />}
          title="Chưa có phòng ký ức"
          description={
            canEdit
              ? "Bấm 'Tạo phòng' để dựng phòng trưng bày ảnh đầu tiên."
              : "Quản trị/biên tập viên sẽ tạo phòng trưng bày ảnh."
          }
        />
      )}

      {!isLoading && rooms && rooms.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id} className="min-w-0">
              <div className="flex h-full gap-3 rounded-lg border bg-card p-3">
                <Link
                  to={`/clans/${clan.id}/memory-room/${r.id}`}
                  className="flex min-w-0 flex-1 gap-3 hover:opacity-90"
                >
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {r.cover_image_url ? (
                      <img
                        src={r.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconCamera className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.name}</p>
                    {r.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                    <RecordDates
                      createdAt={r.created_at}
                      updatedAt={r.updated_at}
                      className="mt-1 text-xs text-muted-foreground/80"
                    />
                  </div>
                </Link>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Xoá phòng "${r.name}"?`)) deleteM.mutate(r.id);
                    }}
                    className="self-start rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    Xoá
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
