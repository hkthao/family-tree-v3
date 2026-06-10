import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  IconBell,
  IconGrid,
  IconList,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/icons";
import { BackLink } from "@/components/BackLink";
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
} from "@/lib/queries/events";
import { downloadClanIcs, type IcsPerson } from "@/lib/icalExport";
import { queryKeys } from "@/lib/queries/keys";
import { track } from "@/lib/analytics";
import { getTreeData } from "@/lib/queries/tree";
import { UpcomingEventRow } from "@/components/UpcomingEventRow";
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
  const qc = useQueryClient();
  const toast = useToast();

  const [daysAhead, setDaysAhead] = useState<number>(90);
  const [view, setView] = useState<"list" | "calendar">("list");

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
      <nav>
        <BackLink fallback={`/clans/${clan.id}`} />
      </nav>
      {/* Header: title + view toggle + refresh in one row on sm+,
          stacked on mobile. View toggle is icon-only on mobile to
          leave room for the look-ahead pills underneath. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <h2 className="text-2xl font-semibold sm:flex-1">Sự kiện</h2>
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
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
              active={view === "calendar"}
              onClick={() => setView("calendar")}
              ariaLabel="Lịch"
              className="inline-flex items-center gap-1.5 px-3"
            >
              <IconGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Lịch</span>
            </SegmentedButton>
          </SegmentedControl>
          {/* Xuất lịch (.ics) is member-only — same reasoning as the
              PDF book / share-link buttons on /tree: bulk-downloading
              the clan's full event stream is owner territory, not for
              non-member public-clan visitors. */}
          {effectiveRole(clan) !== null && (
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={handleExportIcs}
              disabled={!tree || !events || !anniversaries}
              title="Tải file .ics — import vào Google / Apple Calendar để nhận nhắc trực tiếp trên lịch điện thoại"
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
        </div>
      </div>

      {/* Look-ahead pills — only meaningful in list view. Full-width
          on mobile (each pill flex-1) so taps are large; auto-width
          on sm+ where the row has plenty of room. */}
      {view === "list" && (
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
        <ul className="space-y-2">
          {upcoming.map((e) => (
            <li key={e.key}>
              <UpcomingEventRow event={e} clanId={clan.id} />
            </li>
          ))}
        </ul>
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
                  canDelete={canEdit}
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
    </div>
  );
}

// ─── Items ──────────────────────────────────────────────────────────

function CustomEventItem({
  event,
  canDelete,
  onDeleted,
}: {
  event: EventRow;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
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
      ? `${event.lunar_day}/${event.lunar_month}${event.lunar_is_leap ? " nhuận" : ""} âm lịch`
      : "—";

  return (
    <li className="px-3 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold line-clamp-2 text-base">{event.title}</p>
        <p className="text-sm text-muted-foreground">
          {when} {event.is_yearly ? "• lặp hằng năm" : ""}
        </p>
      </div>
      {canDelete && (
        <Button
          size="sm"
          variant="outline"
          className="text-destructive shrink-0"
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
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [dateSolar, setDateSolar] = useState("");
  const [lunarMonth, setLunarMonth] = useState("");
  const [lunarDay, setLunarDay] = useState("");
  const [isYearly, setIsYearly] = useState(true);
  const [open, setOpen] = useState(false);

  const m = useMutation({
    mutationFn: () => {
      if (calendar === "solar") {
        return createEvent({
          clan_id: clanId,
          title: title.trim(),
          date_solar: dateSolar,
          is_yearly: isYearly,
        });
      }
      return createEvent({
        clan_id: clanId,
        title: title.trim(),
        lunar_month: Number(lunarMonth),
        lunar_day: Number(lunarDay),
        is_yearly: isYearly,
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
          placeholder="Họp họ, kỷ niệm…"
          maxLength={150}
        />
      </div>

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

