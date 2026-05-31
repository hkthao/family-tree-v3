import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { IconBell, IconPlus, IconTrash, IconX } from "@/components/icons";
import { RefreshButton } from "@/components/RefreshButton";
import { SubscriptionSettings } from "@/components/SubscriptionSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";
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

  const [daysAhead, setDaysAhead] = useState<number>(90);

  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId),
    queryFn: () => getTreeData(clan.id),
    enabled: !!userId,
  });
  const { data: events } = useQuery({
    queryKey: queryKeys.events(clan.id, userId),
    queryFn: () => listEvents(clan.id),
    enabled: !!userId,
  });
  const { data: anniversaries } = useQuery({
    queryKey: queryKeys.anniversaries(clan.id, userId),
    queryFn: () => listAnniversaryCandidates(clan.id),
    enabled: !!userId,
  });

  const upcoming: UpcomingEvent[] = useMemo(() => {
    const today = new Date();
    const fromPersons = tree
      ? computeUpcomingEvents({
          today,
          daysAhead,
          persons: tree.persons,
          events: events ?? [],
        })
      : [];
    const fromAnniv = anniversaries
      ? computeUpcomingAnniversaries({
          today,
          daysAhead,
          anniversaries,
        })
      : [];
    return [...fromPersons, ...fromAnniv].sort(
      (a, b) => a.daysUntil - b.daysUntil,
    );
  }, [tree, events, anniversaries, daysAhead]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Sự kiện</h2>
        <RefreshButton clanId={clan.id} cachedVersion={clan.data_version} />
      </div>

      {/* Look-ahead window */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Trong:</span>
        <div
          className="inline-flex rounded-md border bg-card overflow-hidden"
          role="group"
        >
          {LOOKAHEAD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDaysAhead(opt.value)}
              aria-pressed={daysAhead === opt.value}
              className={`px-3 h-10 text-sm border-l first:border-l-0 ${
                daysAhead === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming list */}
      {!tree || !events || !anniversaries ? (
        <p className="text-muted-foreground">Đang tải…</p>
      ) : upcoming.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Không có sự kiện sắp tới</CardTitle>
            <CardDescription>
              Không tìm thấy sinh nhật, ngày giỗ hay sự kiện tuỳ chỉnh nào
              trong {daysAhead} ngày tới.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((e) => (
            <UpcomingItem key={e.key} event={e} clanId={clan.id} />
          ))}
        </ul>
      )}

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
    </div>
  );
}

// ─── Items ──────────────────────────────────────────────────────────

function UpcomingItem({
  event,
  clanId,
}: {
  event: UpcomingEvent;
  clanId: string;
}) {
  const dt = new Date(event.date + "T00:00:00");
  const day = dt.getDate();
  const month = dt.getMonth() + 1;
  const countdown =
    event.daysUntil === 0
      ? "Hôm nay"
      : event.daysUntil === 1
        ? "Ngày mai"
        : `Còn ${event.daysUntil} ngày`;

  const inner = (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card hover:border-primary transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-12 text-center">
          <div className="text-xs text-muted-foreground">Th {month}</div>
          <div className="text-xl font-semibold leading-none">{day}</div>
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{event.title}</p>
          <p className="text-xs text-muted-foreground">
            {kindLabel(event.kind)}
            {event.subtitle ? ` • ${event.subtitle}` : ""}
          </p>
        </div>
      </div>
      <span
        className={`text-xs whitespace-nowrap ${
          event.daysUntil <= 1
            ? "text-primary font-semibold"
            : event.daysUntil <= 7
              ? "text-accent font-medium"
              : "text-muted-foreground"
        }`}
      >
        {countdown}
      </span>
    </div>
  );

  return (
    <li>
      {event.personId ? (
        <Link to={`/clans/${clanId}/people/${event.personId}`} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

function CustomEventItem({
  event,
  canDelete,
  onDeleted,
}: {
  event: EventRow;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const delM = useMutation({
    mutationFn: () => deleteEvent(event.id),
    onSuccess: () => onDeleted(),
  });

  const when = event.date_solar
    ? `${event.date_solar} (dương lịch)`
    : event.lunar_month
      ? `${event.lunar_day}/${event.lunar_month}${event.lunar_is_leap ? " nhuận" : ""} âm lịch`
      : "—";

  return (
    <li className="px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium truncate">{event.title}</p>
        <p className="text-xs text-muted-foreground">
          {when} {event.is_yearly ? "• lặp hằng năm" : ""}
        </p>
      </div>
      {canDelete && (
        <Button
          size="sm"
          variant="outline"
          className="text-destructive shrink-0"
          disabled={delM.isPending}
          onClick={() => {
            if (window.confirm(`Xoá sự kiện "${event.title}"?`)) {
              delM.mutate();
            }
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
      setTitle("");
      setDateSolar("");
      setLunarMonth("");
      setLunarDay("");
      setOpen(false);
      onCreated();
    },
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

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={isYearly}
          onChange={(e) => setIsYearly(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Lặp lại hằng năm
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

function kindLabel(k: UpcomingEvent["kind"]): string {
  switch (k) {
    case "birthday":
      return "Sinh nhật";
    case "anniversary":
      return "Ngày giỗ";
    case "custom":
      return "Sự kiện";
  }
}
