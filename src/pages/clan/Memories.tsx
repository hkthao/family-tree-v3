import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FilterableSelect } from "@/components/FilterableSelect";
import { FabGroup } from "@/components/FabGroup";
import { MemoryFaces } from "@/components/community/MemoryFaces";
import { QuestionPanel } from "@/components/community/QuestionPanel";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { ContributeLinkPanel } from "@/components/community/ContributeLinkPanel";
import { MemoryCard } from "@/components/community/MemoryCard";
import { MemoryForm } from "@/components/community/MemoryForm";
import {
  IconBook,
  IconCamera,
  IconCheck,
  IconClock,
  IconCopy,
  IconHelp,
  IconLink,
  IconMicrophone,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSend,
  IconSettings,
  IconTag,
  IconTrash,
  IconUser,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DrawerViewActions, FormActions } from "@/components/ui/form-actions";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  canEditClan,
  isClanAdmin,
  useClanContext,
} from "@/hooks/useClanContext";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
  useSearchBox,
  useUrlFilter,
} from "@/hooks/useClientPaging";
import { supabase } from "@/lib/supabase";
import {
  contributeLinkUrl,
  deleteMemory,
  listClanMemories,
  listContributeLinks,
  revokeContributeLink,
  listQuestions,
  setQuestionStatus,
  type ContributeLink,
  type FamilyQuestion,
  setMemoryModeration,
  setMemoryStatus,
  type MemoryModeration,
  type MemoryStatus,
  type PersonMemory,
} from "@/lib/queries/community";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";
import { unaccent } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";

type Icon = React.ComponentType<{ className?: string }>;

const KIND_STYLE: Record<
  string,
  { label: string; tone: ChipTone; icon: Icon }
> = {
  story: { label: t`Câu chuyện`, tone: "info", icon: IconPencil },
  answer: { label: t`Trả lời`, tone: "indigo", icon: IconPencil },
  photo: { label: t`Ảnh`, tone: "teal", icon: IconCamera },
  audio: { label: t`Ghi âm`, tone: "violet", icon: IconMicrophone },
};

const STATUS_STYLE: Record<
  MemoryStatus,
  { label: string; tone: ChipTone; icon: Icon }
> = {
  pending: { label: t`Chờ duyệt`, tone: "warning", icon: IconClock },
  visible: { label: t`Đã duyệt`, tone: "success", icon: IconCheck },
  hidden: { label: t`Đã ẩn`, tone: "neutral", icon: IconX },
};

type StatusFilter = MemoryStatus | "all";
type KindFilter = "all" | "story" | "photo" | "audio" | "answer" | "identify";
type SourceFilter = "all" | "member" | "guest";

type PanelState =
  | { mode: "closed" }
  | { mode: "view"; id: string }
  | { mode: "new" }
  | { mode: "invite" }
  | { mode: "links" }
  | { mode: "settings" }
  | { mode: "question"; existing: FamilyQuestion | null };

/**
 * /clans/:id/dong-gop — "Đóng góp nội dung" (docs/plan-dong-gop-cong-dong.md): danh sách theo chuẩn
 * Danh bạ (tìm + phễu, danh sách chia vạch, phân trang, Fab). Bấm dòng mở ngăn kéo xem; editor+
 * duyệt / ẩn / xoá ở thanh nút đáy ngăn kéo. Link mời góp và cách duyệt cũng mở ngăn kéo.
 */
