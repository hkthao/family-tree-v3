import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  IconBell,
  IconCalendar,
  IconGrave,
  IconGrid,
  IconList,
  IconMoon,
  IconPlus,
  IconSparkles,
  IconTag,
  IconTrash,
  IconX,
} from "@/components/icons";
import { FormActions } from "@/components/ui/form-actions";
import { SidePanel } from "@/components/SidePanel";
import { Fab } from "@/components/Fab";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ShareCardDialog } from "@/components/ShareCardDialog";
import { eventWhenText } from "@/lib/eventWhen";
import type { CardGenre } from "@/lib/cards/types";
import { PageHeader } from "@/components/PageHeader";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { RecordDates } from "@/components/RecordDates";
import { IconBellOff, IconDownload } from "@/components/icons";
import { CalendarFeedPanel } from "@/components/CalendarFeedPanel";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { EventsCalendar } from "@/components/EventsCalendar";
import { RefreshButton } from "@/components/RefreshButton";
import { SubscriptionSettings } from "@/components/SubscriptionSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  canEditClan,
  effectiveRole,
  useClanContext,
} from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  createEvent,
  deleteEvent,
  listAnniversaryCandidates,
  listEvents,
  type EventRow,
  type EventType,
} from "@/lib/queries/events";
import {
  listRestingPlaces,
  RESTING_PLACE_KIND_LABEL,
} from "@/lib/queries/restingPlaces";
import { downloadClanIcs, type IcsPerson } from "@/lib/icalExport";
import { queryKeys } from "@/lib/queries/keys";
import { track } from "@/lib/analytics";
import { getTreeData } from "@/lib/queries/tree";
import { UpcomingEventRow } from "@/components/UpcomingEventRow";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
  useSearchBox,
} from "@/hooks/useClientPaging";
import { useUrlState } from "@/hooks/useUrlState";
import { unaccent } from "@/lib/unaccent";
import { EventDetailDialog } from "@/components/EventDetailDialog";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
const LOOKAHEAD_OPTIONS = [
  { label: "30 ngày", value: 30 },
  { label: "90 ngày", value: 90 },
  { label: "Cả năm", value: 365 },
];

