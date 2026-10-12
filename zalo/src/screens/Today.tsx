import { IconBell, IconCalendar } from "@/components/icons";
import { upcomingFestivals } from "@/lib/festivals";
import { formatLunarDate, solarStringToLunar } from "@/lib/lunarDate";
import type { ClanSummary } from "@/lib/queries/clans";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

import { EventItem } from "./Events";

/**
 * Hôm nay — dựng theo trang "Hôm nay" của bản web: tiêu đề kèm ngày dương
 * + ngày âm, rồi ba khối Hôm nay / 7 ngày tới / 30 ngày tới (giỗ, sinh
 * nhật, sự kiện của họ và lễ tết âm lịch), mỗi khối có số đếm và dòng nhắc
 * khi trống. Lược thẻ podcast của web.
 */

/** Hôm nay theo GIỜ MÁY người dùng — lễ tết là chuyện của lịch địa phương. */
function todayIso(): string {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

function todayHeader(): string {
  const solar = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lunar = formatLunarDate(solarStringToLunar(todayIso()));
  return lunar ? `${solar} · ${lunar}` : solar;
}

function Section({
  title,
  big,
  events,
  emptyHint,
  openPerson,
}: {
  title: string;
  big?: boolean;
  events: UpcomingEvent[];
  emptyHint: string;
  openPerson: (id: string) => void;
}) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div className="sec-row" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: big ? 20 : 17, fontWeight: 600 }}>{title}</h3>
        <span className="muted">{events.length === 0 ? "—" : `${events.length} sự kiện`}</span>
      </div>
      {events.length === 0 ? (
        <div className="card" style={{ padding: 12, fontSize: 14 }}>{emptyHint}</div>
      ) : (
        events.map((e) => <EventItem key={e.key} e={e} openPerson={openPerson} />)
      )}
    </section>
  );
}

export function TodayScreen({
  clan,
  upcoming,
  openPerson,
  goEvents,
}: {
  clan: ClanSummary;
  upcoming: { data?: UpcomingEvent[]; loading: boolean; error?: string };
  openPerson: (id: string) => void;
  goEvents: () => void;
}) {
  // Sự kiện của họ trong 30 ngày + lễ tết âm lịch, gần nhất trước.
  const all = [
    ...(upcoming.data ?? []).filter((e) => e.daysUntil <= 29),
    ...upcomingFestivals(todayIso(), 30),
  ].sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title, "vi"));

  return (
    <div className="page">
      <div className="pagehead">
        <IconCalendar />
        <div>
          <h2>Hôm nay</h2>
          <p className="muted">{todayHeader()}</p>
        </div>
      </div>

      {upcoming.loading && [0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 68, marginBottom: 8 }} />)}
      {upcoming.error && <p className="error">{upcoming.error}</p>}

      {!upcoming.loading && (
        <>
          <Section
            title="Hôm nay"
            big
            emptyHint="Hôm nay không có giỗ, sinh nhật hay lễ tết nào."
            events={all.filter((e) => e.daysUntil === 0)}
            openPerson={openPerson}
          />
          <Section
            title="7 ngày tới"
            emptyHint="Không có sự kiện nào trong tuần."
            events={all.filter((e) => e.daysUntil >= 1 && e.daysUntil <= 6)}
            openPerson={openPerson}
          />
          <Section
            title="30 ngày tới"
            emptyHint="Không có sự kiện nào trong tháng."
            events={all.filter((e) => e.daysUntil >= 7 && e.daysUntil <= 29)}
            openPerson={openPerson}
          />
        </>
      )}

      <div className="card todaynote">
        <span className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {clan.role ? (
            <>
              <span className="ico"><IconBell /></span>
              Bật nhắc qua email ở trang Sự kiện trên bản web.
            </>
          ) : (
            "Bạn đang xem dòng họ ở chế độ công khai."
          )}
        </span>
        <button type="button" className="btn text" style={{ minHeight: 0, padding: 0, whiteSpace: "nowrap" }} onClick={goEvents}>
          Xem toàn bộ lịch →
        </button>
      </div>
    </div>
  );
}
