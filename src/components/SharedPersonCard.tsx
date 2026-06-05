import { PersonAvatar } from "@/components/PersonAvatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatLunarAnniversary, formatLunarDate } from "@/lib/lunarDate";
import { formatPartialDate } from "@/lib/partialDate";
import type {
  ShareViewFamily,
  ShareViewPerson,
} from "@/lib/queries/share-view";

interface Props {
  focal: ShareViewPerson;
  persons: ShareViewPerson[];
  families: ShareViewFamily[];
}

/**
 * Read-only person card rendered by /share/:token when the share link
 * was minted with scope='single_person'. Layout is intentionally close
 * to the in-app PersonDetail page so a relative scanning the QR sees
 * the same vocabulary, just without the edit controls.
 *
 * Living-person masking already happened in the Edge Function — every
 * field we receive is safe to display.
 */
export function SharedPersonCard({ focal, persons, families }: Props) {
  const byId = new Map(persons.map((p) => [p.id, p]));

  // Parents — via focal.birth_family_id. Either may be null in the data.
  const birthFamily = focal.birth_family_id
    ? families.find((f) => f.id === focal.birth_family_id) ?? null
    : null;
  const father = birthFamily?.husband_id ? byId.get(birthFamily.husband_id) ?? null : null;
  const mother = birthFamily?.wife_id ? byId.get(birthFamily.wife_id) ?? null : null;

  // Marriages — focal participates as either spouse.
  const marriages = families.filter(
    (f) => f.husband_id === focal.id || f.wife_id === focal.id,
  );
  const spouses = marriages
    .map((f) => {
      const otherId = f.husband_id === focal.id ? f.wife_id : f.husband_id;
      return otherId ? byId.get(otherId) ?? null : null;
    })
    .filter((p): p is ShareViewPerson => p !== null);

  // Children — anyone whose birth_family is one of the focal's marriages.
  const marriageIds = new Set(marriages.map((f) => f.id));
  const children = persons.filter(
    (p) => p.birth_family_id && marriageIds.has(p.birth_family_id),
  );

  const birthLunar =
    focal.birth_lunar_year || focal.birth_lunar_month || focal.birth_lunar_day
      ? formatLunarDate({
          year: focal.birth_lunar_year ?? undefined,
          month: focal.birth_lunar_month ?? undefined,
          day: focal.birth_lunar_day ?? undefined,
        })
      : null;
  const deathLunar =
    focal.death_lunar_year || focal.death_lunar_month || focal.death_lunar_day
      ? formatLunarDate({
          year: focal.death_lunar_year ?? undefined,
          month: focal.death_lunar_month ?? undefined,
          day: focal.death_lunar_day ?? undefined,
        })
      : null;
  const anniv = formatLunarAnniversary({
    month: focal.death_anniv_lunar_month ?? undefined,
    day: focal.death_anniv_lunar_day ?? undefined,
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <PersonAvatar
          gender={focal.gender}
          photoUrl={focal.photo_url ?? null}
          size={64}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <h1 className="clan-name text-2xl sm:text-3xl font-semibold truncate">
            {focal.full_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {focal.is_root && (
              <span className="text-accent font-medium">Thuỷ tổ • </span>
            )}
            {focal.generation !== null && <>Đời {focal.generation}</>}
            {!focal.is_living && (
              <span>
                {focal.generation !== null && " • "}đã mất
                {focal.death_date?.slice(0, 4) &&
                  ` • ${focal.death_date.slice(0, 4)}`}
              </span>
            )}
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin cơ bản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base">
          <Row label="Giới tính" value={focal.gender === "M" ? "Nam" : "Nữ"} />
          <Row label="Tên tự" value={focal.courtesy_name ?? null} />
          <Row label="Tên húy" value={focal.nickname ?? null} />
          <Row label="Tên thụy" value={focal.posthumous_name ?? null} />
          <Row
            label="Ngày sinh"
            value={
              formatPartialDate({
                date: focal.birth_date,
                precision: focal.birth_date_precision,
              }) || null
            }
          />
          <Row label="Ngày sinh (âm)" value={birthLunar} />
          {!focal.is_living && (
            <>
              <Row
                label="Ngày mất"
                value={
                  formatPartialDate({
                    date: focal.death_date,
                    precision: focal.death_date_precision,
                  }) || null
                }
              />
              <Row label="Ngày mất (âm)" value={deathLunar} />
              <Row label="Ngày giỗ" value={anniv || null} />
            </>
          )}
          <Row label="Nơi sinh" value={focal.birth_place ?? null} />
          <Row label="Nơi an táng" value={focal.burial_place ?? null} />
          {focal.bio && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-1">Tiểu sử</p>
              <p className="whitespace-pre-wrap">{focal.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {(father || mother || spouses.length > 0 || children.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Quan hệ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {(father || mother) && (
              <Group label="Cha mẹ" items={[father, mother].filter(Boolean) as ShareViewPerson[]} />
            )}
            {spouses.length > 0 && <Group label="Vợ / chồng" items={spouses} />}
            {children.length > 0 && <Group label="Con cái" items={children} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === false) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function Group({ label, items }: { label: string; items: ShareViewPerson[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{label}</h3>
      <ul className="space-y-1.5">
        {items.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
          >
            <PersonAvatar
              gender={p.gender}
              photoUrl={p.photo_url ?? null}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{p.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {p.gender === "M" ? "Nam" : "Nữ"}
                {!p.is_living &&
                  ` · đã mất${
                    p.death_date ? ` ${p.death_date.slice(0, 4)}` : ""
                  }`}
                {p.is_living &&
                  p.birth_date &&
                  ` · sinh ${p.birth_date.slice(0, 4)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
