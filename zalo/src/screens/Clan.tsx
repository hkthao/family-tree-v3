import { useState } from "react";

import {
  IconCalendar,
  IconDownload,
  IconHome,
  IconMoreHorizontal,
  IconLink,
  IconTree,
  IconUsers,
} from "@/components/icons";
import { dayAuspice } from "@/lib/almanac";
import { formatLunarDate, solarStringToLunar } from "@/lib/lunarDate";
import { getClanStats } from "@/lib/queries/clan-stats";
import { getClansInlawLinks, type ClanSummary } from "@/lib/queries/clans";
import { getClansLinkedClans } from "@/lib/queries/person-links";
import { listAnniversaryCandidates, listEvents } from "@/lib/queries/events";
import type { PersonForTree, TreeSource } from "@/lib/queries/tree";
import { supabase } from "@/lib/supabase";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type PersonAnniversary,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

import { pushBack } from "../nav";
import { scrollTopScreen } from "../scroll";
import { useRev } from "../rev";
import { useAsync } from "../useAsync";
import { EventItem, EventsScreen } from "./Events";
import { MoreScreen, type MoreTarget } from "./More";
import { PeopleScreen } from "./People";
import { linkedClansText } from "./Clans";
import { TreeTab } from "./TreeTab";

/**
 * Trang một dòng họ — cùng bố cục với bản web: thanh tab dưới đáy (Tổng
 * quan · Cây · Danh bạ · Sự kiện) và trang Tổng quan gồm giới thiệu, thông
 * gia, lịch âm hôm nay, sự kiện sắp tới, thao tác nhanh, thống kê.
 *
 * Sửa, thêm, xoá người làm ngay trong app (ở trang hồ sơ).
 */
type Tab = "overview" | "tree" | "people" | "events" | "more";

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "overview", label: "Tổng quan", Icon: IconHome },
  { id: "tree", label: "Cây", Icon: IconTree },
  { id: "people", label: "Danh bạ", Icon: IconUsers },
  { id: "events", label: "Sự kiện", Icon: IconCalendar },
  { id: "more", label: "Thêm", Icon: IconMoreHorizontal },
];

const WEEKDAY = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Sinh nhật + giỗ + sự kiện của dòng họ trong một năm tới, gần nhất trước. */
async function loadUpcoming(clan: ClanSummary, source: TreeSource): Promise<UpcomingEvent[]> {
  const table = source === "persons" ? "persons" : "persons_public_safe";
  // Sinh nhật chỉ cần người còn sống có ngày sinh — không kéo cả cây về
  // như web (getTreeData): họ chín nghìn người thì điện thoại chịu không nổi.
  const living =
    table === "persons"
      ? supabase.from("persons").select("id, full_name, birth_date, birth_date_precision, is_living, branch_id, generation").eq("clan_id", clan.id).is("deleted_at", null).eq("is_living", true).not("birth_date", "is", null)
      : supabase.from("persons_public_safe").select("id, full_name, birth_date, birth_date_precision, is_living, branch_id, generation").eq("clan_id", clan.id).eq("is_living", true).not("birth_date", "is", null);
  const [people, events, anniv] = await Promise.all([
    living.then((r) => r.data ?? []),
    // Sự kiện tự tạo chỉ thành viên đọc được; khách thì coi như không có.
    clan.role ? listEvents(clan.id).catch(() => []) : Promise.resolve([]),
    listAnniversaryCandidates(clan.id, undefined, source).catch(() => []),
  ]);
  const today = new Date();
  return [
    ...computeUpcomingEvents({ today, daysAhead: 365, persons: people as unknown as PersonForTree[], events }),
    ...computeUpcomingAnniversaries({
      today,
      daysAhead: 365,
      anniversaries: anniv as unknown as PersonAnniversary[],
      generationOffset: clan.generation_offset ?? 0,
    }),
  ].sort((a, b) => a.daysUntil - b.daysUntil);
}

