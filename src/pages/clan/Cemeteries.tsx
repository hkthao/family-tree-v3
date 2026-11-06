import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { IconTile } from "@/components/IconTile";
import {
  IconBuildings,
  IconCompass,
  IconGrave,
  IconMapPin,
  IconSearch,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Textarea } from "@/components/ui/textarea";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging } from "@/hooks/useClientPaging";
import {
  createCemetery,
  deleteCemetery,
  listCemeteries,
  updateCemetery,
  type CemeteryListItem,
} from "@/lib/queries/cemeteries";
import { unaccent } from "@/lib/unaccent";

/** Trạng thái ngăn kéo: thêm mới, xem (chỉ đọc) hoặc sửa một cơ sở. */
type PanelState =
  | { mode: "new" }
  | { mode: "view" | "edit"; item: CemeteryListItem }
  | null;

export default function Cemeteries() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const askConfirm = useConfirm();
  const canEdit = canEditClan(clan);

  const { data: cemeteries } = useQuery({
    queryKey: ["cemeteries", clan.id, userId],
    queryFn: () => listCemeteries(clan.id),
    enabled: !!userId,
  });

  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cemeteries", clan.id] });

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    if (!q) return cemeteries ?? [];
    return (cemeteries ?? []).filter((c) =>
      unaccent(`${c.name} ${c.address ?? ""}`).toLowerCase().includes(q),
    );
  }, [cemeteries, search]);
  const paging = useClientPaging(filtered, 20);

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteCemetery(id),
    onSuccess: () => {
      invalidate();
      closePanel();
      toast.success("Đã xoá cơ sở");
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Mộ phần & tro cốt", to: `/clans/${clan.id}/graves` },
          { label: "Cơ sở / nghĩa trang" },
        ]}
      />
      <PageHeader
        icon={<IconMapPin className="h-7 w-7" />}
        title="Cơ sở / nghĩa trang"
        description="Nghĩa trang, chùa, hoa viên, tháp lưu tro… để gom các mộ phần theo cơ sở."
        actionsBelow
        actions={canEdit ? <Fab onClick={() => setPanel({ mode: "new" })} label="Thêm cơ sở" /> : undefined}
      />

      <SearchInput
        label="Tìm cơ sở"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          paging.patchAndResetPage({});
        }}
        placeholder="Tìm theo tên / địa chỉ…"
      />

      {!cemeteries ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={search.trim() ? "Không có cơ sở nào khớp" : "Chưa có cơ sở nào"}
          description={
            search.trim()
              ? "Thử bỏ bớt từ khoá."
              : canEdit
                ? "Bấm nút '+' để tạo cơ sở đầu tiên."
                : "Chưa có dữ liệu."
          }
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setPanel({ mode: "view", item: c })}
                className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
              >
                <IconTile icon={IconBuildings} tone="teal" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  {c.address && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <IconMapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2 min-w-0">{c.address}</span>
                    </p>
                  )}
                  <RecordDates
                    createdAt={c.created_at}
                    updatedAt={c.updated_at}
                    className="mt-0.5 truncate text-xs text-muted-foreground/80"
                  />
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    {c.latitude != null && c.longitude != null && (
                      <Chip tone="info" icon={<IconMapPin />}>
                        Có vị trí
                      </Chip>
                    )}
                    <Chip tone="violet" icon={<IconGrave />}>
                      {c.place_count} nơi an nghỉ
                    </Chip>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit="cơ sở"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <p className="pt-2 text-xs text-muted-foreground">
        <Link to={`/clans/${clan.id}/graves`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <IconGrave className="h-3.5 w-3.5" /> Về danh sách mộ phần
        </Link>
      </p>

      <SidePanel
        open={panel !== null}
        title={panel?.mode === "new" ? "Thêm cơ sở" : panel?.mode === "edit" ? "Sửa cơ sở" : "Cơ sở / nghĩa trang"}
        subtitle={panel && panel.mode !== "new" ? panel.item.name : undefined}
        onClose={closePanel}
        guard={panel?.mode !== "view"}
      >
        {panel && (
          <CemeteryForm
            key={panel.mode === "new" ? "new" : `${panel.mode}-${panel.item.id}`}
            clanId={clan.id}
            initial={panel.mode === "new" ? null : panel.item}
            readOnly={panel.mode === "view"}
            canEdit={canEdit}
            onEdit={() => panel.mode === "view" && setPanel({ mode: "edit", item: panel.item })}
            onCancel={() => setPanel(panel.mode === "edit" ? { mode: "view", item: panel.item } : null)}
            onSaved={() => {
              closePanel();
              invalidate();
            }}
            onDelete={
              panel.mode === "edit"
                ? async () => {
                    const ok = await askConfirm({
                      title: `Xoá cơ sở "${panel.item.name}"?`,
                      description: "Các mộ đang gắn cơ sở này sẽ bị gỡ liên kết (không xoá mộ).",
                      confirmLabel: "Xoá",
                      destructive: true,
                    });
                    if (ok) deleteM.mutate(panel.item.id);
                  }
                : undefined
            }
          />
        )}
      </SidePanel>
    </div>
  );
}

