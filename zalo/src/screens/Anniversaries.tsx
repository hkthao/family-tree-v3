import type { ClanSummary } from "@/lib/queries/clans";
import {
  IconArrowRight,
  IconFlame,
} from "@/components/icons";
import { listMyClans } from "@/lib/queries/clans";
import { supabase } from "@/lib/supabase";
import {
  computeUpcomingAnniversaries,
  type PersonAnniversary,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

import { useAsync } from "../useAsync";

const DAYS_AHEAD = 60;

type Row = UpcomingEvent & { clan: ClanSummary };

/**
 * Ngày giỗ sắp tới của MỌI dòng họ tôi tham gia, gần nhất trước.
 *
 * Tính ngày dương của giỗ âm lịch bằng đúng hàm của bản web
 * (`computeUpcomingAnniversaries`) — hai nơi mà tính lệch nhau một ngày
 * là có nhà cúng sai ngày.
 */
async function load(userId: string): Promise<Row[]> {
  const { rows: clans } = await listMyClans(userId, { page: 1, pageSize: 50 });
  if (clans.length === 0) return [];
  const { data, error } = await supabase
    .from("persons")
    .select(
      "id, clan_id, full_name, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap, generation, branch_id",
    )
    .in("clan_id", clans.map((c) => c.id))
    .is("deleted_at", null)
    .not("death_anniv_lunar_month", "is", null)
    .not("death_anniv_lunar_day", "is", null);
  if (error) throw new Error(error.message);

  const today = new Date();
  const out: Row[] = [];
  for (const clan of clans) {
    const people = (data ?? []).filter((p) => p.clan_id === clan.id);
    for (const e of computeUpcomingAnniversaries({
      today,
      daysAhead: DAYS_AHEAD,
      anniversaries: people as unknown as PersonAnniversary[],
      generationOffset: clan.generation_offset ?? 0,
    })) {
      out.push({ ...e, clan });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

const when = (d: number) =>
  d === 0 ? "Hôm nay" : d === 1 ? "Ngày mai" : `Còn ${d} ngày`;

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export function AnniversariesScreen({
  userId,
  openPerson,
}: {
  userId: string;
  openPerson: (clan: ClanSummary, personId: string) => void;
}) {
  const q = useAsync(() => load(userId), [userId]);
  const rows = q.data ?? [];

  return (
    <div className="page">
      <h2 className="section-title" style={{ marginTop: 4 }}>
        Ngày giỗ trong {DAYS_AHEAD} ngày tới
      </h2>

      {q.loading &&
        [0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 64, marginBottom: 8 }} />)}

      {q.error && (
        <div className="card empty">
          <p className="error">{q.error}</p>
          <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
        </div>
      )}

      {q.data && rows.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconFlame /></div>
          <p className="muted">
            Không có ngày giỗ nào trong {DAYS_AHEAD} ngày tới. Ngày giỗ được
            tính từ ngày mất âm lịch ghi trong hồ sơ.
          </p>
        </div>
      )}

      {rows.map((e) => (
        <button
          key={`${e.clan.id}:${e.key}`}
          type="button"
          className="card event"
          disabled={!e.personId}
          onClick={() => e.personId && openPerson(e.clan, e.personId)}
        >
          <span className={`days${e.daysUntil <= 7 ? " soon" : ""}`}>
            <b>{e.daysUntil === 0 ? "•" : e.daysUntil}</b>
            <small>{e.daysUntil === 0 ? "hôm nay" : "ngày"}</small>
          </span>
          <span style={{ minWidth: 0 }}>
            <b>{e.title}</b>
            <span className="muted">
              {when(e.daysUntil)} · {dmy(e.date)} · {e.clan.name}
            </span>
          </span>
          <span className="go"><IconArrowRight /></span>
        </button>
      ))}
    </div>
  );
}
