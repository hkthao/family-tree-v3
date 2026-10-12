import { useState } from "react";

import { IconBellOff, IconCalendar, IconGrid, IconList } from "@/components/icons";
import { formatDate, formatRelative } from "@/lib/formatDate";
import { formatCanChiShort, formatLunarDate, getCanChiForSolarDate } from "@/lib/lunarDate";
import type { ClanSummary } from "@/lib/queries/clans";
import { listEvents, type EventRow } from "@/lib/queries/events";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

import { useAsync } from "../useAsync";

/**
 * Sự kiện — dựng theo trang Sự kiện của bản web: đổi kiểu Danh sách /
 * Lưới, chọn khoảng 30 ngày / 90 ngày / Cả năm, mỗi sự kiện một thẻ (ô
 * ngày bên trái, tên + loại + can chi ở giữa, "Còn N ngày" bên phải), rồi
 * thẻ "Sự kiện tuỳ chỉnh".
 *
 * Lược: kiểu xem Lịch, xuất file .ics, tạo thiệp, thêm/xoá sự kiện — các
 * việc tải file và sửa dữ liệu làm ở bản web.
 */
const LOOKAHEAD = [
  { label: "30 ngày", value: 30 },
  { label: "90 ngày", value: 90 },
  { label: "Cả năm", value: 365 },
];
const PAGE = 20;

const KIND: Record<UpcomingEvent["kind"], string> = {
  birthday: "Sinh nhật",
  anniversary: "Ngày giỗ",
  tomb_visit: "Tảo mộ / Chạp họ",
  custom: "Sự kiện",
  festival: "Lễ, tết",
};

/** Màu nhãn "Còn N ngày" theo độ gấp — cùng ngưỡng với web. */
const urgency = (d: number) => (d <= 1 ? "now" : d <= 7 ? "soon" : "");
const countdown = (d: number) => (d === 0 ? "Hôm nay" : d === 1 ? "Ngày mai" : `Còn ${d} ngày`);

/** Một sự kiện sắp tới. `variant="card"` là thẻ dọc cho kiểu Lưới. */
export function EventItem({
  e,
  variant = "row",
  openPerson,
}: {
  e: UpcomingEvent;
  variant?: "row" | "card";
  openPerson: (id: string) => void;
}) {
  const [, m, d] = e.date.split("-");
  const canChi = getCanChiForSolarDate(e.date);
  const today = e.daysUntil === 0;
  const tile = (
    <span className={`evday${today ? " today" : ""}`}>
      <small>Th {Number(m)}</small>
      <b>{Number(d)}</b>
    </span>
  );
  const text = (
    <span style={{ minWidth: 0, flex: 1 }}>
      <b className="evtitle">{e.title}</b>
      <span className="sub">{[KIND[e.kind], e.subtitle].filter(Boolean).join(" • ")}</span>
      {canChi && <span className="tiny ell faint">{formatCanChiShort(canChi)}</span>}
    </span>
  );
  const when = <span className={`evwhen ${urgency(e.daysUntil)}`}>{countdown(e.daysUntil)}</span>;

  return (
    <button
      type="button"
      className={`card ev ${variant}${today ? " today" : ""}`}
      disabled={!e.personId}
      onClick={() => e.personId && openPerson(e.personId)}
    >
      {variant === "card" ? (
        <>
          <span className="evtop">{tile}{when}</span>
          {text}
        </>
      ) : (
        <>
          {tile}
          {text}
          {when}
        </>
      )}
    </button>
  );
}

function customWhen(e: EventRow): string {
  if (e.date_solar) return formatDate(e.date_solar) ?? e.date_solar;
  const lunar = formatLunarDate({
    year: e.lunar_year ?? undefined,
    month: e.lunar_month ?? undefined,
    day: e.lunar_day ?? undefined,
  });
  return lunar || (e.lunar_day && e.lunar_month ? `${e.lunar_day}/${e.lunar_month} âm lịch` : "");
}

export function EventsScreen({
  clan,
  upcoming,
  openPerson,
}: {
  clan: ClanSummary;
  upcoming: { data?: UpcomingEvent[]; loading: boolean; error?: string };
  openPerson: (id: string) => void;
}) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [daysAhead, setDaysAhead] = useState(90);
  const [shown, setShown] = useState(PAGE);
  // Sự kiện tự tạo chỉ thành viên đọc được.
  const custom = useAsync(
    () => (clan.role ? listEvents(clan.id).catch(() => []) : Promise.resolve([] as EventRow[])),
    [clan.id, clan.role],
  );

  const all = (upcoming.data ?? []).filter((e) => e.daysUntil <= daysAhead);
  const rows = all.slice(0, shown);

  return (
    <div className="page">
      <div className="pagehead">
        <IconCalendar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>Sự kiện</h2>
          <p className="muted">Giỗ, sinh nhật, sự kiện chung của dòng họ.</p>
        </div>
        <div className="seg" style={{ margin: 0 }} role="group" aria-label="Chế độ hiển thị">
          <button type="button" aria-pressed={view === "list"} aria-label="Danh sách" onClick={() => setView("list")}><IconList /></button>
          <button type="button" aria-pressed={view === "grid"} aria-label="Lưới" onClick={() => setView("grid")}><IconGrid /></button>
        </div>
      </div>

      <div className="seg full" role="group" aria-label="Khoảng thời gian">
        {LOOKAHEAD.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={daysAhead === o.value}
            onClick={() => {
              setDaysAhead(o.value);
              setShown(PAGE);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {upcoming.loading && [0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 68, marginBottom: 8 }} />)}
      {upcoming.error && <p className="error">{upcoming.error}</p>}

      {!upcoming.loading && all.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconBellOff /></div>
          <b>Không có sự kiện sắp tới</b>
          <p className="muted">
            Trong {daysAhead} ngày tới chưa có sinh nhật, ngày giỗ hay sự kiện
            tuỳ chỉnh nào.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className={view === "grid" ? "evgrid" : undefined}>
          {rows.map((e) => (
            <EventItem key={e.key} e={e} variant={view === "grid" ? "card" : "row"} openPerson={openPerson} />
          ))}
        </div>
      )}
      {all.length > shown && (
        <button type="button" className="btn ghost block" style={{ marginTop: 4 }} onClick={() => setShown((n) => n + PAGE)}>
          Xem thêm ({all.length - shown} sự kiện)
        </button>
      )}

      <section className="card pane" style={{ marginTop: 14 }}>
        <h3 className="serif" style={{ marginBottom: 2 }}>Sự kiện tuỳ chỉnh</h3>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          Họp họ, ngày kỷ niệm dòng họ — theo dương lịch hoặc âm lịch.
        </p>
        {custom.loading && <div className="sk" style={{ height: 48 }} />}
        {!custom.loading && (custom.data?.length ?? 0) === 0 && (
          <p className="muted" style={{ margin: 0 }}>Chưa có sự kiện tuỳ chỉnh nào.</p>
        )}
        {(custom.data ?? []).map((e) => (
          <div key={e.id} className="cevent">
            <b>{e.title}</b>
            <span className="sub">
              {customWhen(e)}
              {e.is_yearly ? " • lặp hằng năm" : ""}
            </span>
            <span className="tiny faint">
              {[formatDate(e.created_at) && `Tạo ${formatDate(e.created_at)}`, formatRelative(e.updated_at) && `Cập nhật ${formatRelative(e.updated_at)}`].filter(Boolean).join(" • ")}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
