import { CollapsibleCard } from "@/components/CollapsibleCard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { IconScroll } from "@/components/icons";
import {
  REIGN_ROLE_LABEL,
  getPersonHistorical,
  type PersonHistorical,
} from "@/lib/queries/historical";
import { PersonTimelineCard } from "@/components/timeline/PersonTimelineCard";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
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
  canEdit,
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
  /** Người xem sửa được dòng thời gian (editor/admin). Trang xem thử công khai: false. */
  canEdit?: boolean;
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
        <PersonTimelineCard
          personId={personId}
          clanId={clanId}
          userId={userId}
          canEdit={!!canEdit}
          bio={bio ?? null}
          birthDate={birthDate}
          deathDate={deathDate}
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
