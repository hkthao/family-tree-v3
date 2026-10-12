import { useEffect, useState } from "react";
import { openWebview } from "zmp-sdk";

import {
  IconArrowRight,
  IconCalendar,
  IconGlobe,
  IconHome,
  IconLink,
  IconTree,
  IconUsers,
} from "@/components/icons";
import { dayAuspice } from "@/lib/almanac";
import { displayGenLabel } from "@/lib/displayGeneration";
import { formatLunarDate, solarStringToLunar } from "@/lib/lunarDate";
import { getClanStats } from "@/lib/queries/clan-stats";
import { getClansInlawLinks, type ClanSummary } from "@/lib/queries/clans";
import { listAnniversaryCandidates, listEvents } from "@/lib/queries/events";
import { listPersons, type PersonRow } from "@/lib/queries/persons";
import type { PersonForTree, TreeSource } from "@/lib/queries/tree";
import { supabase } from "@/lib/supabase";
import { generationColor } from "@/lib/tree/folderModel";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type PersonAnniversary,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

import { useAsync } from "../useAsync";
import { TreeTab } from "./TreeTab";

/**
 * Trang một dòng họ — cùng bố cục với bản web: thanh tab dưới đáy (Tổng
 * quan · Cây · Danh bạ · Sự kiện) và trang Tổng quan gồm giới thiệu, thông
 * gia, lịch âm hôm nay, sự kiện sắp tới, thao tác nhanh, thống kê.
 *
 * Bản đầu chỉ XEM: các thao tác sửa/thêm/xuất của web gom vào một nút mở
 * bản web đầy đủ.
 */
type Tab = "overview" | "tree" | "people" | "events";

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "overview", label: "Tổng quan", Icon: IconHome },
  { id: "tree", label: "Cây", Icon: IconTree },
  { id: "people", label: "Danh bạ", Icon: IconUsers },
  { id: "events", label: "Sự kiện", Icon: IconCalendar },
];

