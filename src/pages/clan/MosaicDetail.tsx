import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { IconTextarea } from "@/components/mosaic/IconTextarea";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import {
  IconPuzzle,
  IconCheck,
  IconGrid,
  IconLink,
  IconPencil,
  IconScroll,
  IconTrash,
  IconUnlock,
  IconUsers,
} from "@/components/icons";
import { MosaicBoard } from "@/components/mosaic/MosaicBoard";
import { MosaicFrame } from "@/components/mosaic/MosaicFrame";
import {
  MAX_SLOTS,
  normalizeSlots,
  type MosaicVariant,
} from "@/components/mosaic/jigsaw";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { PageHeader } from "@/components/PageHeader";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { uploadMosaicPhoto } from "@/lib/photoUpload";
import {
  addMosaicTile,
  deleteMosaic,
  deleteMosaicTile,
  getMosaic,
  getMyAvatar,
  listMosaicTiles,
  moveMosaicTile,
  setMosaicDashboard,
  updateMosaic,
  updateMosaicTile,
  type Mosaic,
  type MosaicTile,
} from "@/lib/queries/mosaics";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
export default function MosaicDetail() {
  const { mosaicId = "" } = useParams();
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [arrange, setArrange] = useState(false);
  // Kiểu hiển thị nhớ theo thiết bị: lưới gọn (mặc định) hoặc puzzle răng cưa.
  const [variant, setVariant] = useState<MosaicVariant>(() => {
    try {
      return localStorage.getItem("family-tree:mosaic-variant") === "puzzle"
        ? "puzzle"
        : "grid";
    } catch {
      return "grid";
    }
  });
  const pickVariant = (v: MosaicVariant) => {
    setVariant(v);
    try {
      localStorage.setItem("family-tree:mosaic-variant", v);
    } catch {
      /* bỏ qua */
    }
  };
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<MosaicTile | null>(null);

  const mosaicKey = ["mosaic", mosaicId];
  const tilesKey = ["mosaic-tiles", mosaicId, userId];
  const { data: mosaic, isLoading } = useQuery({
    queryKey: mosaicKey,
    queryFn: () => getMosaic(mosaicId),
    enabled: !!mosaicId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: tiles = [] } = useQuery({
    queryKey: tilesKey,
    queryFn: () => listMosaicTiles(mosaicId),
    enabled: !!mosaicId && !!userId,
    // Nội dung nhiều người cùng sửa: luôn tải mới khi mở (cache toàn cục giữ rất lâu).
    staleTime: 0,
    refetchOnMount: "always",
  });

  const mine = tiles.filter((t) => t.user_id === userId).length;
  const quota = mosaic ? mosaic.max_per_member : 1;
  const canAddMore =
    !!mosaic && (canEdit || (mosaic.status === "open" && mine < quota));
  const canMove = (t: MosaicTile) => canEdit || t.user_id === userId;
  const canMoveAny = canEdit || mine > 0;

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["mosaic-tiles", mosaicId] });

  // Kéo-thả: cập nhật lạc quan, lỗi thì hoàn lại.
  const moveM = useMutation({
    mutationFn: (v: { id: string; slot: number }) =>
      moveMosaicTile(v.id, v.slot),
    onMutate: async ({ id, slot }) => {
      await qc.cancelQueries({ queryKey: tilesKey });
      const prev = qc.getQueryData<MosaicTile[]>(tilesKey);
      if (prev) {
        const me = prev.find((t) => t.id === id);
        qc.setQueryData<MosaicTile[]>(
          tilesKey,
          prev.map((t) =>
            t.id === id
              ? { ...t, position: slot }
              : me && t.position === slot
                ? { ...t, position: me.position }
                : t,
          ),
        );
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(tilesKey, ctx.prev);
      toast.error(t`Không di chuyển được mảnh`, {
        description: (e as Error).message,
      });
    },
    onSettled: refresh,
  });

  const toggleStatusM = useMutation({
    mutationFn: () =>
      updateMosaic(mosaicId, {
        status: mosaic!.status === "open" ? "closed" : "open",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: mosaicKey }),
  });

  const deleteTileM = useMutation({
    mutationFn: (t: MosaicTile) => deleteMosaicTile(t),
    onSuccess: () => {
      setSelected(null);
      refresh();
      toast.success(t`Đã xoá mảnh`);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  const hideTileM = useMutation({
    mutationFn: (t: MosaicTile) =>
      updateMosaicTile(t.id, {
        status: t.status === "hidden" ? "approved" : "hidden",
      }),
    onSuccess: () => {
      setSelected(null);
      refresh();
    },
  });

  if (isLoading) return <p className="text-muted-foreground">{t`Đang tải…`}</p>;
  if (!mosaic) {
    return (
      <EmptyState
        icon={<IconPuzzle className="h-10 w-10" />}
        title={t`Không tìm thấy bức ảnh`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Ảnh ghép`, to: `/clans/${clan.id}/mosaics` },
          { label: mosaic.title },
        ]}
      />
      <PageHeader
        icon={<IconPuzzle className="h-7 w-7" />}
        title={mosaic.title}
        description={
          mosaic.description ||
          t`${tiles.length}/${mosaic.slots} mảnh · mỗi người góp tối đa ${mosaic.max_per_member}` +
            (mosaic.status === "closed" ? t` · đã đóng` : "")
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {!canEdit && mosaic.status === "open" && !canAddMore && (
          <span className="text-sm text-muted-foreground">
            <Trans>
            Bạn đã góp đủ {quota} mảnh.
            </Trans>
          </span>
        )}
        {canMoveAny && tiles.length > 0 && (
          <Button
            size="sm"
            variant={arrange ? "default" : "outline"}
            onClick={() => setArrange((v) => !v)}
          >
            {arrange ? (
              <IconCheck className="mr-1.5 h-4 w-4" />
            ) : (
              <IconGrid className="mr-1.5 h-4 w-4" />
            )}
            {arrange ? t`Xong` : t`Sắp xếp`}
          </Button>
        )}
        <SegmentedControl ariaLabel={t`Kiểu hiển thị`}>
          <SegmentedButton
            active={variant === "grid"}
            onClick={() => pickVariant("grid")}
          >
            {t`Lưới`}
          </SegmentedButton>
          <SegmentedButton
            active={variant === "puzzle"}
            onClick={() => pickVariant("puzzle")}
          >
            Puzzle
          </SegmentedButton>
        </SegmentedControl>
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <IconPencil className="mr-1.5 h-4 w-4" />
              {t`Sửa`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleStatusM.mutate()}
            >
              {mosaic.status === "open" ? (
                <IconCheck className="mr-1.5 h-4 w-4" />
              ) : (
                <IconUnlock className="mr-1.5 h-4 w-4" />
              )}
              {mosaic.status === "open" ? t`Hoàn tất` : t`Mở lại`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: t`Xoá bức "${mosaic.title}"?`,
                  description: t`Toàn bộ mảnh trong bức sẽ bị xoá.`,
                  confirmLabel: t`Xoá`,
                  destructive: true,
                });
                if (!ok) return;
                await deleteMosaic(mosaicId);
                qc.invalidateQueries({ queryKey: ["mosaics", clan.id] });
                navigate(`/clans/${clan.id}/mosaics`);
              }}
            >
              <IconTrash className="mr-1.5 h-4 w-4" />
              {t`Xoá`}
            </Button>
          </>
        )}
      </div>

      {arrange && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Kéo một mảnh thả vào ô khác để di chuyển
          {canEdit
            ? t` (thả lên mảnh khác sẽ đổi chỗ)`
            : t` (chỉ kéo được mảnh của bạn vào ô trống)`}
          .
        </p>
      )}

      <MosaicFrame>
        <MosaicBoard
          seed={mosaic.id}
          variant={variant}
          cols={mosaic.cols}
          slots={mosaic.slots}
          tiles={tiles}
          arrange={arrange}
          canMove={canMove}
          canAdd={canAddMore}
          onSelect={setSelected}
          onAdd={() => setAdding(true)}
          onMove={(id, slot) => moveM.mutate({ id, slot })}
        />
      </MosaicFrame>

      <SidePanel
        open={editing}
        title={t`Sửa bức ảnh`}
        subtitle={mosaic.title}
        onClose={() => setEditing(false)}
        guard
      >
        {editing && (
          <EditMosaicForm
            mosaic={mosaic}
            minSlots={tiles.reduce((m, t) => Math.max(m, t.position + 1), 4)}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              qc.invalidateQueries({ queryKey: mosaicKey });
              qc.invalidateQueries({ queryKey: ["mosaics", clan.id] });
              toast.success(t`Đã lưu bức ảnh`);
            }}
          />
        )}
      </SidePanel>

      <SidePanel
        open={adding}
        title={t`Thêm mảnh của tôi`}
        subtitle={mosaic.title}
        onClose={() => setAdding(false)}
        guard
      >
        {adding && (
          <AddTileForm
            clanId={clan.id}
            mosaicId={mosaicId}
            userId={userId}
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              refresh();
            }}
          />
        )}
      </SidePanel>

      <SidePanel
        open={!!selected}
        title={selected?.caption || t`Mảnh ghép`}
        subtitle={mosaic.title}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-3">
            {selected.url && (
              <img
                src={selected.url}
                alt={selected.caption ?? ""}
                className="w-full rounded-lg border"
              />
            )}
            {selected.status === "hidden" && (
              <p className="text-sm text-muted-foreground">
                {t`Mảnh này đang bị ẩn với người khác.`}
              </p>
            )}
            <FormActions>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => hideTileM.mutate(selected)}
                >
                  {selected.status === "hidden" ? t`Hiện mảnh` : t`Ẩn mảnh`}
                </Button>
              )}
              {canMove(selected) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t`Xoá mảnh này?`,
                      confirmLabel: t`Xoá`,
                      destructive: true,
                    });
                    if (ok) deleteTileM.mutate(selected);
                  }}
                >
                  <IconTrash className="mr-1.5 h-4 w-4" />
                  {t`Xoá`}
                </Button>
              )}
            </FormActions>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

function AddTileForm({
  clanId,
  mosaicId,
  userId,
  onCancel,
  onDone,
}: {
  clanId: string;
  mosaicId: string;
  userId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { data: avatar } = useQuery({
    queryKey: ["mosaic-my-avatar", clanId, userId],
    queryFn: () => getMyAvatar(clanId, userId),
    enabled: !!userId,
    staleTime: 0,
  });
  // Mặc định lấy avatar của tôi (nếu có); người dùng vẫn đổi sang tải ảnh / dán link được.
  const [picked, setPicked] = useState<"avatar" | "file" | "url" | null>(null);
  const mode = picked ?? (avatar ? "avatar" : "file");
  const setMode = setPicked;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [err, setErr] = useState("");

  const preview =
    mode === "avatar"
      ? (avatar?.url ?? "")
      : mode === "url"
        ? url.trim()
        : file
          ? URL.createObjectURL(file)
          : "";

  const saveM = useMutation({
    mutationFn: async () => {
      let path: string;
      let personId: string | null = null;
      if (mode === "avatar") {
        if (!avatar) throw new Error(t`Bạn chưa có ảnh avatar`);
        path = avatar.path;
        personId = avatar.personId;
      } else if (mode === "url") {
        const u = url.trim();
        if (!/^https:\/\/\S+$/i.test(u))
          throw new Error(t`Link ảnh phải bắt đầu bằng https://`);
        path = u;
      } else {
        if (!file) throw new Error(t`Chọn một ảnh`);
        path = (await uploadMosaicPhoto(clanId, userId, file)).path;
      }
      await addMosaicTile(mosaicId, {
        photo_path: path,
        caption:
          caption.trim() || (mode === "avatar" ? (avatar?.name ?? null) : null),
        person_id: personId,
      });
    },
    onSuccess: () => {
      toast.success(t`Đã thêm mảnh vào bức ảnh`);
      onDone();
    },
    onError: (e) => setErr((e as Error).message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr("");
        saveM.mutate();
      }}
    >
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t`Nguồn ảnh`}
      >
        {avatar && (
          <Button
            type="button"
            size="sm"
            variant={mode === "avatar" ? "default" : "outline"}
            onClick={() => setMode("avatar")}
          >
            {t`Avatar của tôi`}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant={mode === "file" ? "default" : "outline"}
          onClick={() => setMode("file")}
        >
          {t`Tải ảnh lên`}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "url" ? "default" : "outline"}
          onClick={() => setMode("url")}
        >
          {t`Dán link ảnh`}
        </Button>
      </div>

      {mode === "avatar" ? (
        <p className="text-xs text-muted-foreground">
          Dùng ảnh đại diện của <strong>{avatar?.name}</strong> trên cây. Khi
          bạn đổi avatar, mảnh này tự đổi theo.
        </p>
      ) : mode === "file" ? (
        <div className="space-y-1.5">
          {!avatar && (
            <p className="text-xs text-muted-foreground">
              <Trans>
                <Trans>
                  <Trans>
                    Chọn vị trí của bạn trên cây và có ảnh avatar để dùng nó làm
                    mảnh mặc định.
                  </Trans>
                </Trans>
              </Trans>
            </p>
          )}
          <Label htmlFor="tile-file">{t`Ảnh`}</Label>
          <input
            id="tile-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <p className="text-xs text-muted-foreground">
            <Trans>
              <Trans>
                <Trans>
                  Ảnh được tự cắt vuông và nén nhỏ (≈360 px, dưới 40 KB) để tiết
                  kiệm dung lượng.
                </Trans>
              </Trans>
            </Trans>
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="tile-url">{t`Link ảnh (https://…)`}</Label>
          <Input
            id="tile-url"
            icon={<IconLink />}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/anh.jpg"
          />
          <p className="text-xs text-muted-foreground">
            {t`Ảnh giữ ở nơi khác; nếu chủ link xoá ảnh thì mảnh sẽ trống.`}
          </p>
        </div>
      )}

      {preview && (
        <img
          src={preview}
          alt=""
          className="mx-auto aspect-square w-40 rounded-lg border object-cover"
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tile-caption">{t`Chú thích (tuỳ chọn)`}</Label>
        <Input
          id="tile-caption"
          icon={<IconPencil />}
          placeholder={
            mode === "avatar" && avatar
              ? t`Bỏ trống sẽ dùng tên: ${avatar.name}`
              : t`VD: Cả nhà ngày Tết 2026`
          }
          value={caption}
          maxLength={200}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t`Huỷ`}
        </Button>
        <Button type="submit" disabled={saveM.isPending}>
          {saveM.isPending ? t`Đang xử lý…` : t`Thêm`}
        </Button>
      </FormActions>
    </form>
  );
}

function EditMosaicForm({
  mosaic,
  minSlots,
  onCancel,
  onSaved,
}: {
  mosaic: Mosaic;
  /** Không cho thu nhỏ dưới ô của mảnh xa nhất đang có. */
  minSlots: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(mosaic.title);
  const [description, setDescription] = useState(mosaic.description ?? "");
  const [slots, setSlots] = useState(mosaic.slots);
  const [cols, setCols] = useState(mosaic.cols);
  const [perMember, setPerMember] = useState(mosaic.max_per_member);
  const [onDash, setOnDash] = useState(mosaic.show_on_dashboard);

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const saveM = useMutation({
    mutationFn: async () => {
      await updateMosaic(mosaic.id, {
        title: title.trim() || t`Ảnh đại gia đình`,
        description: description.trim() || null,
        // Số ô luôn tròn hàng theo số cột (không để hàng cuối thiếu mảnh).
        slots: normalizeSlots(
          clamp(slots, minSlots, MAX_SLOTS),
          clamp(cols, 3, 12),
        ),
        cols: clamp(cols, 3, 12),
        max_per_member: clamp(perMember, 1, 50),
      });
      if (onDash !== mosaic.show_on_dashboard) {
        await setMosaicDashboard(mosaic.clan_id, mosaic.id, onDash);
      }
    },
    onSuccess: onSaved,
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        saveM.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="edit-title">{t`Tên bức ảnh`}</Label>
        <Input
          id="edit-title"
          icon={<IconPuzzle />}
          placeholder={t`VD: Đại gia đình Tết 2027`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <IconTextarea
        id="edit-desc"
        icon={<IconScroll />}
        label={t`Mô tả (tuỳ chọn)`}
        placeholder={t`Vài dòng giới thiệu bức ảnh…`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="space-y-1.5">
        <Label htmlFor="edit-slots">{t`Số mảnh của bức (số ô ghép)`}</Label>
        <Input
          id="edit-slots"
          icon={<IconGrid />}
          placeholder={t`VD: 24 (tối đa 150)`}
          type="number"
          min={minSlots}
          max={MAX_SLOTS}
          value={slots}
          onChange={(e) => setSlots(Number(e.target.value) || minSlots)}
        />
        <p className="text-xs text-muted-foreground">
          <Trans>
          Tối thiểu {minSlots} (đang có mảnh ở ô xa nhất).
          </Trans>
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-cols">{t`Số cột`}</Label>
        <Input
          id="edit-cols"
          icon={<IconGrid />}
          placeholder={t`VD: 6 (từ 3 đến 12)`}
          type="number"
          min={3}
          max={12}
          value={cols}
          onChange={(e) => setCols(Number(e.target.value) || 3)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-per">{t`Số mảnh mỗi người được góp`}</Label>
        <Input
          id="edit-per"
          icon={<IconUsers />}
          placeholder="VD: 1"
          type="number"
          min={1}
          max={50}
          value={perMember}
          onChange={(e) => setPerMember(Number(e.target.value) || 1)}
        />
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={onDash}
          onChange={(e) => setOnDash(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          <span className="font-medium">{t`Hiển thị ở màn Tổng quan`}</span>
          <span className="block text-sm text-muted-foreground">
            {t`Không chọn bức nào thì Tổng quan lấy bức đầu tiên trong danh sách.`}
          </span>
        </span>
      </label>
      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t`Huỷ`}
        </Button>
        <Button type="submit" disabled={saveM.isPending}>
          {t`Lưu`}
        </Button>
      </FormActions>
    </form>
  );
}