function CemeteryForm({
  clanId,
  initial,
  readOnly,
  canEdit,
  onEdit,
  onCancel,
  onSaved,
  onDelete,
}: {
  clanId: string;
  /** null = thêm mới. */
  initial: CemeteryListItem | null;
  readOnly: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const m = useMutation({
    mutationFn: () => {
      const fields = {
        name: name.trim(),
        address: address.trim() || null,
        latitude: lat.trim() ? Number(lat) : null,
        longitude: lng.trim() ? Number(lng) : null,
        notes: notes.trim() || null,
      };
      return initial
        ? updateCemetery(initial.id, fields).then(() => ({ id: initial.id }))
        : createCemetery(clanId, fields);
    },
    onSuccess: () => {
      toast.success(initial ? "Đã lưu" : "Đã thêm cơ sở");
      onSaved();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  function useCurrentLocation() {
    if (!navigator.geolocation) return toast.error("Trình duyệt không hỗ trợ định vị");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
      },
      () => toast.error("Không lấy được vị trí (cần cấp quyền)"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) m.mutate();
      }}
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-2">
          <Label htmlFor="cem-name" required>
            Tên cơ sở
          </Label>
          <Input
            id="cem-name"
            icon={<IconBuildings />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="vd: Nghĩa trang Lạc Hồng, Chùa Vĩnh Nghiêm"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cem-addr">Địa chỉ</Label>
          <Input
            id="cem-addr"
            icon={<IconMapPin />}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="vd: xã …, huyện …, tỉnh …"
          />
        </div>
        <div className="space-y-2">
          <Label>Toạ độ GPS (tuỳ chọn)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-32"
              icon={<IconCompass />}
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="vĩ độ"
            />
            <Input
              className="w-32"
              icon={<IconCompass />}
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="kinh độ"
            />
            <Button type="button" variant="outline" data-edit-only onClick={useCurrentLocation}>
              <IconMapPin className="mr-1 h-4 w-4" /> Lấy vị trí hiện tại
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cem-notes">Ghi chú</Label>
          <Textarea id="cem-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </ReadOnlyFieldset>

      {readOnly && initial && (
        <Link
          to={`/clans/${clanId}/graves?cemetery=${initial.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <IconGrave className="h-4 w-4" />
          Xem {initial.place_count} mộ phần ở cơ sở này →
        </Link>
      )}

      <ViewEditActions
        readOnly={readOnly}
        canEdit={canEdit}
        onEdit={onEdit}
        onCancel={onCancel}
        onDelete={onDelete}
        saving={m.isPending}
        canSave={!!name.trim()}
        saveLabel={initial ? "Lưu" : "Thêm"}
      />
    </form>
  );
}
