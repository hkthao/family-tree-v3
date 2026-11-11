import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { IconCamera, IconGrid, IconList, IconSearch } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
} from "@/hooks/useClientPaging";
import {
  createMosaic,
  listMosaicSummaries,
  seedMosaicFromMembers,
  type MosaicSummary,
} from "@/lib/queries/mosaics";
import { unaccent } from "@/lib/unaccent";

const VIEW_KEY = "family-tree:mosaics-view-mode";
type ViewMode = "list" | "grid";

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export default function Mosaics() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      /* bỏ qua */
    }
  }, [viewMode]);

  const { data, isLoading } = useQuery({
    queryKey: ["mosaics", clan.id, userId, "summary"],
    queryFn: () => listMosaicSummaries(clan.id),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return (data ?? []).filter(
      (m) =>
        !q ||
        unaccent(`${m.title} ${m.description ?? ""}`)
          .toLowerCase()
          .includes(q),
    );
  }, [data, search]);
  const paging = useClientPaging(filtered, 20);

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Ảnh ghép" },
        ]}
      />
      <PageHeader
        icon={<IconCamera className="h-7 w-7" />}
        title="Ảnh ghép"
        description="Mỗi thành viên góp một tấm ảnh — tất cả ghép lại thành một bức tranh chung của dòng họ."
        actionsBelow
        actions={
          canEdit ? (
            <Fab onClick={() => setCreating(true)} label="Tạo bức ghép" />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 sm:flex-1">
          <SearchInput
            label="Tìm bức ảnh"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              paging.patchAndResetPage({});
            }}
            placeholder="Tìm theo tên, mô tả…"
          />
        </div>
        <SegmentedControl ariaLabel="Chế độ hiển thị">
          <SegmentedButton
            active={viewMode === "list"}
            onClick={() => setViewMode("list")}
            title="Danh sách"
            ariaLabel="Danh sách"
            variant="icon-md"
          >
            <IconList className="h-4 w-4" />
          </SegmentedButton>
          <SegmentedButton
            active={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            title="Thẻ"
            ariaLabel="Thẻ"
            variant="icon-md"
          >
            <IconGrid className="h-4 w-4" />
          </SegmentedButton>
        </SegmentedControl>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            search.trim() ? (
              <IconSearch className="h-10 w-10" />
            ) : (
              <IconCamera className="h-10 w-10" />
            )
          }
          title={
            search.trim() ? "Không có bức nào khớp" : "Chưa có bức ảnh ghép nào"
          }
          description={
            search.trim()
              ? "Thử bỏ bớt từ khoá."
              : canEdit
                ? "Bấm nút '+' để tạo bức đầu tiên, rồi mời cả nhà góp ảnh."
                : "Quản trị/biên tập viên sẽ tạo bức ảnh ghép để cả nhà góp ảnh."
          }
        />
      ) : viewMode === "list" ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((m) => (
            <MosaicListItem key={m.id} mosaic={m} clanId={clan.id} />
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {paging.paged.map((m) => (
            <MosaicGridCard key={m.id} mosaic={m} clanId={clan.id} />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit="bức"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={creating}
        title="Tạo bức ảnh ghép"
        subtitle="Mỗi dòng họ tạo được nhiều bức."
        onClose={() => setCreating(false)}
        guard
      >
        {creating && (
          <NewMosaicForm clanId={clan.id} onCancel={() => setCreating(false)} />
        )}
      </SidePanel>
    </div>
  );
}

/** Ảnh xem trước: lưới 2×2 các mảnh đầu, ô thiếu để màu nền. */
function Preview({
  urls: rawUrls,
  className,
}: {
  urls?: string[];
  className: string;
}) {
  // Dữ liệu cache cũ có thể chưa có `previews`.
  const urls = rawUrls ?? [];
  return (
    <div
      className={`grid shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg border bg-muted ${className}`}
    >
      {[0, 1, 2, 3].map((i) =>
        urls[i] ? (
          <img
            key={i}
            src={urls[i]}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div key={i} className="grid place-items-center">
            {urls.length === 0 && i === 0 && (
              <IconCamera className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ),
      )}
    </div>
  );
}

function StatusChip({ mosaic }: { mosaic: MosaicSummary }) {
  return (
    <Chip tone={mosaic.status === "open" ? "success" : "neutral"}>
      {mosaic.status === "open" ? "Đang nhận mảnh" : "Đã đóng"}
    </Chip>
  );
}

function MosaicListItem({
  mosaic,
  clanId,
}: {
  mosaic: MosaicSummary;
  clanId: string;
}) {
  return (
    <li>
      <Link
        to={`/clans/${clanId}/mosaics/${mosaic.id}`}
        className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/40"
      >
        <Preview urls={mosaic.previews} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{mosaic.title}</p>
          <p className="text-sm text-muted-foreground">
            {mosaic.tileCount}/{mosaic.slots} mảnh
          </p>
          {mosaic.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {mosaic.description}
            </p>
          )}
          <RecordDates
            createdAt={mosaic.created_at}
            updatedAt={mosaic.updated_at}
            className="mt-1 truncate text-xs text-muted-foreground/80"
          />
        </div>
        <StatusChip mosaic={mosaic} />
      </Link>
    </li>
  );
}

function MosaicGridCard({
  mosaic,
  clanId,
}: {
  mosaic: MosaicSummary;
  clanId: string;
}) {
  return (
    <li>
      <Link
        to={`/clans/${clanId}/mosaics/${mosaic.id}`}
        className="flex h-full flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center shadow-sm transition-colors hover:border-primary"
      >
        <Preview urls={mosaic.previews} className="h-24 w-24" />
        <div className="w-full min-w-0">
          <p className="truncate text-sm font-medium leading-tight">
            {mosaic.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mosaic.tileCount}/{mosaic.slots} mảnh
          </p>
        </div>
        <StatusChip mosaic={mosaic} />
      </Link>
    </li>
  );
}

function NewMosaicForm({
  clanId,
  onCancel,
}: {
  clanId: string;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState(24);
  const [perMember, setPerMember] = useState(1);
  const [seed, setSeed] = useState(true);

  const createM = useMutation({
    mutationFn: async () => {
      // Lưới hơi ngang (~4:3); số ô làm tròn lên cho đủ hàng cuối.
      const cols = Math.min(
        12,
        Math.max(3, Math.round(Math.sqrt((slots * 4) / 3))),
      );
      const created = await createMosaic(clanId, {
        title: title.trim() || "Ảnh đại gia đình",
        description: description.trim() || null,
        max_per_member: perMember,
        slots: Math.min(500, Math.ceil(slots / cols) * cols),
        cols,
      });
      if (seed) {
        try {
          await seedMosaicFromMembers(created.id);
        } catch {
          /* nạp lỗi không chặn tạo bức */
        }
      }
      return created;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["mosaics", clanId] });
      navigate(`/clans/${clanId}/mosaics/${m.id}`);
    },
    onError: (e) =>
      toast.error("Không tạo được bức ảnh", {
        description: (e as Error).message,
      }),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        createM.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="mosaic-title">Tên bức ảnh</Label>
        <Input
          id="mosaic-title"
          icon={<IconCamera />}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Đại gia đình Tết 2027"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mosaic-desc">Mô tả (tuỳ chọn)</Label>
        <Textarea
          id="mosaic-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mosaic-slots">Số mảnh của bức (số ô ghép)</Label>
        <Input
          id="mosaic-slots"
          type="number"
          min={4}
          max={500}
          value={slots}
          onChange={(e) =>
            setSlots(Math.min(500, Math.max(4, Number(e.target.value) || 4)))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mosaic-per">Số mảnh mỗi người được góp</Label>
        <Input
          id="mosaic-per"
          type="number"
          min={1}
          max={50}
          value={perMember}
          onChange={(e) =>
            setPerMember(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
          }
        />
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={seed}
          onChange={(e) => setSeed(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          <span className="font-medium">Nạp sẵn avatar thành viên</span>
          <span className="block text-sm text-muted-foreground">
            Mỗi người có ảnh đại diện trên cây thành một mảnh; đổi avatar thì
            mảnh tự đổi theo.
          </span>
        </span>
      </label>
      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" disabled={createM.isPending}>
          Tạo bức ảnh
        </Button>
      </FormActions>
    </form>
  );
}
