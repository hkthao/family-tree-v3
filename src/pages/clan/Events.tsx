import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  IconBell,
  IconCalendar,
  IconGrid,
  IconList,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconX,
} from "@/components/icons";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ShareCardDialog } from "@/components/ShareCardDialog";
import type { CardGenre } from "@/lib/cards/types";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { IconBellOff, IconDownload } from "@/components/icons";
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
import { EventDetailDialog } from "@/components/EventDetailDialog";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

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
  const qc = useQueryClient();
  const toast = useToast();

  const [daysAhead, setDaysAhead] = useState<number>(90);
  const [view, setView] = useState<"list" | "grid" | "calendar">("list");
  // Phân trang danh sách sự kiện sắp tới (họ lớn có thể hàng trăm
  // sinh nhật / ngày giỗ trong khoảng đã chọn).
  const EVENTS_PAGE_SIZE = 15;
  const [page, setPage] = useState(1);

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
    queryFn: () =>
      listAnniversaryCandidates(clan.id, undefined, treeSource),
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

  // Về trang 1 khi đổi khoảng thời gian / danh sách thay đổi.
  useEffect(() => {
    setPage(1);
  }, [daysAhead, upcoming.length]);

  const totalEventPages = Math.max(
    1,
    Math.ceil(upcoming.length / EVENTS_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalEventPages);
  const pagedUpcoming = upcoming.slice(
    (safePage - 1) * EVENTS_PAGE_SIZE,
    safePage * EVENTS_PAGE_SIZE,
  );

  function handleExportIcs() {
    if (!tree || !events || !anniversaries) return;
    // Stitch the giỗ-lunar fields (from listAnniversaryCandidates)
    // onto the tree's persons by id — tree query doesn't include
    // death_anniv_lunar_* in its lighter projection.
    const annivById = new Map(
      anniversaries.map((a) => [a.id, a]),
    );
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
    toast.success("Đã tải file lịch", { description: filename });
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Sự kiện" },
        ]}
      />
      {/* Header: actions xuống hàng riêng do số lượng action (segmented
          control + xuất .ics + refresh) + description dài → inline sẽ
          ép description wrap nhiều dòng. */}
      <PageHeader
        icon={<IconCalendar className="h-7 w-7" />}
        title="Sự kiện"
        description="Giỗ, sinh nhật, sự kiện chung của dòng họ. Xuất lịch .ics để đẩy vào Google / Apple Calendar."
        actionsBelow
        actions={
          <>
            <SegmentedControl ariaLabel="Chế độ hiển thị">
              <SegmentedButton
                active={view === "list"}
                onClick={() => setView("list")}
                ariaLabel="Danh sách"
                className="inline-flex items-center gap-1.5 px-3"
              >
                <IconList className="h-4 w-4" />
                <span className="hidden sm:inline">Danh sách</span>
              </SegmentedButton>
              <SegmentedButton
                active={view === "grid"}
                onClick={() => setView("grid")}
                ariaLabel="Lưới"
                className="inline-flex items-center gap-1.5 px-3"
              >
                <IconGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Lưới</span>
              </SegmentedButton>
              <SegmentedButton
                active={view === "calendar"}
                onClick={() => setView("calendar")}
                ariaLabel="Lịch"
                className="inline-flex items-center gap-1.5 px-3"
              >
                <IconCalendar className="h-4 w-4" />
                <span className="hidden sm:inline">Lịch</span>
              </SegmentedButton>
            </SegmentedControl>
            {effectiveRole(clan) !== null && (
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={handleExportIcs}
                disabled={!tree || !events || !anniversaries}
                title="Tải file .ics — import vào Google / Apple Calendar"
              >
                <IconDownload className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Xuất lịch</span>
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

      {/* Look-ahead pills — only meaningful in list view. Full-width
          on mobile (each pill flex-1) so taps are large; auto-width
          on sm+ where the row has plenty of room. */}
      {view !== "calendar" && (
        <SegmentedControl
          ariaLabel="Khoảng thời gian"
          className="flex sm:inline-flex"
        >
          {LOOKAHEAD_OPTIONS.map((opt) => (
            <SegmentedButton
              key={opt.value}
              active={daysAhead === opt.value}
              onClick={() => setDaysAhead(opt.value)}
              className="flex-1 sm:flex-none px-3"
            >
              {opt.label}
            </SegmentedButton>
          ))}
        </SegmentedControl>
      )}

      {/* Upcoming list / calendar */}
      {!tree || !events || !anniversaries ? (
        <p className="text-muted-foreground">Đang tải…</p>
      ) : view === "calendar" ? (
        <EventsCalendar events={upcoming} clanId={clan.id} />
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon={<IconBellOff className="h-10 w-10" />}
          title="Không có sự kiện sắp tới"
          description={`Trong ${daysAhead} ngày tới chưa có sinh nhật, ngày giỗ hay sự kiện tuỳ chỉnh nào. Thêm ngày sinh / ngày giỗ cho thành viên hoặc tạo sự kiện tuỳ chỉnh ở dưới.`}
        />
      ) : (
        <>
          <ul
            className={
              view === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
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
                />
              </li>
            ))}
          </ul>
          {upcoming.length > EVENTS_PAGE_SIZE && (
            <Pagination
              page={safePage}
              totalPages={totalEventPages}
              total={upcoming.length}
              pageSize={EVENTS_PAGE_SIZE}
              unit="sự kiện"
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Custom events management */}
      <Card>
        <CardHeader>
          <CardTitle>Sự kiện tuỳ chỉnh</CardTitle>
          <CardDescription>
            Họp họ, ngày kỷ niệm dòng họ — thêm theo dương lịch hoặc âm lịch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <AddEventForm
              clanId={clan.id}
              onCreated={() => invalidateClanData(qc, clan.id)}
            />
          )}
          {events && events.length > 0 ? (
            <ul className="divide-y border rounded-md">
              {events.map((e) => (
                <CustomEventItem
                  key={e.id}
                  event={e}
                  clanName={clan.name}
                  canDelete={canEdit}
                  onOpen={() => setDetailEventId(e.id)}
                  onDeleted={() => invalidateClanData(qc, clan.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa có sự kiện tuỳ chỉnh nào.
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
              Theo dõi sự kiện
            </CardTitle>
            <CardDescription>
              Nhận thông báo qua email khi có sinh nhật, ngày giỗ hoặc sự
              kiện sắp đến. Chỉ áp dụng cho riêng bạn.
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
    </div>
  );
}

// ─── Items ──────────────────────────────────────────────────────────

function CustomEventItem({
  event,
  clanName,
  canDelete,
  onOpen,
  onDeleted,
}: {
  event: EventRow;
  clanName: string;
  canDelete: boolean;
  onOpen: () => void;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [cardOpen, setCardOpen] = useState(false);
  const delM = useMutation({
    mutationFn: () => deleteEvent(event.id),
    onSuccess: () => {
      onDeleted();
      toast.success(`Đã xoá sự kiện "${event.title}"`);
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const when = event.date_solar
    ? `${event.date_solar} (dương lịch)`
    : event.lunar_month
      ? `Ngày ${event.lunar_day} tháng ${event.lunar_month}${event.lunar_is_leap ? " nhuận" : ""} (ÂL)`
      : "—";
  // Ngày in lên thiệp: gọn + có "hằng năm" nếu lặp.
  const cardDate = `${when}${event.is_yearly ? " · hằng năm" : ""}`;
  // Thiệp sự kiện: thể loại "Sự kiện / Kính mời" (có cả mẫu Kính mời lẫn
  // mẫu Giỗ/tảo mộ trang nghiêm để người dùng chọn).
  const cardGenre: CardGenre = "event";

  return (
    <li className="px-3 py-3 flex items-center justify-between gap-3">
      <button type="button" onClick={onOpen} className="min-w-0 text-left flex-1 hover:opacity-80">
        <p className="font-semibold line-clamp-2 text-base">{event.title}</p>
        <p className="text-sm text-muted-foreground">
          {when} {event.is_yearly ? "• lặp hằng năm" : ""}
        </p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => setCardOpen(true)}>
          <IconSparkles className="h-4 w-4 mr-1" />
          Thiệp
        </Button>
        {canDelete && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={delM.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Xoá sự kiện "${event.title}"?`,
                confirmLabel: "Xoá",
                destructive: true,
              });
              if (ok) delM.mutate();
            }}
          >
            <IconTrash className="h-4 w-4 mr-1" />
            Xoá
          </Button>
        )}
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
      />
    </li>
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
      toast.success("Đã thêm sự kiện", { description: title.trim() });
      setTitle("");
      setDateSolar("");
      setLunarMonth("");
      setLunarDay("");
      setOpen(false);
      onCreated();
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  const canSubmit =
    title.trim() &&
    (calendar === "solar"
      ? dateSolar
      : Number(lunarMonth) >= 1 &&
        Number(lunarMonth) <= 12 &&
        Number(lunarDay) >= 1 &&
        Number(lunarDay) <= 30);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconPlus className="h-4 w-4 mr-1.5" />
        Thêm sự kiện
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) m.mutate();
      }}
      className="space-y-3 border rounded-md p-3"
    >
      <div className="space-y-2">
        <Label htmlFor="evt-title">Tên sự kiện</Label>
        <Input
          id="evt-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Họp họ, tảo mộ, chạp họ, kỷ niệm…"
          maxLength={150}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="evt-type">Loại</Label>
        <select
          id="evt-type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="custom">Tuỳ chỉnh</option>
          <option value="reunion">Họp họ</option>
          <option value="memorial">Giỗ chung</option>
          <option value="tomb_visit">Tảo mộ / Chạp họ</option>
        </select>
      </div>

      {eventType === "tomb_visit" && (
        <div className="space-y-2">
          <Label htmlFor="evt-grave">Gắn nơi an nghỉ (tuỳ chọn)</Label>
          <select
            id="evt-grave"
            value={restingPlaceId}
            onChange={(e) => setRestingPlaceId(e.target.value)}
            className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Không gắn —</option>
            {(places ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.location_name || RESTING_PLACE_KIND_LABEL[p.kind]}
              </option>
            ))}
          </select>
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
          Dương lịch
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            checked={calendar === "lunar"}
            onChange={() => setCalendar("lunar")}
            className="accent-primary"
          />
          Âm lịch
        </label>
      </fieldset>

      {calendar === "solar" ? (
        <div className="space-y-2">
          <Label htmlFor="evt-solar">Ngày dương lịch</Label>
          <Input
            id="evt-solar"
            type="date"
            value={dateSolar}
            onChange={(e) => setDateSolar(e.target.value)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="space-y-2">
            <Label htmlFor="evt-lunar-day">Ngày âm</Label>
            <Input
              id="evt-lunar-day"
              inputMode="numeric"
              value={lunarDay}
              maxLength={2}
              onChange={(e) => setLunarDay(e.target.value)}
              placeholder="1–30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evt-lunar-month">Tháng âm</Label>
            <Input
              id="evt-lunar-month"
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
        <span>Lặp lại hằng năm</span>
      </label>

      {m.error && (
        <Alert variant="destructive">
          <AlertDescription>{(m.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit || m.isPending}>
          <IconPlus className="h-4 w-4 mr-1.5" />
          {m.isPending ? "Đang thêm…" : "Thêm"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
        >
          <IconX className="h-4 w-4 mr-1.5" />
          Hủy
        </Button>
      </div>
    </form>
  );
}