export default function Events() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [cardEvt, setCardEvt] = useState<UpcomingEvent | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  // Khoảng ngày, kiểu xem, từ khoá và số trang nằm trên URL nên bấm Back vẫn giữ nguyên.
  const [daysRaw] = useUrlState("ngay", "90");
  const daysAhead = Number(daysRaw) > 0 ? Number(daysRaw) : 90;
  const [viewRaw, setView] = useUrlState("kieu", "list");
  const view: "list" | "grid" | "calendar" =
    viewRaw === "grid" || viewRaw === "calendar" ? viewRaw : "list";
  const [feedOpen, setFeedOpen] = useState(false);
  const { q: query, text: queryText, setText: setQueryText } = useSearchBox();

  // Non-members of a public clan need the masked view; raw `persons`
  // RLS would return zero rows. Same pattern as /tree and Dashboard.
  const treeSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId, treeSource),
    queryFn: () => getTreeData(clan.id, treeSource),
    enabled: !!userId,
  });
  const { data: events } = useQuery({
    queryKey: queryKeys.events(clan.id, userId),
    queryFn: () => listEvents(clan.id),
    enabled: !!userId,
  });
  const { data: anniversaries } = useQuery({
    queryKey: [
      ...queryKeys.anniversaries(clan.id, userId),
      treeSource,
    ] as const,
    queryFn: () => listAnniversaryCandidates(clan.id, undefined, treeSource),
    enabled: !!userId,
  });

  // Calendar view needs a wider window so users can flip months. List
  // view honours the chosen "Trong:" pill instead.
  const effectiveDays = view === "calendar" ? 365 : daysAhead;

  const upcoming: UpcomingEvent[] = useMemo(() => {
    const today = new Date();
    const fromPersons = tree
      ? computeUpcomingEvents({
          today,
          daysAhead: effectiveDays,
          persons: tree.persons,
          events: events ?? [],
        })
      : [];
    const fromAnniv = anniversaries
      ? computeUpcomingAnniversaries({
          today,
          daysAhead: effectiveDays,
          anniversaries,
        })
      : [];
    return [...fromPersons, ...fromAnniv].sort(
      (a, b) => a.daysUntil - b.daysUntil,
    );
  }, [tree, events, anniversaries, effectiveDays]);

  // Tìm theo tên sự kiện / dòng phụ, không phân biệt dấu.
  const filtered = useMemo(() => {
    const q = unaccent(query.trim()).toLowerCase();
    if (!q) return upcoming;
    return upcoming.filter((e) =>
      unaccent(`${e.title} ${e.subtitle ?? ""}`)
        .toLowerCase()
        .includes(q),
    );
  }, [upcoming, query]);

  // Danh sách thành viên để chọn ảnh nền thiệp (id, tên, ảnh).
  const cardMembers = useMemo(
    () =>
      (tree?.persons ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        photo_path: p.photo_path,
      })),
    [tree],
  );

  // Phân trang danh sách sự kiện sắp tới (họ lớn có thể hàng trăm sinh nhật / ngày giỗ). Số trang
  // nằm trên URL; đổi khoảng ngày thì về trang đầu trong cùng một lần ghi URL.
  const paging = useClientPaging(filtered, 20);
  const setDaysAhead = (v: number) =>
    paging.patchAndResetPage({ ngay: v === 90 ? null : String(v) });
  const pagedUpcoming = paging.paged;

  function handleExportIcs() {
    if (!tree || !events || !anniversaries) return;
    // Stitch the giỗ-lunar fields (from listAnniversaryCandidates)
    // onto the tree's persons by id — tree query doesn't include
    // death_anniv_lunar_* in its lighter projection.
    const annivById = new Map(anniversaries.map((a) => [a.id, a]));
    const persons: IcsPerson[] = tree.persons.map((p) => {
      const a = annivById.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        generation: p.generation,
        is_living: p.is_living,
        birth_date: p.birth_date,
        death_anniv_lunar_month: a?.death_anniv_lunar_month ?? null,
        death_anniv_lunar_day: a?.death_anniv_lunar_day ?? null,
        death_anniv_lunar_is_leap: a?.death_anniv_lunar_is_leap ?? false,
      };
    });
    const { filename } = downloadClanIcs({
      clanName: clan.name,
      clanId: clan.id,
      appBaseUrl: window.location.origin,
      generationOffset: clan.generation_offset,
      persons,
      customEvents: events.map((e) => ({
        id: e.id,
        title: e.title,
        date_solar: e.date_solar,
        lunar_month: e.lunar_month,
        lunar_day: e.lunar_day,
        lunar_is_leap: e.lunar_is_leap,
        is_yearly: e.is_yearly,
        related_person_id: e.related_person_id,
      })),
    });
    track("export", { kind: "ics" });
    toast.success(t`Đã tải file lịch`, { description: filename });
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Sự kiện` },
        ]}
      />
      {/* Header: actions xuống hàng riêng do số lượng action (segmented
          control + xuất .ics + refresh) + description dài → inline sẽ
          ép description wrap nhiều dòng. */}
      <PageHeader
        icon={<IconCalendar className="h-7 w-7" />}
        title={t`Sự kiện`}
        description={t`Giỗ, sinh nhật, sự kiện chung của dòng họ. Xuất lịch .ics để đẩy vào Google / Apple Calendar.`}
        actionsBelow
        actions={
          <>
            <SegmentedControl ariaLabel={t`Chế độ hiển thị`}>
              <SegmentedButton
                active={view === "list"}
                onClick={() => setView("list")}
                ariaLabel={t`Danh sách`}
                className="inline-flex items-center gap-1.5 px-3"
              >
                <IconList className="h-4 w-4" />
                <span className="hidden sm:inline">{t`Danh sách`}</span>
              </SegmentedButton>
              <SegmentedButton
                active={view === "grid"}
                onClick={() => setView("grid")}
                ariaLabel={t`Lưới`}
                className="inline-flex items-center gap-1.5 px-3"
              >
                <IconGrid className="h-4 w-4" />
                <span className="hidden sm:inline">{t`Lưới`}</span>
              </SegmentedButton>
              <SegmentedButton
                active={view === "calendar"}
                onClick={() => setView("calendar")}
                ariaLabel={t`Lịch`}
                className="inline-flex items-center gap-1.5 px-3"
              >
                <IconCalendar className="h-4 w-4" />
                <span className="hidden sm:inline">{t`Lịch`}</span>
              </SegmentedButton>
            </SegmentedControl>
            {effectiveRole(clan) !== null && (
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setFeedOpen(true)}
                title={t`Đăng ký lịch — Google / Apple Calendar tự cập nhật`}
              >
                <IconCalendar className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t`Đăng ký lịch`}</span>
              </Button>
            )}
            {effectiveRole(clan) !== null && (
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={handleExportIcs}
                disabled={!tree || !events || !anniversaries}
                title={t`Tải file .ics — import vào Google / Apple Calendar`}
              >
                <IconDownload className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t`Xuất lịch`}</span>
              </Button>
            )}
            <RefreshButton
              clanId={clan.id}
              cachedVersion={clan.data_version}
              compact
            />
          </>
        }
      />

      {/* Tìm kiếm + khoảng thời gian (trong ngăn kéo của phễu) — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={view !== "calendar" && daysAhead !== 90 ? 1 : 0}
        onReset={() => setDaysAhead(90)}
        title={t`Lọc sự kiện`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm sự kiện`}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={t`Tìm theo tên người, ngày giỗ, sự kiện…`}
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          {view === "calendar" ? (
            <p className="text-sm text-muted-foreground">
              <Trans>
                <Trans>
                  <Trans>
                    Chế độ Lịch luôn hiển thị cả năm. Chuyển sang Danh sách hoặc
                    Lưới để chọn khoảng thời gian.
                  </Trans>
                </Trans>
              </Trans>
            </p>
          ) : (
            <>
              <p className="text-base font-medium">{t`Khoảng thời gian`}</p>
              <SegmentedControl
                ariaLabel={t`Khoảng thời gian`}
                className="flex"
              >
                {LOOKAHEAD_OPTIONS.map((opt) => (
                  <SegmentedButton
                    key={opt.value}
                    active={daysAhead === opt.value}
                    onClick={() => setDaysAhead(opt.value)}
                    className="flex-1 px-3"
                  >
                    {opt.label}
                  </SegmentedButton>
                ))}
              </SegmentedControl>
            </>
          )}
        </div>
      </CollapsibleFilters>

      {/* Upcoming list / calendar */}
      {!tree || !events || !anniversaries ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      ) : view === "calendar" ? (
        <EventsCalendar
          events={filtered}
          clanId={clan.id}
          onOpenEvent={setDetailEventId}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconBellOff className="h-10 w-10" />}
          title={
            query.trim()
              ? t`Không có sự kiện nào khớp`
              : t`Không có sự kiện sắp tới`
          }
          description={
            query.trim()
              ? t`Thử bỏ bớt từ khoá hoặc mở rộng khoảng thời gian.`
              : t`Trong ${daysAhead} ngày tới chưa có sinh nhật, ngày giỗ hay sự kiện tuỳ chỉnh nào. Thêm ngày sinh / ngày giỗ cho thành viên hoặc tạo sự kiện tuỳ chỉnh ở dưới.`
          }
        />
      ) : (
        <>
          <ul
            className={
              view === "grid"
                ? "grid grid-cols-2 lg:grid-cols-3 gap-2"
                : "space-y-2"
            }
          >
            {pagedUpcoming.map((e) => (
              <li key={e.key}>
                <UpcomingEventRow
                  event={e}
                  clanId={clan.id}
                  variant={view === "grid" ? "card" : "row"}
                  onOpenEvent={setDetailEventId}
                  onCreateCard={setCardEvt}
                />
              </li>
            ))}
          </ul>
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            pageSize={paging.pageSize}
            unit={t`sự kiện`}
            onPageChange={paging.setPage}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageSizeChange={paging.setPageSize}
          />
        </>
      )}

      {/* Custom events management */}
      <Card>
        <CardHeader>
          <CardTitle>{t`Sự kiện tuỳ chỉnh`}</CardTitle>
          <CardDescription>
            {t`Họp họ, ngày kỷ niệm dòng họ — thêm theo dương lịch hoặc âm lịch.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <>
              <LunarFestivalsQuickAdd
                clanId={clan.id}
                existing={events ?? []}
                onCreated={() => invalidateClanData(qc, clan.id)}
              />
              <AddEventForm
                clanId={clan.id}
                onCreated={() => invalidateClanData(qc, clan.id)}
              />
            </>
          )}
          {events && events.length > 0 ? (
            <ul className="divide-y">
              {events.map((e) => (
                <CustomEventItem
                  key={e.id}
                  event={e}
                  clanName={clan.name}
                  canDelete={canEdit}
                  onOpen={() => setDetailEventId(e.id)}
                  onDeleted={() => invalidateClanData(qc, clan.id)}
                  members={cardMembers}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t`Chưa có sự kiện tuỳ chỉnh nào.`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Subscription / notification preferences */}
      {effectiveRole(clan) !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBell className="h-5 w-5" />
              {t`Theo dõi sự kiện`}
            </CardTitle>
            <CardDescription>
              <Trans>
                <Trans>
                  <Trans>
                    Nhận thông báo qua email khi có sinh nhật, ngày giỗ hoặc sự
                    kiện sắp đến. Chỉ áp dụng cho riêng bạn.
                  </Trans>
                </Trans>
              </Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubscriptionSettings clanId={clan.id} />
          </CardContent>
        </Card>
      )}

      <EventDetailDialog
        open={detailEventId !== null}
        onClose={() => setDetailEventId(null)}
        event={(events ?? []).find((e) => e.id === detailEventId) ?? null}
        clanId={clan.id}
        clanName={clan.name}
      />

      {cardEvt && (
        <ShareCardDialog
          key={cardEvt.key}
          open
          onClose={() => setCardEvt(null)}
          clanName={clan.name}
          shareUrl=""
          initialTitle={cardEvt.title}
          initialExcerpt={cardEvt.subtitle ?? ""}
          dateText={upcomingDateText(cardEvt)}
          defaultGenre={upcomingGenre(cardEvt.kind)}
          members={cardMembers}
        />
      )}
      {userId && (
        <CalendarFeedPanel
          clanId={clan.id}
          userId={userId}
          open={feedOpen}
          onClose={() => setFeedOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Helpers cho thiệp nhanh từ sự kiện sắp tới ──────────────────────
function upcomingGenre(kind: UpcomingEvent["kind"]): CardGenre {
  switch (kind) {
    case "anniversary":
      return "memorial";
    case "tomb_visit":
      return "grave";
    case "birthday":
      return "joy";
    default:
      return "event";
  }
}
function upcomingDateText(ev: UpcomingEvent): string {
  const d = new Date(ev.date + "T00:00:00");
  return t`Ngày ${d.getDate()} tháng ${d.getMonth() + 1}`;
}

// ─── Items ──────────────────────────────────────────────────────────

function CustomEventItem({
  event,
  clanName,
  canDelete,
  onOpen,
  onDeleted,
  members,
}: {
  event: EventRow;
  clanName: string;
  canDelete: boolean;
  onOpen: () => void;
  onDeleted: () => void;
  members?: Array<{
    id: string;
    full_name: string;
    photo_path?: string | null;
  }>;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [cardOpen, setCardOpen] = useState(false);
  const delM = useMutation({
    mutationFn: () => deleteEvent(event.id),
    onSuccess: () => {
      onDeleted();
      toast.success(t`Đã xoá sự kiện "${event.title}"`);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  const when = eventWhenText(event);
  // Ngày in lên thiệp: gọn + có "hằng năm" nếu lặp.
  const cardDate = eventWhenText(event, { withYearly: true });
  // Thiệp sự kiện: thể loại "Sự kiện / Kính mời" (có cả mẫu Kính mời lẫn
  // mẫu Giỗ/tảo mộ trang nghiêm để người dùng chọn).
  const cardGenre: CardGenre = "event";

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left w-full sm:flex-1 hover:opacity-80"
        >
          <p className="font-semibold line-clamp-2 text-base">{event.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {when}
            {event.is_yearly ? t` • lặp hằng năm` : ""}
          </p>
          <RecordDates
            createdAt={event.created_at}
            updatedAt={event.updated_at}
            className="text-xs text-muted-foreground/80 mt-0.5 truncate"
          />
        </button>
        {/* Mobile: nút thành hàng đầy đủ chiều rộng bên dưới (không bóp
            cột chữ gây rớt dòng). Desktop: nằm bên phải, co theo nội dung. */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => setCardOpen(true)}
          >
            <IconSparkles className="h-4 w-4 mr-1" />
            {t`Thiệp`}
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="destructive-outline"
              className="flex-1 sm:flex-none"
              disabled={delM.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: t`Xoá sự kiện "${event.title}"?`,
                  confirmLabel: t`Xoá`,
                  destructive: true,
                });
                if (ok) delM.mutate();
              }}
            >
              <IconTrash className="h-4 w-4 mr-1" />
              {t`Xoá`}
            </Button>
          )}
        </div>
      </div>

      <ShareCardDialog
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        clanName={clanName}
        shareUrl=""
        initialTitle={event.title}
        initialExcerpt={event.notes ?? ""}
        dateText={cardDate}
        defaultGenre={cardGenre}
        members={members}
      />
    </li>
  );
}

// ─── Thêm nhanh lễ tiết truyền thống ────────────────────────────────
const LUNAR_FESTIVALS = [
  { title: "Rằm tháng Giêng (Thượng nguyên)", lunar_month: 1, lunar_day: 15 },
  { title: "Tết Hàn thực", lunar_month: 3, lunar_day: 3 },
  { title: "Vu Lan – Rằm tháng Bảy", lunar_month: 7, lunar_day: 15 },
  { title: "Rằm tháng Mười (Hạ nguyên)", lunar_month: 10, lunar_day: 15 },
  { title: "Ông Công ông Táo", lunar_month: 12, lunar_day: 23 },
] as const;

type Festival = (typeof LUNAR_FESTIVALS)[number];

function LunarFestivalsQuickAdd({
  clanId,
  existing,
  onCreated,
}: {
  clanId: string;
  existing: EventRow[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const add = useMutation({
    mutationFn: (f: Festival) =>
      createEvent({
        clan_id: clanId,
        title: f.title,
        event_type: "custom",
        lunar_month: f.lunar_month,
        lunar_day: f.lunar_day,
        is_yearly: true,
      }),
    onSuccess: (_d, f) => {
      toast.success(t`Đã thêm lễ tiết`, { description: f.title });
      onCreated();
    },
    onError: (e) =>
      toast.error(t`Không thêm được`, { description: (e as Error).message }),
  });

  const has = (f: Festival) =>
    existing.some(
      (e) => e.lunar_month === f.lunar_month && e.lunar_day === f.lunar_day,
    );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t`Thêm nhanh lễ tiết truyền thống`}</p>
      <p className="text-xs text-muted-foreground">
        <Trans>
          <Trans>
            <Trans>
              Tạo sự kiện âm lịch lặp hằng năm — cả họ được nhắc trước. Giỗ Tổ /
              Chạp họ / Tảo mộ có ngày riêng, dùng "Thêm sự kiện" bên dưới.
            </Trans>
          </Trans>
        </Trans>
      </p>
      <div className="flex flex-wrap gap-2">
        {LUNAR_FESTIVALS.map((f) => {
          const added = has(f);
          return (
            <button
              key={f.title}
              type="button"
              disabled={added || add.isPending}
              onClick={() => add.mutate(f)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                added
                  ? "opacity-50 cursor-default"
                  : "bg-card hover:border-primary"
              }`}
              title={t`${f.lunar_day}/${f.lunar_month} âm lịch`}
            >
              {added ? "✓ " : "+ "}
              {f.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add form ───────────────────────────────────────────────────────

function AddEventForm({
  clanId,
  onCreated,
}: {
  clanId: string;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("custom");
  const [restingPlaceId, setRestingPlaceId] = useState("");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [dateSolar, setDateSolar] = useState("");
  const [lunarMonth, setLunarMonth] = useState("");
  const [lunarDay, setLunarDay] = useState("");
  const [isYearly, setIsYearly] = useState(true);
  const [open, setOpen] = useState(false);

  const { data: places } = useQuery({
    queryKey: ["resting-places", clanId, "mini"],
    queryFn: () => listRestingPlaces(clanId),
    enabled: open && eventType === "tomb_visit",
  });

  const m = useMutation({
    mutationFn: () => {
      const common = {
        clan_id: clanId,
        title: title.trim(),
        event_type: eventType,
        resting_place_id:
          eventType === "tomb_visit" && restingPlaceId ? restingPlaceId : null,
        is_yearly: isYearly,
      };
      if (calendar === "solar") {
        return createEvent({ ...common, date_solar: dateSolar });
      }
      return createEvent({
        ...common,
        lunar_month: Number(lunarMonth),
        lunar_day: Number(lunarDay),
      });
    },
    onSuccess: () => {
      toast.success(t`Đã thêm sự kiện`, { description: title.trim() });
      setTitle("");
      setDateSolar("");
      setLunarMonth("");
      setLunarDay("");
      setOpen(false);
      onCreated();
    },
    onError: (e) =>
      toast.error(t`Không thêm được`, { description: (e as Error).message }),
  });

  const canSubmit =
    title.trim() &&
    (calendar === "solar"
      ? dateSolar
      : Number(lunarMonth) >= 1 &&
        Number(lunarMonth) <= 12 &&
        Number(lunarDay) >= 1 &&
        Number(lunarDay) <= 30);

  return (
    <>
      <Fab onClick={() => setOpen(true)} label={t`Thêm sự kiện`} />
      <SidePanel
        open={open}
        title={t`Thêm sự kiện`}
        subtitle={t`Sinh nhật, giỗ, lễ tết hoặc sự kiện riêng của dòng họ.`}
        onClose={() => setOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) m.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="evt-title">{t`Tên sự kiện`}</Label>
            <Input
              id="evt-title"
              icon={<IconCalendar />}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t`Họp họ, tảo mộ, chạp họ, kỷ niệm…`}
              maxLength={150}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evt-type">{t`Loại`}</Label>
            <Select
              id="evt-type"
              icon={<IconTag />}
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
            >
              <option value="custom">{t`Tuỳ chỉnh`}</option>
              <option value="reunion">{t`Họp họ`}</option>
              <option value="memorial">{t`Giỗ chung`}</option>
              <option value="tomb_visit">{t`Tảo mộ / Chạp họ`}</option>
            </Select>
          </div>

          {eventType === "tomb_visit" && (
            <div className="space-y-2">
              <Label htmlFor="evt-grave">{t`Gắn nơi an nghỉ (tuỳ chọn)`}</Label>
              <Select
                id="evt-grave"
                icon={<IconGrave />}
                value={restingPlaceId}
                onChange={(e) => setRestingPlaceId(e.target.value)}
              >
                <option value="">{t`— Không gắn —`}</option>
                {(places ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ||
                      p.location_name ||
                      RESTING_PLACE_KIND_LABEL[p.kind]}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <fieldset className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                checked={calendar === "solar"}
                onChange={() => setCalendar("solar")}
                className="accent-primary"
              />
              {t`Dương lịch`}
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                checked={calendar === "lunar"}
                onChange={() => setCalendar("lunar")}
                className="accent-primary"
              />
              {t`Âm lịch`}
            </label>
          </fieldset>

          {calendar === "solar" ? (
            <div className="space-y-2">
              <Label htmlFor="evt-solar">{t`Ngày dương lịch`}</Label>
              <Input
                id="evt-solar"
                icon={<IconCalendar />}
                type="date"
                value={dateSolar}
                onChange={(e) => setDateSolar(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <div className="space-y-2">
                <Label htmlFor="evt-lunar-day">{t`Ngày âm`}</Label>
                <Input
                  id="evt-lunar-day"
                  icon={<IconMoon />}
                  inputMode="numeric"
                  value={lunarDay}
                  maxLength={2}
                  onChange={(e) => setLunarDay(e.target.value)}
                  placeholder="1–30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evt-lunar-month">{t`Tháng âm`}</Label>
                <Input
                  id="evt-lunar-month"
                  icon={<IconMoon />}
                  inputMode="numeric"
                  value={lunarMonth}
                  maxLength={2}
                  onChange={(e) => setLunarMonth(e.target.value)}
                  placeholder="1–12"
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isYearly}
              onChange={(e) => setIsYearly(e.target.checked)}
              className="h-5 w-5 accent-primary shrink-0"
            />
            <span>{t`Lặp lại hằng năm`}</span>
          </label>

          {m.error && (
            <Alert variant="destructive">
              <AlertDescription>{(m.error as Error).message}</AlertDescription>
            </Alert>
          )}

          <FormActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              <IconX className="h-4 w-4 mr-1.5" />
              {t`Hủy`}
            </Button>
            <Button type="submit" disabled={!canSubmit || m.isPending}>
              <IconPlus className="h-4 w-4 mr-1.5" />
              {m.isPending ? t`Đang thêm…` : t`Thêm`}
            </Button>
          </FormActions>
        </form>
      </SidePanel>
    </>
  );
}