export default function Memories() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canModerate = canEditClan(clan);
  const admin = isClanAdmin(clan);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });
  const close = () => setPanel({ mode: "closed" });

  const [status, setStatus] = useUrlFilter<StatusFilter>("tt", "all");
  const [kind, setKind] = useUrlFilter<KindFilter>("loai", "all");
  const [source, setSource] = useUrlFilter<SourceFilter>("nguon", "all");
  const {
    q: search,
    text: searchText,
    setText: setSearchText,
  } = useSearchBox();

  const listKey = ["clan-memories", clan.id, userId] as const;
  const {
    data: rows,
    isLoading,
    error,
  } = useQuery({
    queryKey: listKey,
    queryFn: () => listClanMemories(clan.id),
    enabled: !!userId,
  });

  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return (rows ?? []).filter(
      (m) =>
        (status === "all" || m.status === status) &&
        (kind === "all" ||
          (kind === "answer"
            ? !!m.question_id
            : kind === "identify"
              ? m.identify
              : m.kind === kind || (kind === "story" && m.kind === "answer"))) &&
        (source === "all" || (source === "guest") === m.is_guest) &&
        (!q ||
          unaccent(
            `${m.person_name ?? ""} ${m.author_label} ${m.author_relation ?? ""} ${m.body ?? ""} ${m.place ?? ""}`,
          )
            .toLowerCase()
            .includes(q)),
    );
  }, [rows, status, kind, source, search]);
  const paging = useClientPaging(filtered, 20);
  const pendingCount = (rows ?? []).filter(
    (m) => m.status === "pending",
  ).length;
  const activeFilters = [
    status !== "all",
    kind !== "all",
    source !== "all",
  ].filter(Boolean).length;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["clan-memories", clan.id] });
    void qc.invalidateQueries({ queryKey: ["community-summary", clan.id] });
    void qc.invalidateQueries({ queryKey: ["person-memories"] });
  };
  const statusM = useMutation({
    mutationFn: ({ id, s }: { id: string; s: MemoryStatus }) =>
      setMemoryStatus(id, s),
    onSuccess: (_d, v) => {
      refresh();
      toast.success(v.s === "visible" ? t`Đã duyệt` : t`Đã ẩn`);
      close();
    },
    onError: (e) =>
      toast.error(t`Không cập nhật được`, {
        description: (e as Error).message,
      }),
  });
  const removeM = useMutation({
    mutationFn: (m: PersonMemory) => deleteMemory(m),
    onSuccess: () => {
      refresh();
      toast.success(t`Đã xoá`);
      close();
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  const viewing =
    panel.mode === "view"
      ? (rows ?? []).find((m) => m.id === panel.id)
      : undefined;

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Đóng góp nội dung` },
        ]}
      />

      <PageHeader
        icon={<IconBook className="h-7 w-7" />}
        title={t`Đóng góp nội dung`}
        description={
          pendingCount > 0 && canModerate
            ? t`Câu chuyện, ảnh cũ, ghi âm về người thân — ${pendingCount} mục đang chờ duyệt.`
            : t`Câu chuyện, ảnh cũ, ghi âm về người thân do người trong họ và khách qua link góp.`
        }
        actionsBelow="mobile"
        // Cùng cỡ sm. Điện thoại: một hàng chia đều, BỎ icon cho gọn (3 nút có icon tràn chữ ở ~350px);
        // từ sm: có icon như quy ước nút.
        actions={
          <div
            className={`grid w-full gap-2 sm:flex sm:w-auto sm:items-center ${admin ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <Button
              variant="outline"
              size="sm"
              className="px-1 text-sm sm:px-3 sm:text-base"
              onClick={() => setPanel({ mode: "invite" })}
            >
              <IconSend className="mr-1.5 hidden h-4 w-4 shrink-0 sm:inline-block" />
              {t`Mời góp`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-1 text-sm sm:px-3 sm:text-base"
              onClick={() => setPanel({ mode: "links" })}
            >
              <IconLink className="mr-1.5 hidden h-4 w-4 shrink-0 sm:inline-block" />
              {t`Link đã gửi`}
            </Button>
            {admin && (
              <Button
                variant="outline"
                size="sm"
                className="px-1 text-sm sm:px-3 sm:text-base"
                title={t`Cách duyệt đóng góp`}
                onClick={() => setPanel({ mode: "settings" })}
              >
                <IconSettings className="mr-1.5 hidden h-4 w-4 shrink-0 sm:inline-block" />
                {t`Cách duyệt`}
              </Button>
            )}
          </div>
        }
      />

      <CollapsibleFilters
        activeCount={activeFilters}
        onReset={() =>
          paging.patchAndResetPage({ tt: null, loai: null, nguon: null })
        }
        title={t`Lọc đóng góp`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm đóng góp`}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t`Tìm đóng góp…`}
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label={t`Lọc theo trạng thái`}
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="all">{t`Mọi trạng thái`}</option>
            <option value="pending">{t`Chờ duyệt`}</option>
            <option value="visible">{t`Đã duyệt`}</option>
            <option value="hidden">{t`Đã ẩn`}</option>
          </Select>
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
            aria-label={t`Lọc theo loại`}
            icon={<IconBook />}
            className="h-11 w-full text-base"
          >
            <option value="all">{t`Mọi loại`}</option>
            <option value="story">{t`Câu chuyện`}</option>
            <option value="photo">{t`Ảnh`}</option>
            <option value="audio">{t`Ghi âm`}</option>
            <option value="answer">{t`Trả lời câu hỏi`}</option>
            <option value="identify">{t`Ảnh nhờ nhận diện`}</option>
          </Select>
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value as SourceFilter)}
            aria-label={t`Lọc theo người đóng góp`}
            icon={<IconUser />}
            className="h-11 w-full text-base"
          >
            <option value="all">{t`Mọi người đóng góp`}</option>
            <option value="member">{t`Thành viên`}</option>
            <option value="guest">{t`Khách qua link`}</option>
          </Select>
        </div>
      </CollapsibleFilters>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={
            search.trim() || activeFilters ? (
              <IconSearch className="h-10 w-10" />
            ) : (
              <IconBook className="h-10 w-10" />
            )
          }
          title={
            search.trim() || activeFilters
              ? t`Không có đóng góp nào khớp`
              : t`Chưa có đóng góp nào`
          }
          description={
            search.trim() || activeFilters
              ? t`Thử bỏ bớt từ khoá hoặc đặt lại bộ lọc.`
              : t`Bấm nút + để đóng góp về một người, hoặc "Mời góp" để gửi link cho người thân chưa có tài khoản.`
          }
        />
      )}

      <QuestionsSection onResend={(q) => setPanel({ mode: "question", existing: q })} />

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((m) => (
            <MemoryRow
              key={m.id}
              m={m}
              onOpen={() => setPanel({ mode: "view", id: m.id })}
            />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit={t`đóng góp`}
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <FabGroup
        label={t`Thêm`}
        actions={[
          {
            label: t`Đóng góp về một người`,
            icon: <IconPlus />,
            onClick: () => setPanel({ mode: "new" }),
          },
          {
            label: t`Hỏi ông bà`,
            icon: <IconHelp />,
            onClick: () => setPanel({ mode: "question", existing: null }),
          },
        ]}
      />

      <QuestionPanel
        open={panel.mode === "question"}
        onClose={close}
        clanId={clan.id}
        existing={panel.mode === "question" ? panel.existing : null}
      />

      {/* Xem một ký ức — thanh nút đáy: tác giả xoá; editor+ xoá / ẩn / duyệt. */}
      <SidePanel
        open={panel.mode === "view" && !!viewing}
        onClose={close}
        // Cùng khuôn ngăn kéo xem ở Danh bạ: cỡ lg, tiêu đề chung + tên ở dòng phụ.
        size="lg"
        title={t`Thông tin đóng góp`}
        subtitle={viewing?.person_name ?? t`Chuyện chung của họ`}
        guard={false}
      >
        {viewing && (
          // MỘT phần tử gốc: thân SidePanel ép mọi con trực tiếp thành cột flex — thanh nút phải nằm
          // bên trong gốc (như các ngăn kéo xem khác) mới giữ hàng ngang và dính đáy (mt-auto).
          <div>
            <div className="space-y-4">
              <MemoryCard memory={viewing} />
              {viewing.identify && viewing.media_url && !viewing.is_external && (
                <MemoryFaces memory={viewing} canModerate={canModerate} />
              )}
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{t`Trạng thái`}</dt>
                  <dd>{STATUS_STYLE[viewing.status].label}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t`Hiện ở trang chia sẻ`}</dt>
                  <dd>
                    {viewing.visibility === "share"
                      ? t`Có (nếu người được nhắc đã mất)`
                      : t`Không, chỉ người trong họ`}
                  </dd>
                </div>
                {viewing.person_id && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t`Người được nhắc`}</dt>
                    <dd>
                      <Link
                        to={`/clans/${clan.id}/people/${viewing.person_id}`}
                        className="text-primary hover:underline"
                      >
                        {viewing.person_name}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            {/* Thanh nút chuẩn của ngăn kéo XEM (dính đáy, thẳng lề như các ngăn kéo khác):
                phá huỷ → phụ → chính. */}
            {(canModerate || viewing.author_user_id === userId) && (
              <DrawerViewActions>
                <Button
                  variant="destructive-outline"
                  disabled={removeM.isPending}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: t`Xoá đóng góp này?`,
                        confirmLabel: t`Xoá`,
                        destructive: true,
                      })
                    ) {
                      removeM.mutate(viewing);
                    }
                  }}
                >
                  <IconTrash className="mr-1.5 h-4 w-4" />
                  {t`Xoá`}
                </Button>
                {canModerate && viewing.status === "visible" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      statusM.mutate({ id: viewing.id, s: "hidden" })
                    }
                  >
                    <IconX className="mr-1.5 h-4 w-4" />
                    {t`Ẩn`}
                  </Button>
                )}
                {canModerate && viewing.status !== "visible" && (
                  <Button
                    onClick={() =>
                      statusM.mutate({ id: viewing.id, s: "visible" })
                    }
                  >
                    <IconCheck className="mr-1.5 h-4 w-4" />
                    {viewing.status === "pending" ? t`Duyệt` : t`Hiện lại`}
                  </Button>
                )}
              </DrawerViewActions>
            )}
          </div>
        )}
      </SidePanel>

      <NewMemoryPanel
        open={panel.mode === "new"}
        onClose={close}
        onDone={refresh}
      />

      <ContributeLinkPanel
        open={panel.mode === "invite"}
        onClose={close}
        clanId={clan.id}
        clanName={clan.name}
      />

      <LinksPanel
        open={panel.mode === "links"}
        onClose={close}
        onCreate={() => setPanel({ mode: "invite" })}
      />

      {admin && (
        <ModerationPanel open={panel.mode === "settings"} onClose={close} />
      )}
    </div>
  );
}

function MemoryRow({ m, onOpen }: { m: PersonMemory; onOpen: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const k = KIND_STYLE[m.kind] ?? KIND_STYLE.story;
  const st = STATUS_STYLE[m.status];
  const StatusIcon = st.icon;
  const KindIcon = k.icon;
  const excerpt =
    m.body?.trim() ||
    (m.kind === "photo"
      ? t`(một tấm ảnh)`
      : m.kind === "audio"
        ? t`(một đoạn ghi âm)`
        : "");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        {/* Không ô icon bên trái (cho gọn) — chỉ ảnh nhỏ khi đóng góp là ảnh. */}
        {m.kind === "photo" && m.media_url && !imgFailed && (
          <img
            src={m.media_url}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-14 w-14 shrink-0 rounded-lg border object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {m.person_name ?? t`Chuyện chung của họ`}
          </p>
          {excerpt && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {excerpt}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            {m.author_label}
            {m.author_relation ? ` · ${m.author_relation}` : ""} ·{" "}
            {new Date(m.created_at).toLocaleDateString("vi-VN")}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {m.is_guest && (
              <Chip tone="orange" icon={<IconLink />}>
                {t`Qua link`}
              </Chip>
            )}
            {m.question_id && (
              <Chip tone="indigo" icon={<IconHelp />}>
                {t`Trả lời`}
              </Chip>
            )}
            {m.identify && (
              <Chip tone="rose" icon={<IconUser />}>
                {t`Nhờ nhận diện`}
              </Chip>
            )}
            <Chip tone={k.tone} icon={<KindIcon />}>
              {k.label}
            </Chip>
            <Chip tone={st.tone} icon={<StatusIcon />}>
              {st.label}
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

/** Fab "+": chọn người (ưu tiên người đã mất) rồi kể. */
function NewMemoryPanel({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [personId, setPersonId] = useState<string>("");
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId, "persons"),
    queryFn: () => getTreeData(clan.id, "persons"),
    enabled: open && !!userId,
  });
  const persons = useMemo(
    () =>
      [...(tree?.persons ?? [])].sort(
        (a, b) =>
          Number(a.is_living) - Number(b.is_living) ||
          a.full_name.localeCompare(b.full_name, "vi"),
      ),
    [tree],
  );
  const person = persons.find((p) => p.id === personId);
  const finish = () => {
    setPersonId("");
    onClose();
  };
  return (
    <SidePanel open={open} onClose={finish} size="lg" title={t`Đóng góp về một người`}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="memory-person">{t`Đóng góp về ai?`}</Label>
          <FilterableSelect
            id="memory-person"
            icon={<IconUser />}
            value={personId}
            onChange={setPersonId}
            options={persons.map((p) => ({
              value: p.id,
              label: `${p.full_name}${p.is_living ? "" : " †"}`,
            }))}
            emptyLabel={t`Chuyện chung của họ`}
            filterLabel={t`Tìm người`}
            filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
          />
        </div>
        <MemoryForm
          key={personId || "clan"}
          mode="member"
          clanId={clan.id}
          userId={userId}
          personId={personId || null}
          personName={person?.full_name ?? null}
          facts={
            person
              ? {
                  full_name: person.full_name,
                  is_living: person.is_living,
                  birth_date: person.birth_date,
                  death_date: person.death_date,
                  death_anniv_lunar_month: person.death_anniv_lunar_month ?? null,
                  death_anniv_lunar_day: person.death_anniv_lunar_day ?? null,
                }
              : null
          }
          onCancel={finish}
          onDone={() => {
            onDone();
            finish();
          }}
        />
      </div>
    </SidePanel>
  );
}

function LinksPanel({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  const { clan } = useClanContext();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showOld, setShowOld] = useState(false);
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["contribute-links", clan.id],
    queryFn: () => listContributeLinks(clan.id),
    enabled: open,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeContributeLink(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["contribute-links", clan.id] });
      void qc.invalidateQueries({ queryKey: ["clan-memories", clan.id] });
      toast.success(t`Đã thu hồi link — đóng góp chưa duyệt gửi qua link này đã được ẩn`);
    },
    onError: (e) => toast.error(t`Không thu hồi được`, { description: (e as Error).message }),
  });

  const now = new Date();
  const isOff = (l: ContributeLink) => l.is_revoked || new Date(l.expires_at) < now;
  const active = links.filter((l) => !isOff(l));
  const old = links.filter(isOff);
  const day = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

  const row = (l: ContributeLink) => {
    const off = isOff(l);
    return (
      <li key={l.id} className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${off ? "text-muted-foreground" : ""}`}>
            {l.recipient_label || t`Link chung`}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[
              l.person_name ? t`Về ${l.person_name}` : null,
              t`tạo ${day(l.created_at)}`,
              l.is_revoked ? null : t`hết hạn ${day(l.expires_at)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip
              tone={l.is_revoked ? "danger" : off ? "neutral" : "success"}
              icon={l.is_revoked ? <IconX /> : off ? <IconClock /> : <IconCheck />}
            >
              {l.is_revoked ? t`Đã thu hồi` : off ? t`Hết hạn` : t`Đang mở`}
            </Chip>
            <Chip tone="info" icon={<IconBook />}>
              {t`${l.use_count} lượt góp`}
            </Chip>
          </div>
        </div>
        {!off && (
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label={t`Sao chép link`}
              title={t`Sao chép link`}
              onClick={() => {
                void navigator.clipboard
                  .writeText(contributeLinkUrl(l.token, l.root_person_id))
                  .then(() => toast.success(t`Đã sao chép link`));
              }}
            >
              <IconCopy className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-destructive hover:text-destructive"
              aria-label={t`Thu hồi link`}
              title={t`Thu hồi link`}
              disabled={revoke.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    title: t`Thu hồi link này?`,
                    description: t`Người nhận không mở được nữa; đóng góp chưa duyệt gửi qua link sẽ bị ẩn.`,
                    confirmLabel: t`Thu hồi`,
                    destructive: true,
                  })
                ) {
                  revoke.mutate(l.id);
                }
              }}
            >
              <IconX className="h-5 w-5" />
            </Button>
          </div>
        )}
      </li>
    );
  };

  return (
    <SidePanel open={open} onClose={onClose} size="lg" title={t`Link mời góp`} subtitle={clan.name} guard={false}>
      {/* MỘT phần tử gốc (thân SidePanel giãn mọi con trực tiếp) — danh sách không bị kéo cao. */}
      <div>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t`Đang tải…`}</p>
          ) : links.length === 0 ? (
            <EmptyState
              icon={<IconLink className="h-10 w-10" />}
              title={t`Chưa có link mời góp`}
              description={t`Tạo link gửi qua Zalo / Facebook — người nhận đóng góp được ngay, không cần tài khoản.`}
            />
          ) : (
            <>
              {active.length > 0 ? (
                <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">{active.map(row)}</ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t`Không còn link nào đang mở.`}</p>
              )}
              {old.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowOld((v) => !v)}
                    aria-expanded={showOld}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {showOld ? t`Ẩn link đã hết hạn / thu hồi` : t`Xem ${old.length} link đã hết hạn / thu hồi`}
                  </button>
                  {showOld && (
                    <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">{old.map(row)}</ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DrawerViewActions>
          <Button onClick={onCreate}>
            <IconPlus className="mr-1.5 h-4 w-4" />
            {t`Tạo link mời`}
          </Button>
        </DrawerViewActions>
      </div>
    </SidePanel>
  );
}

function ModerationPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { clan } = useClanContext();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: current } = useQuery({
    queryKey: ["memory-moderation", clan.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clans")
        .select("memory_moderation")
        .eq("id", clan.id)
        .maybeSingle();
      return ((data?.memory_moderation as MemoryModeration | undefined) ??
        "post") as MemoryModeration;
    },
    enabled: open,
  });
  const [choice, setChoice] = useState<MemoryModeration | null>(null);
  const value = choice ?? current ?? "post";
  const save = useMutation({
    mutationFn: () => setMemoryModeration(clan.id, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["memory-moderation", clan.id] });
      toast.success(t`Đã lưu cách duyệt đóng góp`);
      setChoice(null);
      onClose();
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });
  const options: { v: MemoryModeration; title: string; hint: string }[] = [
    {
      v: "post",
      title: t`Đăng ngay, ẩn sau nếu cần`,
      hint: t`Đóng góp của thành viên hiện ngay; người quản lý ẩn khi thấy không phù hợp.`,
    },
    {
      v: "pre",
      title: t`Chờ duyệt trước`,
      hint: t`Mọi đóng góp của thành viên (trừ biên tập viên) chờ người quản lý duyệt mới hiện.`,
    },
  ];
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={t`Cách duyệt đóng góp`}
      guard={false}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div
          role="radiogroup"
          aria-label={t`Cách duyệt đóng góp`}
          className="space-y-2"
        >
          {options.map((o) => (
            <label
              key={o.v}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${value === o.v ? "border-primary bg-primary/5" : ""}`}
            >
              <input
                type="radio"
                name="memory-moderation"
                className="mt-1 h-4 w-4 accent-primary"
                checked={value === o.v}
                onChange={() => setChoice(o.v)}
              />
              <span>
                <span className="block font-medium">{o.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {o.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t`Khách gửi qua link luôn chờ duyệt cho tới khi đã được duyệt 3 lần.`}
        </p>
        <FormActions>
          <Button type="button" variant="outline" onClick={onClose}>
            {t`Huỷ`}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            <IconCheck className="mr-1.5 h-4 w-4" />
            {t`Lưu`}
          </Button>
        </FormActions>
      </form>
    </SidePanel>
  );
}

/**
 * Câu hỏi đang hỏi (P1): câu hỏi · hỏi ai / về ai · số câu trả lời. Nút icon: gửi link (tạo link mới
 * cho câu hỏi), đóng câu hỏi (người hỏi / editor+). Câu hỏi đã đóng gom thu gọn.
 */
function QuestionsSection({ onResend }: { onResend: (q: FamilyQuestion) => void }) {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canModerate = canEditClan(clan);
  const qc = useQueryClient();
  const toast = useToast();
  const [showClosed, setShowClosed] = useState(false);
  const { data: questions = [] } = useQuery({
    queryKey: ["family-questions", clan.id],
    queryFn: () => listQuestions(clan.id),
    enabled: !!userId,
  });
  const closeQ = useMutation({
    mutationFn: (id: string) => setQuestionStatus(id, "closed"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["family-questions", clan.id] });
      toast.success(t`Đã đóng câu hỏi`);
    },
    onError: (e) => toast.error(t`Không đóng được`, { description: (e as Error).message }),
  });
  if (questions.length === 0) return null;
  const openQs = questions.filter((q) => q.status !== "closed");
  const closedQs = questions.filter((q) => q.status === "closed");

  const row = (q: FamilyQuestion) => (
    <li key={q.id} className="flex items-start gap-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">“{q.question}”</p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            q.ask_person_name ? t`Hỏi ${q.ask_person_name}` : null,
            q.about_person_name ? t`về ${q.about_person_name}` : null,
            q.asked_by_name ? t`do ${q.asked_by_name} đặt` : null,
            new Date(q.created_at).toLocaleDateString("vi-VN"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Chip
            tone={q.status === "closed" ? "neutral" : q.answers > 0 ? "success" : "warning"}
            icon={q.status === "closed" ? <IconX /> : q.answers > 0 ? <IconCheck /> : <IconClock />}
          >
            {q.status === "closed" ? t`Đã đóng` : q.answers > 0 ? t`${q.answers} câu trả lời` : t`Chờ trả lời`}
          </Chip>
        </div>
      </div>
      {q.status !== "closed" && (
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label={t`Gửi link trả lời`}
            title={t`Gửi link trả lời`}
            onClick={() => onResend(q)}
          >
            <IconSend className="h-5 w-5" />
          </Button>
          {(canModerate || q.asked_by === userId) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label={t`Đóng câu hỏi`}
              title={t`Đóng câu hỏi`}
              onClick={() => closeQ.mutate(q.id)}
            >
              <IconX className="h-5 w-5" />
            </Button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <section aria-label={t`Câu hỏi đang hỏi`} className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <IconHelp className="h-4 w-4 text-primary" />
        {t`Hỏi ông bà`}
      </h2>
      {openQs.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">{openQs.map(row)}</ul>
      )}
      {closedQs.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            aria-expanded={showClosed}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showClosed ? t`Ẩn câu hỏi đã đóng` : t`Xem ${closedQs.length} câu hỏi đã đóng`}
          </button>
          {showClosed && (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">{closedQs.map(row)}</ul>
          )}
        </>
      )}
    </section>
  );
}
