import { CollapsibleCard } from "@/components/CollapsibleCard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { IconClock, IconScroll } from "@/components/icons";
import {
  REIGN_ROLE_LABEL,
  getPersonHistorical,
  type PersonHistorical,
} from "@/lib/queries/historical";
import { bioTimelineRows, yearOf } from "@/lib/personTimeline";
import {
  getPersonTimeline,
  type TimelineRow,
} from "@/lib/queries/person-timeline";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
/** Viết hoa chữ cái đầu mỗi dòng ("định luật lệnh…" → "Định luật lệnh…"). */
function capFirst(t: string): string {
  return t
    .split("\n")
    .map((l) => (l ? l.charAt(0).toLocaleUpperCase("vi") + l.slice(1) : l))
    .join("\n");
}

function years(
  from: number | null | undefined,
  to: number | null | undefined,
): string {
  if (from != null && to != null) return `${from}–${to}`;
  if (from != null) return t`từ ${from}`;
  if (to != null) return t`đến ${to}`;
  return "";
}

/**
 * Trị vì, tước hiệu, cha mẹ nuôi và nguồn sử liệu của một người trong dòng họ
 * lịch sử. Không có dữ liệu nào → không hiện gì.
 */
export function HistoricalPersonSections({
  personId,
  bio,
  birthDate,
  deathDate,
  clanId,
  userId,
  onPersonClick,
  only,
}: {
  personId: string;
  /** Tiểu sử có mục "Sự nghiệp theo năm" → dòng thời gian. */
  bio?: string | null;
  /** Ngày sinh / mất (YYYY…) — dòng thời gian chỉ lấy các mốc trong đời người. */
  birthDate?: string | null;
  deathDate?: string | null;
  clanId: string;
  /** Rỗng = khách chưa đăng nhập (trang xem thử công khai). */
  userId?: string;
  /** Trang xem thử: bấm tên cha mẹ nuôi → đổi người đang xem thay vì mở trang trong app. */
  onPersonClick?: (personId: string) => void;
  /** Chỉ vẽ một phần (để đặt dòng thời gian xuống cuối trang); bỏ trống = cả hai. */
  only?: "reign" | "timeline";
}) {
  const { data } = useQuery({
    queryKey: ["person-historical", personId, userId ?? ""],
    queryFn: () => getPersonHistorical(personId),
    enabled: !!personId,
  });
  if (!data) return null;
  return (
    <>
      {only !== "timeline" && (
        <ReignCard data={data} clanId={clanId} onPersonClick={onPersonClick} />
      )}
      {only !== "reign" && (
        <TimelineCard
          personId={personId}
          bio={bio ?? null}
          birthYear={yearOf(birthDate)}
          deathYear={yearOf(deathDate)}
        />
      )}
    </>
  );
}