const WEEKDAY = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const KIND: Record<UpcomingEvent["kind"], string> = {
  birthday: "Sinh nhật",
  anniversary: "Ngày giỗ",
  custom: "Sự kiện",
  tomb_visit: "Tảo mộ",
  festival: "Lễ tiết",
};
const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Sinh nhật + giỗ + sự kiện của dòng họ trong một năm tới, gần nhất trước. */
async function loadUpcoming(clan: ClanSummary, source: TreeSource): Promise<UpcomingEvent[]> {
  const table = source === "persons" ? "persons" : "persons_public_safe";
  // Sinh nhật chỉ cần người còn sống có ngày sinh — không kéo cả cây về
  // như web (getTreeData): họ chín nghìn người thì điện thoại chịu không nổi.
  const living =
    table === "persons"
      ? supabase.from("persons").select("id, full_name, birth_date, is_living, branch_id, generation").eq("clan_id", clan.id).is("deleted_at", null).eq("is_living", true).not("birth_date", "is", null)
      : supabase.from("persons_public_safe").select("id, full_name, birth_date, is_living, branch_id, generation").eq("clan_id", clan.id).eq("is_living", true).not("birth_date", "is", null);
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

function EventRowView({ e, openPerson }: { e: UpcomingEvent; openPerson: (id: string) => void }) {
  const [, m, d] = e.date.split("-");
  return (
    <button type="button" className="rel" disabled={!e.personId} onClick={() => e.personId && openPerson(e.personId)}>
      <span className={`days${e.daysUntil <= 7 ? " soon" : ""}`}>
        <small>TH{Number(m)}</small>
        <b>{Number(d)}</b>
      </span>
      <span style={{ minWidth: 0 }}>
        <b>{e.title}</b>
        <span className="muted">{[KIND[e.kind], e.subtitle].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="muted" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
        {e.daysUntil === 0 ? "Hôm nay" : e.daysUntil === 1 ? "Ngày mai" : `Còn ${e.daysUntil} ngày`}
      </span>
    </button>
  );
}

function Overview({
  clan,
  upcoming,
  go,
  openPerson,
}: {
  clan: ClanSummary;
  upcoming: ReturnType<typeof useAsync<UpcomingEvent[]>>;
  go: (t: Tab) => void;
  openPerson: (id: string) => void;
}) {
  const stats = useAsync(() => getClanStats(clan.id), [clan.id]);
  const inlaws = useAsync(
    () => getClansInlawLinks([clan.id]).then((m) => m.get(clan.id) ?? []).catch(() => []),
    [clan.id],
  );
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
        <p style={{ margin: "0 2px 12px", fontSize: 14.5, lineHeight: 1.55 }}>
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

      {/* Lịch âm hôm nay — cùng nguồn tính với trang "Hôm nay" của web. */}
      <div className="card today">
        <span className="cal">
          <small>{WEEKDAY[now.getDay()]}</small>
          <b>{now.getDate()}</b>
          <small>Th{now.getMonth() + 1} · {now.getFullYear()}</small>
        </span>
        <span style={{ minWidth: 0 }}>
          <small className="muted" style={{ fontWeight: 600, letterSpacing: ".06em" }}>ÂM LỊCH</small>
          <b className="serif" style={{ display: "block", fontSize: 17 }}>
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
        <div className="card rels">
          {top5.map((e) => <EventRowView key={e.key} e={e} openPerson={openPerson} />)}
        </div>
      )}

      <h3 className="section-title">Thao tác nhanh</h3>
      <div className="quick">
        <button type="button" className="card" onClick={() => go("tree")}><span className="ico"><IconTree /></span>Phả hệ</button>
        <button type="button" className="card" onClick={() => go("people")}><span className="ico"><IconUsers /></span>Danh bạ</button>
        <button type="button" className="card" onClick={() => go("events")}><span className="ico"><IconCalendar /></span>Sự kiện</button>
        <button type="button" className="card" onClick={() => openWebview({ url: `https://giapha.thaohk.com/clans/${clan.id}` })}>
          <span className="ico"><IconGlobe /></span>Bản web đầy đủ
        </button>
      </div>

      <h3 className="section-title">Thống kê</h3>
      {stats.loading && <div className="sk" style={{ height: 110 }} />}
      {s && (
        <div className="card" style={{ padding: 14 }}>
          <div>
            <b className="serif" style={{ fontSize: 30, color: "var(--primary)" }}>{s.total_persons}</b>{" "}
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

function Events({
  upcoming,
  openPerson,
}: {
  upcoming: ReturnType<typeof useAsync<UpcomingEvent[]>>;
  openPerson: (id: string) => void;
}) {
  const rows = upcoming.data ?? [];
  return (
    <div className="page">
      <div className="pagehead">
        <IconCalendar />
        <div>
          <h2>Sự kiện</h2>
          <p className="muted">Sinh nhật, ngày giỗ và sự kiện của dòng họ trong một năm tới.</p>
        </div>
      </div>
      {upcoming.loading && [0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 60, marginBottom: 6 }} />)}
      {upcoming.error && <p className="error">{upcoming.error}</p>}
      {!upcoming.loading && rows.length === 0 && (
        <div className="card empty"><div className="icon"><IconCalendar /></div><p className="muted">Chưa có sự kiện nào sắp tới.</p></div>
      )}
      {rows.length > 0 && (
        <div className="card rels">
          {rows.map((e) => <EventRowView key={e.key} e={e} openPerson={openPerson} />)}
        </div>
      )}
    </div>
  );
}

const PAGE = 30;

function People({
  clan,
  source,
  openPerson,
}: {
  clan: ClanSummary;
  source: TreeSource;
  openPerson: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [pages, setPages] = useState(1);
  useEffect(() => {
    const h = setTimeout(() => {
      setQ(search.trim());
      setPages(1);
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  const list = useAsync(async () => {
    // Tải dồn từng trang: cuộn tới đâu bấm "Xem thêm" tới đó.
    let rows: PersonRow[] = [];
    let total = 0;
    for (let page = 1; page <= pages; page++) {
      const r = await listPersons(clan.id, { page, pageSize: PAGE, search: q || undefined, sort: "generation", source });
      rows = rows.concat(r.rows);
      total = r.total;
    }
    return { rows, total };
  }, [clan.id, q, pages, source]);
  const rows = list.data?.rows ?? [];

  return (
    <div className="page">
      <div className="searchbar">
        <input className="field" type="search" placeholder="Tìm trong danh bạ…" aria-label="Tìm trong danh bạ" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {list.data && <p className="muted" style={{ margin: "0 2px 8px" }}>{list.data.total} người</p>}
      {list.loading && rows.length === 0 && [0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 56, marginBottom: 6 }} />)}
      {list.error && <p className="error">{list.error}</p>}
      {rows.length > 0 && (
        <div className="card rels">
          {rows.map((p) => {
            const color = generationColor(p.generation);
            const b = p.birth_date?.slice(0, 4);
            const d = p.death_date?.slice(0, 4);
            return (
              <button key={p.id} type="button" className="rel" onClick={() => openPerson(p.id)}>
                <span className="mono" style={{ width: 36, height: 36, fontSize: 15 }}>{p.full_name.trim().split(/\s+/).pop()?.charAt(0)}</span>
                <span style={{ minWidth: 0 }}>
                  <b>{p.full_name} <span className={p.gender === "M" ? "m" : "f"}>{p.gender === "M" ? "♂" : "♀"}</span></b>
                  <span className="meta" style={{ "--gen": color ?? undefined } as React.CSSProperties}>
                    {color && <span className="badge">{displayGenLabel(p.generation, clan.generation_offset ?? 0)}</span>}
                    {b || d ? `${b ?? "?"}–${d ?? (p.is_living ? "nay" : "?")}` : ""}
                  </span>
                </span>
                <span className="go"><IconArrowRight /></span>
              </button>
            );
          })}
        </div>
      )}
      {list.data && rows.length < list.data.total && (
        <button type="button" className="btn ghost block" style={{ marginTop: 10 }} disabled={list.loading} onClick={() => setPages((n) => n + 1)}>
          {list.loading ? "Đang tải…" : "Xem thêm"}
        </button>
      )}
    </div>
  );
}

export function ClanScreen({
  clan,
  source,
  openPerson,
}: {
  clan: ClanSummary;
  source: TreeSource;
  openPerson: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  // Cây và danh bạ chỉ dựng khi đã mở lần đầu, rồi GIỮ (giấu đi) để đổi tab
  // qua lại không mất các nhánh đã bung hay vị trí đang xem.
  const [seen, setSeen] = useState<Set<Tab>>(new Set(["overview"]));
  const go = (t: Tab) => {
    setSeen((s) => new Set(s).add(t));
    setTab(t);
    window.scrollTo(0, 0);
  };
  const upcoming = useAsync(() => loadUpcoming(clan, source), [clan.id, source]);
  const show = (t: Tab) => ({ display: tab === t ? undefined : "none" });

  return (
    <div className="has-tabs">
      <div style={show("overview")}>
        <Overview clan={clan} upcoming={upcoming} go={go} openPerson={openPerson} />
      </div>
      {seen.has("tree") && (
        <div style={show("tree")}>
          <TreeTab clanId={clan.id} source={source} genOffset={clan.generation_offset ?? 0} openPerson={openPerson} />
        </div>
      )}
      {seen.has("people") && (
        <div style={show("people")}>
          <People clan={clan} source={source} openPerson={openPerson} />
        </div>
      )}
      {seen.has("events") && (
        <div style={show("events")}>
          <Events upcoming={upcoming} openPerson={openPerson} />
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
