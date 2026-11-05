import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { IconCopy, IconPencil, IconTrash, IconTree } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { NewCanvasPanel, type NewCanvasKind } from "@/components/treeCanvas/NewCanvasPanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { formatRelative } from "@/lib/formatDate";
import { getTreeData } from "@/lib/queries/tree";
import { DEFAULT_LAYOUT } from "@/lib/tree/canvasModel";
import {
  createTreeCanvas,
  deleteTreeCanvas,
  listTreeCanvases,
  updateTreeCanvas,
  type TreeCanvas,
} from "@/lib/queries/treeCanvas";

const PAGE_SIZE_OPTIONS = [6, 12, 24];

/**
 * Danh sách các cây (bố cục canvas) đã lưu của dòng họ. Một dòng họ có nhiều
 * cây; mở một cây để chỉnh ở trang Canvas phả đồ.
 */
export default function TreeCanvases() {
  const { clan } = useClanContext();
  const canEdit = canEditClan(clan);
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const base = `/clans/${clan.id}`;
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [editing, setEditing] = useState<TreeCanvas | null>(null);
  const [editName, setEditName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["tree-canvases", clan.id],
    queryFn: () => listTreeCanvases(clan.id),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "vi")
        : b.updated_at.localeCompare(a.updated_at),
    );
  }, [data, search, sort]);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  async function createNew(rawName: string, kind: NewCanvasKind) {
    const name = rawName.trim();
    if (!name) return toast.error("Hãy đặt tên cho cây mới");
    setCreateBusy(true);
    try {
      let nodeStyles: Record<string, { hidden: boolean }> = {};
      if (kind === "blank") {
        const tree = await getTreeData(clan.id);
        nodeStyles = Object.fromEntries(tree.persons.map((p) => [p.id, { hidden: true }]));
      }
      const c = await createTreeCanvas(clan.id, name, { ...DEFAULT_LAYOUT, nodeStyles });
      await qc.invalidateQueries({ queryKey: ["tree-canvases", clan.id] });
      setCreating(false);
      toast.success("Đã tạo cây mới");
      navigate(`${base}/tree-canvases/${c.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được");
    } finally {
      setCreateBusy(false);
    }
  }

  async function rename() {
    if (!editing) return;
    const name = editName.trim();
    if (!name) return toast.error("Tên cây không được để trống");
    setBusyId(editing.id);
    try {
      await updateTreeCanvas(editing.id, { name });
      await qc.invalidateQueries({ queryKey: ["tree-canvases", clan.id] });
      setEditing(null);
      toast.success("Đã đổi tên");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đổi tên được");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(c: TreeCanvas) {
    setBusyId(c.id);
    try {
      await createTreeCanvas(clan.id, `${c.name} (bản sao)`.slice(0, 80), c.layout);
      await qc.invalidateQueries({ queryKey: ["tree-canvases", clan.id] });
      toast.success("Đã nhân bản");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không nhân bản được");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: TreeCanvas) {
    const ok = await confirm({
      title: `Xoá "${c.name}"?`,
      description: "Bố cục đã lưu sẽ bị xoá vĩnh viễn.",
      confirmLabel: "Xoá",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await deleteTreeCanvas(c.id);
      await qc.invalidateQueries({ queryKey: ["tree-canvases", clan.id] });
      toast.success("Đã xoá");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xoá được");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Dòng họ", to: "/clans" },
          { label: clan.name, to: base },
          { label: "Canvas phả đồ" },
        ]}
      />
      <PageHeader
        icon={<IconTree className="h-6 w-6" />}
        title="Canvas phả đồ"
        description="Các cây tự thiết kế của dòng họ: kéo thả thẻ, nối đường, chọn nền rồi xuất PDF."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Không tải được danh sách: {error instanceof Error ? error.message : "lỗi không rõ"}
        </p>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={<IconTree className="h-10 w-10" />}
          title="Chưa có cây nào"
          description="Tạo cây đầu tiên để tự sắp xếp phả đồ theo ý, hoặc mở cây tự xếp để xem thử."
          primary={canEdit ? { label: "Tạo cây mới", onClick: () => setCreating(true) } : null}
          secondary={{ label: "Xem cây tự xếp", to: `${base}/tree-canvases/auto` }}
        />
      )}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 sm:flex-1">
            <SearchInput
              label="Tìm cây"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên cây…"
            />
          </div>
          <Select
            aria-label="Sắp xếp"
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "name")}
            className="h-10 w-auto text-sm"
          >
            <option value="recent">Mới cập nhật</option>
            <option value="name">Tên A → Z</option>
          </Select>
        </div>
      )}

      {data && data.length > 0 && total === 0 && (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Không có cây nào khớp "{search}".
        </p>
      )}

      {data && data.length > 0 && total > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="canvas-list">
          {pageItems.map((c) => {
            const people = Object.keys(c.layout.positions).length - c.layout.extras.length;
            const shown = Math.max(
              0,
              people - Object.values(c.layout.nodeStyles).filter((s) => s.hidden).length,
            );
            return (
              <li key={c.id} className="flex flex-col rounded-xl border bg-card shadow-sm">
                <Link
                  to={`${base}/tree-canvases/${c.id}`}
                  className="flex-1 space-y-1 rounded-t-xl p-4 hover:bg-secondary/40"
                >
                  <h2 className="line-clamp-2 text-base font-semibold">{c.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Cập nhật {formatRelative(c.updated_at) ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {shown} người · {c.layout.extras.length} thẻ/chữ thêm · {c.layout.links.length} đường nối
                  </p>
                </Link>
                <div className="flex items-center justify-end gap-2 border-t p-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`${base}/tree-canvases/${c.id}`}>Mở</Link>
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-10 px-0"
                        title="Đổi tên"
                        aria-label={`Đổi tên ${c.name}`}
                        disabled={busyId === c.id}
                        onClick={() => { setEditing(c); setEditName(c.name); }}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-10 px-0"
                        title="Nhân bản"
                        aria-label={`Nhân bản ${c.name}`}
                        disabled={busyId === c.id}
                        onClick={() => duplicate(c)}
                      >
                        <IconCopy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive-outline"
                        className="w-10 px-0"
                        title="Xoá"
                        aria-label={`Xoá ${c.name}`}
                        disabled={busyId === c.id}
                        onClick={() => remove(c)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          <li className="rounded-xl border border-dashed bg-card/50">
            <Link
              to={`${base}/tree-canvases/auto`}
              className="flex h-full min-h-[6rem] flex-col items-center justify-center gap-1 p-4 text-center text-sm text-muted-foreground hover:bg-secondary/40"
            >
              <span className="font-medium text-foreground">Cây tự xếp</span>
              Xem cả gia phả xếp theo đời (không lưu)
            </Link>
          </li>
        </ul>
      )}

      {data && data.length > 0 && (
        <Pagination
          page={curPage}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          unit="cây"
          onPageChange={setPage}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        />
      )}

      <SidePanel
        open={!!editing}
        title="Đổi tên cây"
        onClose={() => setEditing(null)}
        guard={false}
      >
        <div className="flex flex-1 flex-col space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Tên cây</span>
            <Input value={editName} maxLength={80} autoFocus onChange={(e) => setEditName(e.target.value)} />
          </label>
          <FormActions>
            <Button variant="outline" onClick={() => setEditing(null)}>Huỷ</Button>
            <Button onClick={rename} disabled={busyId === editing?.id}>Lưu</Button>
          </FormActions>
        </div>
      </SidePanel>

      <NewCanvasPanel
        open={creating}
        busy={createBusy}
        onClose={() => setCreating(false)}
        onCreate={createNew}
      />

      {canEdit && <Fab onClick={() => setCreating(true)} label="Tạo cây mới" />}
    </div>
  );
}