function Overview({
  clan,
  upcoming,
  go,
  openPerson,
  onExport,
}: {
  onExport?: () => void;
  clan: ClanSummary;
  upcoming: { data?: UpcomingEvent[]; loading: boolean; error?: string };
  go: (t: Tab) => void;
  openPerson: (id: string) => void;
}) {
  const rev = useRev();
  const stats = useAsync(() => getClanStats(clan.id), [clan.id, rev]);
  const inlaws = useAsync(
    () => getClansInlawLinks([clan.id]).then((m) => m.get(clan.id) ?? []).catch(() => []),
    [clan.id],
  );
  const linked = useAsync(
    () => getClansLinkedClans([clan.id]).then((m) => m.get(clan.id) ?? []).catch(() => []),
    [clan.id],
  );
  const linkedText = linkedClansText(linked.data ?? []);
  const [more, setMore] = useState(false);

  const now = new Date();
  const iso = localIso(now);
  const lunar = solarStringToLunar(iso);
  const auspice = dayAuspice(iso);
  const top5 = (upcoming.data ?? []).slice(0, 5);
  const s = stats.data;

  return (
    <div className="page">
      <div className="pagehead">
        <IconHome />
        <div>
          <h2>Tổng quan</h2>
          <p className="muted">Trang chủ của {clan.name}.</p>
        </div>
      </div>

      {clan.description && (
        <p style={{ margin: "0 2px 12px", fontSize: 15, lineHeight: 1.55 }}>
          <span className={more ? undefined : "clamp3"}>{clan.description}</span>
          {clan.description.length > 140 && (
            <button type="button" className="btn text" style={{ minHeight: 0, padding: 0, display: "block" }} onClick={() => setMore((v) => !v)}>
              {more ? "Thu gọn" : "Xem thêm"}
            </button>
          )}
        </p>
      )}

      {(inlaws.data?.length ?? 0) > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <b style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <span className="ico"><IconLink /></span>
            Đã kết thông gia với {inlaws.data!.length} dòng họ
          </b>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {inlaws.data!.map((x) => (
              <span key={x.clan_id} className="chip">{x.clan_name}</span>
            ))}
          </div>
        </div>
      )}

      {linkedText && (
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <b style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <span className="ico"><IconLink /></span>
            Liên kết qua thành viên
          </b>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>{linkedText}</p>
        </div>
      )}

      {/* Lịch âm hôm nay — cùng nguồn tính với trang "Hôm nay" của web. */}
      <div className="card today">
        <span className="cal">
          <small>{WEEKDAY[now.getDay()]}</small>
          <b>{now.getDate()}</b>
          <small>Th{now.getMonth() + 1} · {now.getFullYear()}</small>
        </span>
        <span style={{ minWidth: 0 }}>
          <small className="muted" style={{ fontWeight: 600, letterSpacing: ".06em" }}>ÂM LỊCH</small>
          <b className="serif" style={{ display: "block", fontSize: 18 }}>
            {lunar ? `Ngày ${lunar.day} tháng ${lunar.month}${lunar.isLeap ? " nhuận" : ""}` : "—"}
          </b>
          <span className="muted">{lunar ? formatLunarDate(lunar).replace(/^.*?(Năm|năm)/, "Năm") : ""}</span>
          {auspice && (
            <span style={{ display: "block", marginTop: 6 }}>
              <span className={`tag ${auspice.good ? "gen" : "bad"}`}>Ngày {auspice.label.toLowerCase()}</span>{" "}
              <span className="muted">{auspice.star} — {auspice.starDesc}</span>
            </span>
          )}
        </span>
      </div>
      {auspice && (
        <p className="muted" style={{ margin: "6px 2px 0" }}>
          Giờ hoàng đạo: {auspice.goodHours.join(" · ")}
        </p>
      )}

      <h3 className="section-title sec-row">
        <span>Sự kiện sắp tới</span>
        <button type="button" className="btn text" style={{ minHeight: 0 }} onClick={() => go("events")}>Xem tất cả →</button>
      </h3>
      {upcoming.loading && <div className="sk" style={{ height: 120 }} />}
      {!upcoming.loading && top5.length === 0 && (
        <div className="card empty"><p className="muted" style={{ margin: 0 }}>Chưa có sinh nhật hay ngày giỗ nào sắp tới.</p></div>
      )}
      {top5.length > 0 && (
        <div>
          {top5.map((e) => <EventItem key={e.key} e={e} openPerson={openPerson} />)}
        </div>
      )}

      <h3 className="section-title">Thao tác nhanh</h3>
      {/* Chỉ dẫn tới các tab TRONG app. Không có nút mở trang web ngoài:
          tiêu chí duyệt của Zalo không cho Mini App đẩy người dùng sang
          ứng dụng/trang riêng. */}
      <div className={`quick ${onExport ? "" : "three"}`}>
        <button type="button" className="card" onClick={() => go("tree")}><span className="ico"><IconTree /></span>Phả hệ</button>
        <button type="button" className="card" onClick={() => go("people")}><span className="ico"><IconUsers /></span>Danh bạ</button>
        <button type="button" className="card" onClick={() => go("events")}><span className="ico"><IconCalendar /></span>Sự kiện</button>
        {onExport && (
          <button type="button" className="card" onClick={onExport}><span className="ico"><IconDownload /></span>Xuất sổ PDF</button>
        )}
      </div>

      <h3 className="section-title">Thống kê</h3>
      {stats.loading && !s && <div className="sk" style={{ height: 110 }} />}
      {s && (
        <div className="card" style={{ padding: 14 }}>
          <div>
            <b className="serif" style={{ fontSize: 20, color: "var(--primary)" }}>{s.total_persons}</b>{" "}
            <span className="muted">thành viên{s.max_generation ? ` · ${s.max_generation} đời` : ""}</span>
          </div>
          <div className="statgrid">
            <span><b>{s.males}</b> Nam</span>
            <span><b>{s.females}</b> Nữ</span>
            <span><b>{s.living}</b> Còn sống</span>
            <span><b>{s.deceased}</b> Đã mất</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClanScreen({
  clan,
  userId,
  source,
  openPerson,
  onExport,
  openPage,
}: {
  clan: ClanSummary;
  userId: string;
  source: TreeSource;
  openPerson: (id: string) => void;
  /** Có thì hiện ô "Xuất sổ PDF" ở Thao tác nhanh (chỉ thành viên). */
  onExport?: () => void;
  /** Mở một màn riêng từ tab "Thêm" (đẩy lên chồng màn hình). */
  openPage: (page: Exclude<MoreTarget, "overview" | "tree" | "people" | "events" | "export">) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  // Cây và danh bạ chỉ dựng khi đã mở lần đầu, rồi GIỮ (giấu đi) để đổi tab
  // qua lại không mất các nhánh đã bung hay vị trí đang xem.
  const [seen, setSeen] = useState<Set<Tab>>(new Set(["overview"]));
  const go = (t: Tab) => {
    setSeen((s) => new Set(s).add(t));
    setTab(t);
    scrollTopScreen();
  };
  // Nhảy tab bằng một nút TRONG NỘI DUNG (thao tác nhanh, "Xem tất cả"):
  // người dùng coi đó là "đi tới", nên lùi phải về lại tab vừa rời. Bấm
  // thẳng thanh tab thì không tính là một bước (như mọi app có tab).
  const jump = (t: Tab) => {
    const from = tab;
    if (t === from) return;
    go(t);
    pushBack(() => go(from));
  };
  const rev = useRev();
  const upcomingQ = useAsync(() => loadUpcoming(clan, source), [clan.id, source, rev]);
  // Đang tải LẠI mà đã có dữ liệu cũ thì cứ hiện dữ liệu cũ, không nháy
  // khung chờ — chỉ coi là "đang tải" khi chưa có gì để hiện.
  const upcoming = { ...upcomingQ, loading: upcomingQ.loading && !upcomingQ.data };
  const show = (t: Tab) => ({ display: tab === t ? undefined : "none" });
  const pane = "tabpane";

  return (
    <div className="has-tabs inner">
      <div className={pane} style={show("overview")}>
        <Overview clan={clan} upcoming={upcoming} go={jump} openPerson={openPerson} onExport={onExport} />
      </div>
      {seen.has("tree") && (
        <div className={pane} style={show("tree")}>
          <TreeTab clanId={clan.id} source={source} genOffset={clan.generation_offset ?? 0} openPerson={openPerson} />
        </div>
      )}
      {seen.has("people") && (
        <div className={pane} style={show("people")}>
          <PeopleScreen clan={clan} source={source} openPerson={openPerson} />
        </div>
      )}
      {seen.has("events") && (
        <div className={pane} style={show("events")}>
          <EventsScreen clan={clan} upcoming={upcoming} openPerson={openPerson} />
        </div>
      )}
      {seen.has("more") && (
        <div className={pane} style={show("more")}>
          <MoreScreen
            clan={clan}
            userId={userId}
            canExport={!!onExport}
            open={(t) => (t === "export" ? onExport?.() : t === "overview" || t === "tree" || t === "people" || t === "events" ? jump(t) : openPage(t))}
          />
        </div>
      )}


      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
            <t.Icon />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
