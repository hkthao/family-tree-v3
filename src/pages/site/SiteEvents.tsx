import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { EventsCalendar } from "@/components/EventsCalendar";
import { IconCalendar, IconList } from "@/components/icons";
import { UpcomingEventList } from "@/components/UpcomingEventList";
import { Button } from "@/components/ui/button";
import { fetchSiteEvents } from "@/lib/queries/site-parts";
import { shareUpcoming } from "@/lib/shareUpcoming";

import { SitePageHead } from "./SiteListParts";
import { useSite } from "./siteContext";

/** Sự kiện & giỗ: lịch tháng (chấm màu) hoặc danh sách — cùng bộ tính và bộ vẽ với màn Sự kiện trong app. */
export default function SiteEvents() {
  const { access, data } = useSite();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const events = useQuery({
    queryKey: ["site", access.token ?? access.clanId, "events"],
    queryFn: () => fetchSiteEvents(access),
    retry: false,
  });
  // Giỗ tính từ người đã mất trong cây; sự kiện chung lấy từ part=events.
  const upcoming = useMemo(
    () => shareUpcoming({ ...data, events: events.data?.items ?? [] }, 400),
    [data, events.data],
  );

  return (
    <div className="container max-w-6xl py-8 md:py-10">
      <SitePageHead
        title={t`Sự kiện & giỗ`}
        intro={t`Ngày giỗ và các dịp chung của dòng họ, tính theo âm lịch.`}
      />
      <div className="mb-5 flex gap-2">
        <Button
          size="sm"
          className="px-3 text-sm"
          variant={view === "calendar" ? "default" : "outline"}
          onClick={() => setView("calendar")}
        >
          <IconCalendar className="mr-1.5 h-4 w-4" />
          {t`Lịch`}
        </Button>
        <Button
          size="sm"
          className="px-3 text-sm"
          variant={view === "list" ? "default" : "outline"}
          onClick={() => setView("list")}
        >
          <IconList className="mr-1.5 h-4 w-4" />
          {t`Danh sách`}
        </Button>
      </div>
      {view === "calendar" ? (
        // Card bao quanh như các trang khác (Bảng tin, Di sản…): lịch + chú thích + danh sách hôm nay nằm trong một khung.
        <div className="rounded-2xl border bg-card p-4 md:p-6">
          <EventsCalendar events={upcoming} clanId="" readOnly />
        </div>
      ) : upcoming.length === 0 ? (
        <p className="rounded-2xl border bg-card py-12 text-center text-muted-foreground">{t`Chưa có sự kiện hoặc ngày giỗ nào.`}</p>
      ) : (
        <UpcomingEventList events={upcoming} clanId="" readOnly view="grid" />
      )}
    </div>
  );
}