function ReignCard({
  data,
  clanId,
  onPersonClick,
}: {
  data: PersonHistorical;
  clanId: string;
  onPersonClick?: (personId: string) => void;
}) {
  const { reigns, titles, adoptiveParents } = data;
  if (
    reigns.length === 0 &&
    titles.length === 0 &&
    adoptiveParents.length === 0
  )
    return null;
  return (
    <CollapsibleCard
      title={
        <>
          <IconScroll className="h-5 w-5" />
          {reigns.length > 0 ? t`Trị vì & tước hiệu` : t`Tước hiệu`}
        </>
      }
      titleClassName="inline-flex items-center gap-2"
      contentClassName="space-y-4 text-base"
    >
      {reigns.map((r) => (
        <div key={r.id} className="space-y-1">
          <p className="font-medium">
            {REIGN_ROLE_LABEL[r.role] ?? r.role}
            {r.ordinal != null ? t` thứ ${r.ordinal}` : ""} nhà {r.dynasty}
            {r.temple_name ? t` · miếu hiệu ${r.temple_name}` : ""}
          </p>
          {years(r.reign_start_year, r.reign_end_year) && (
            <p className="text-muted-foreground">
              <Trans>
              Ở ngôi {years(r.reign_start_year, r.reign_end_year)}
              </Trans>
            </p>
          )}
          {r.era_names.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5 pt-1"
              aria-label={t`Niên hiệu`}
            >
              {r.era_names.map((e) => (
                <span
                  key={e.name}
                  className="rounded-full border bg-card px-2.5 py-0.5 text-sm"
                >
                  {e.name}
                  {e.from_year != null ? ` (${e.from_year})` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {titles.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">{t`Tước hiệu, chức vị`}</p>
          <ul className="space-y-0.5">
            {titles.map((t) => (
              <li key={t.id}>
                {t.title}
                {years(t.from_year, t.to_year) && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {years(t.from_year, t.to_year)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {adoptiveParents.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">{t`Cha mẹ nuôi / thừa tự`}</p>
          <ul className="space-y-0.5">
            {adoptiveParents.map((p) => (
              <li key={p.person_id}>
                <span className="text-muted-foreground">
                  {p.role === "father" ? t`Cha nuôi: ` : t`Mẹ nuôi: `}
                </span>
                {onPersonClick ? (
                  <button
                    type="button"
                    onClick={() => onPersonClick(p.person_id)}
                    className="text-primary hover:underline"
                  >
                    {p.full_name ?? t`(ẩn)`}
                  </button>
                ) : (
                  <Link
                    to={`/clans/${clanId}/people/${p.person_id}`}
                    className="text-primary hover:underline"
                  >
                    {p.full_name ?? t`(ẩn)`}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollapsibleCard>
  );
}

interface TimelineEntry {
  year: number;
  /** Can chi của năm ("Bính Tuất"), nếu có ghi. */
  era: string | null;
  text: string;
}

/** Gộp các mốc cùng năm, thêm mốc Sinh / Mất từ hồ sơ nếu chưa có mốc cùng năm. */
function buildTimeline(
  rows: TimelineRow[],
  birthYear: number | null,
  deathYear: number | null,
): TimelineEntry[] {
  const entries = new Map<number, TimelineEntry>();
  for (const r of rows) {
    const prev = entries.get(r.year);
    if (prev) {
      prev.text = `${prev.text}\n${r.body}`;
      prev.era ??= r.era;
    } else entries.set(r.year, { year: r.year, era: r.era, text: r.body });
  }
  if (birthYear != null && !entries.has(birthYear)) {
    entries.set(birthYear, { year: birthYear, era: null, text: "Sinh." });
  }
  if (deathYear != null && !entries.has(deathYear)) {
    const age = birthYear != null ? t`, thọ ${deathYear - birthYear} tuổi` : "";
    entries.set(deathYear, { year: deathYear, era: null, text: t`Mất${age}.` });
  }
  return [...entries.values()].sort((a, b) => a.year - b.year);
}

function TimelineCard({
  personId,
  bio,
  birthYear,
  deathYear,
}: {
  personId: string;
  bio: string | null;
  birthYear: number | null;
  deathYear: number | null;
}) {
  const { data: saved } = useQuery({
    queryKey: ["person-timeline", personId],
    queryFn: () => getPersonTimeline(personId),
    enabled: !!personId,
  });
  // Đã có mốc lưu trong DB (sửa ở form "Sửa thông tin") thì dùng; chưa có thì dựng tạm từ tiểu sử.
  const rows =
    saved && saved.length > 0
      ? saved
      : bioTimelineRows(bio, birthYear, deathYear);
  // Chỉ có mốc Sinh / Mất tự thêm thì chưa thành "dòng thời gian".
  if (rows.length === 0) return null;
  const entries = buildTimeline(rows, birthYear, deathYear);
  return (
    <CollapsibleCard
      title={
        <>
          <IconClock className="h-5 w-5" />
          {t`Dòng thời gian`}
        </>
      }
      titleClassName="inline-flex items-center gap-2"
      contentClassName="space-y-5"
    >
      <ol className="pt-1">
        {entries.map((e, i) => {
          const last = i === entries.length - 1;
          return (
            <li
              key={e.year}
              className="grid grid-cols-[4.75rem_1.5rem_1fr] gap-x-3"
            >
              <div className="pt-px text-right">
                <p className="text-xl font-bold leading-none text-primary">
                  {e.year}
                </p>
                {e.era && (
                  <p className="mt-1 whitespace-nowrap text-xs font-medium text-muted-foreground">
                    {e.era}
                  </p>
                )}
              </div>
              <div className="relative">
                {/* Đoạn trục nối mốc này với mốc kế */}
                <span
                  aria-hidden
                  className={`absolute left-1/2 top-2 w-[3px] -translate-x-1/2 rounded-full ${
                    last
                      ? "bottom-[-0.25rem] bg-primary"
                      : "bottom-[-0.5rem] bg-gradient-to-b from-primary to-primary/30"
                  }`}
                />
                <span
                  aria-hidden
                  className="absolute left-1/2 top-0 box-border h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-primary bg-card"
                />
                {last && (
                  <span
                    aria-hidden
                    className="absolute bottom-[-0.75rem] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary"
                  />
                )}
              </div>
              <div className={`min-w-0 ${last ? "pb-3" : "pb-7"}`}>
                <p className="whitespace-pre-line leading-relaxed">
                  {capFirst(e.text)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </CollapsibleCard>
  );
}
