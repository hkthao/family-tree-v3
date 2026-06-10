import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { AddSpouseForm } from "@/pages/clan/AddSpouse";
import { AddChildForm } from "@/pages/clan/AddChild";
import { AddParentForm } from "@/pages/clan/AddParent";
import { RelationSheet } from "@/components/RelationSheet";

import {
  IconBell,
  IconLink,
  IconPencil,
  IconPlus,
  IconQrCode,
  IconScroll,
  IconTrash,
  IconUsers,
} from "@/components/icons";
import { BackLink } from "@/components/BackLink";
import { useConfirm } from "@/components/ConfirmDialog";
import { ContributeDialog } from "@/components/ContributeDialog";
import { PersonAvatar } from "@/components/PersonAvatar";
import { QrCodeModal } from "@/components/QrCodeModal";
import { SubscribeToggle } from "@/components/SubscribeToggle";
import { useToast } from "@/components/Toast";
import { getOrCreatePersonShareLink } from "@/lib/queries/share-links";
import { getSignedPhotoUrl } from "@/lib/photoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import { InlawFamilyCard } from "@/components/InlawFamilyCard";
import {
  listLinksForPerson,
  peekLink,
  type PersonLink,
} from "@/lib/queries/person-links";
import {
  formatCanChiShort,
  formatLunarAnniversary,
  formatLunarDate,
  getCanChiForSolarDate,
  lunarToSolarString,
  solarStringToLunar,
} from "@/lib/lunarDate";
import { track } from "@/lib/analytics";
import { formatPartialDate } from "@/lib/partialDate";
import { queryKeys } from "@/lib/queries/keys";
import {
  getPersonRelationships,
  type Relationship,
} from "@/lib/queries/families";
import {
  deletePerson,
  getPerson,
  type PersonDetail as PersonDetailT,
} from "@/lib/queries/persons";

export default function PersonDetail() {
  const { clanId, personId } = useParams<{ clanId: string; personId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const askConfirm = useConfirm();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  // Where to send the breadcrumb back. Tree action icons append
  // ?from=tree; everything else (e.g. clicking from /people) leaves
  // it absent and we fall back to Danh bạ.
  const fromTree = searchParams.get("from") === "tree";
  const backTo = fromTree ? `/clans/${clanId}/tree` : `/clans/${clanId}/people`;
  // Append the same ?from when navigating onward so the chain holds
  // through Edit / AddSpouse / AddChild.
  const fromQs = fromTree ? "?from=tree" : "";

  // Clan comes from the layout, not a duplicate fetch.
  const { clan } = useClanContext();
  // Non-members of a public clan read through the masked view —
  // same source-selection pattern as /tree and /people. Without
  // this they'd hit "Không tìm thấy người này" the moment they
  // clicked a card on the public tree, even though they can see
  // the same card on screen.
  const personSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data: person, isLoading } = useQuery({
    queryKey: [...queryKeys.person(personId ?? "", userId), personSource],
    queryFn: () => getPerson(personId!, undefined, personSource),
    enabled: !!personId,
  });

  const { data: relationships } = useQuery({
    queryKey: [
      ...queryKeys.personRelationships(personId ?? "", userId),
      personSource,
    ],
    queryFn: () => getPersonRelationships(personId!, undefined, personSource),
    enabled: !!personId && !!person,
  });

  const { data: photoUrl } = useQuery({
    queryKey: ["signed-photo", personId, person?.photo_path ?? null],
    queryFn: () => getSignedPhotoUrl(person?.photo_path ?? null),
    enabled: !!person?.photo_path,
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePerson(personId!),
    onSuccess: async () => {
      track("person_deleted");
      await invalidateClanData(queryClient, clanId!);
      toast.success(`Đã xoá ${person?.full_name ?? "người này"}`, {
        description: "Có thể khôi phục từ nhật ký.",
      });
      navigate(backTo);
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const [qrOpen, setQrOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  // Which inline relation sheet is open. null = none.
  const [addSheet, setAddSheet] = useState<"parent" | "spouse" | "child" | null>(
    null,
  );
  const qrM = useMutation({
    mutationFn: () => getOrCreatePersonShareLink(clanId!, personId!),
    onError: (e) =>
      toast.error("Không tạo được QR", { description: (e as Error).message }),
  });
  const qrUrl = qrM.data
    ? `${window.location.origin}/share/${qrM.data.token}`
    : "";

  if (!clanId || !personId) return null;

  const canEdit =
    clan.isPlatformAdmin || clan.myRole === "admin" || clan.myRole === "editor";
  // QR creation needs to write share_links, which only clan admin can do
  // under the current RLS policy. Editors don't see the button.
  const canCreateQr = clan.isPlatformAdmin || clan.myRole === "admin";
  // Any signed-in member of the clan (incl. viewers) can submit a
  // contribution; admin reviews before it lands.
  const canContribute =
    !!user && (clan.isPlatformAdmin || clan.myRole !== null);

  return (
    <div className="space-y-6">
      <nav>
        <BackLink fallback={backTo} />
      </nav>

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

        {!isLoading && !person && (
          <Alert variant="destructive">
            <AlertDescription>Không tìm thấy người này.</AlertDescription>
          </Alert>
        )}

        {person && (
          <>
            <header className="flex items-center gap-3">
              <PersonAvatar
                gender={person.gender}
                photoUrl={photoUrl ?? null}
                size={56}
              />
              <div className="space-y-0.5 min-w-0 flex-1">
                <h1 className="clan-name text-xl sm:text-3xl font-semibold truncate">
                  {person.full_name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {person.is_root && (
                    <span className="text-accent font-medium">Thuỷ tổ • </span>
                  )}
                  {person.generation !== null && <>Đời {person.generation}</>}
                  {!person.is_living && (
                    <span>
                      {person.generation !== null && " • "}
                      đã mất
                      {person.death_date?.slice(0, 4) &&
                        ` • ${person.death_date.slice(0, 4)}`}
                    </span>
                  )}
                </p>
              </div>
              {effectiveRole(clan) !== null && personId && (
                <SubscribeToggle
                  clanId={clan.id}
                  scope="person"
                  targetId={personId}
                  icon={<IconBell className="h-4 w-4 sm:mr-1.5" />}
                  labelOff={<span className="hidden sm:inline">Theo dõi</span>}
                  labelOn={
                    <span className="hidden sm:inline">Đang theo dõi</span>
                  }
                />
              )}
            </header>

            {canEdit && (
              <MissingFieldsHint
                person={person}
                parentsCount={relationships?.parents.length ?? null}
                editHref={`/clans/${clanId}/people/${personId}/edit`}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Thông tin cơ bản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-base">
                <DetailRow label="Giới tính" value={person.gender === "M" ? "Nam" : "Nữ"} />
                <DetailRow label="Tên tự" value={person.courtesy_name} />
                <DetailRow label="Tên húy" value={person.nickname} />
                <DetailRow label="Tên thụy" value={person.posthumous_name} />
                <DetailRow
                  label="Ngày sinh"
                  value={formatPartialDate({
                    date: person.birth_date,
                    precision: person.birth_date_precision,
                  }) || null}
                />
                {/* Lunar birth: prefer the explicitly-stored lunar
                    fields (tombstones often record only lunar). If
                    those are absent but we have a full solar day, we
                    auto-derive — it's deterministic so showing both
                    helps elderly users orient by whichever calendar
                    they know. */}
                <LunarDetailRow
                  label="Ngày sinh (âm)"
                  lunarYear={person.birth_lunar_year}
                  lunarMonth={person.birth_lunar_month}
                  lunarDay={person.birth_lunar_day}
                  fallbackSolar={
                    person.birth_date_precision === "day"
                      ? person.birth_date
                      : null
                  }
                />
                {!person.is_living && (
                  <>
                    <DetailRow
                      label="Ngày mất"
                      value={formatPartialDate({
                        date: person.death_date,
                        precision: person.death_date_precision,
                      }) || null}
                    />
                    <LunarDetailRow
                      label="Ngày mất (âm)"
                      lunarYear={person.death_lunar_year}
                      lunarMonth={person.death_lunar_month}
                      lunarDay={person.death_lunar_day}
                      fallbackSolar={
                        person.death_date_precision === "day"
                          ? person.death_date
                          : null
                      }
                    />
                    <DetailRow
                      label="Ngày giỗ"
                      value={
                        formatLunarAnniversary({
                          month: person.death_anniv_lunar_month ?? undefined,
                          day: person.death_anniv_lunar_day ?? undefined,
                        }) || null
                      }
                    />
                  </>
                )}
                <DetailRow label="Nơi sinh" value={person.birth_place} />
                <DetailRow label="Nơi an táng" value={person.burial_place} />
                {person.bio && (
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground mb-1">Tiểu sử</p>
                    <p className="whitespace-pre-wrap">{person.bio}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {relationships && (
              <Card>
                <CardHeader>
                  <CardTitle>Quan hệ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <RelationshipGroup
                    label="Cha mẹ"
                    items={relationships.parents}
                    clanId={clanId}
                    emptyHint="Chưa nhập cha mẹ"
                    action={
                      canEdit && relationships.parents.length < 2 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAddSheet("parent")}
                        >
                          <IconPlus className="h-4 w-4 mr-1" />
                          Thêm
                        </Button>
                      ) : null
                    }
                  />
                  <RelationshipGroup
                    label="Vợ / chồng"
                    items={relationships.spouses}
                    clanId={clanId}
                    emptyHint="Chưa có vợ / chồng."
                    action={
                      canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAddSheet("spouse")}
                        >
                          <IconPlus className="h-4 w-4 mr-1" />
                          Thêm
                        </Button>
                      ) : null
                    }
                  />
                  <RelationshipGroup
                    label="Con cái"
                    items={relationships.children}
                    clanId={clanId}
                    emptyHint="Chưa có con cái."
                    action={
                      canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAddSheet("child")}
                        >
                          <IconPlus className="h-4 w-4 mr-1" />
                          Thêm
                        </Button>
                      ) : null
                    }
                  />
                </CardContent>
              </Card>
            )}

            <InLawLinksSection personId={personId!} userId={userId} viewingClanId={clan.id} />

            {/* Primary action row — Sửa (editors) or Đề xuất sửa
                (non-editors). Admins don't need a "suggest" path
                since they can edit directly. */}
            <div className="flex flex-wrap gap-3">
              {canEdit ? (
                <Button asChild className="flex-1 sm:flex-none">
                  <Link to={`/clans/${clanId}/people/${personId}/edit${fromQs}`}>
                    <IconPencil className="h-4 w-4 mr-1.5" />
                    Sửa thông tin
                  </Link>
                </Button>
              ) : (
                canContribute && (
                  <Button
                    className="flex-1 sm:flex-none"
                    onClick={() => setContribOpen(true)}
                  >
                    <IconScroll className="h-4 w-4 mr-1.5" />
                    Đề xuất sửa
                  </Button>
                )
              )}
              <Button asChild variant="outline" className="flex-1 sm:flex-none">
                <Link to={`/clans/${clanId}/kinship?a=${personId}`}>
                  <IconUsers className="h-4 w-4 mr-1.5" />
                  Xưng hô
                </Link>
              </Button>
              {canCreateQr && (
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => {
                    setQrOpen(true);
                    if (!qrM.data) qrM.mutate();
                  }}
                >
                  <IconQrCode className="h-4 w-4 mr-1.5" />
                  QR cá nhân
                </Button>
              )}
            </div>

            {/* Destructive action — separated from the primary row so
                it's harder to mis-tap and visually doesn't compete
                with the common actions. Same size as the row above
                so the page reads as a single coherent action stack. */}
            {canEdit && (
              <div className="pt-3 border-t">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: `Xoá ${person.full_name}?`,
                      description: "Có thể khôi phục từ nhật ký.",
                      confirmLabel: "Xoá",
                      destructive: true,
                    });
                    if (ok) deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    "Đang xoá…"
                  ) : (
                    <>
                      <IconTrash className="h-4 w-4 mr-1.5" />
                      Xoá người này
                    </>
                  )}
                </Button>
              </div>
            )}

            <QrCodeModal
              open={qrOpen}
              onClose={() => setQrOpen(false)}
              url={qrUrl}
              loading={qrM.isPending}
              title={`QR · ${person.full_name}`}
              description="Quét để mở trang cá nhân (chỉ-đọc). Có thể in lên bia, sổ gia phả, danh thiếp."
              onDownloadPdf={async () => {
                try {
                  // Lazy-load @react-pdf/renderer (~1.5MB) on demand
                  // so the initial app payload doesn't carry it.
                  const { downloadSinglePersonQrPdf } = await import(
                    "@/lib/pdf/exportPersonQrPdf"
                  );
                  await downloadSinglePersonQrPdf(clan.name, {
                    clanId: clan.id,
                    personId: person.id,
                    fullName: person.full_name,
                    courtesyName: person.courtesy_name,
                    generation: person.generation,
                    birthYear: person.birth_date?.slice(0, 4) ?? null,
                    deathYear: person.death_date?.slice(0, 4) ?? null,
                    isLiving: person.is_living,
                  });
                  toast.success("Đã tải PDF danh thiếp");
                } catch (e) {
                  toast.error("Không tạo được PDF", {
                    description: (e as Error).message,
                  });
                }
              }}
            />

            {canContribute && (
              <ContributeDialog
                open={contribOpen}
                onClose={() => setContribOpen(false)}
                clanId={clan.id}
                userId={user?.id}
                focalPerson={{
                  id: person.id,
                  full_name: person.full_name,
                  gender: person.gender,
                  is_living: person.is_living,
                  birth_date: person.birth_date,
                  death_date: person.death_date,
                  courtesy_name: person.courtesy_name,
                  birth_place: person.birth_place,
                  burial_place: person.burial_place,
                  bio: person.bio,
                }}
              />
            )}

            {deleteMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(deleteMutation.error as Error).message}
                </AlertDescription>
              </Alert>
            )}

            {canEdit && (
              <>
                <RelationSheet
                  open={addSheet === "parent"}
                  title="Thêm cha / mẹ"
                  subtitle={`Cho ${person.full_name}`}
                  onClose={() => setAddSheet(null)}
                >
                  <AddParentForm
                    clanId={clanId!}
                    personId={personId!}
                    onSaved={() => setAddSheet(null)}
                    onCancel={() => setAddSheet(null)}
                  />
                </RelationSheet>
                <RelationSheet
                  open={addSheet === "spouse"}
                  title="Thêm vợ / chồng"
                  subtitle={`Cho ${person.full_name}`}
                  onClose={() => setAddSheet(null)}
                >
                  <AddSpouseForm
                    clanId={clanId!}
                    personId={personId!}
                    onSaved={() => setAddSheet(null)}
                    onCancel={() => setAddSheet(null)}
                  />
                </RelationSheet>
                <RelationSheet
                  open={addSheet === "child"}
                  title="Thêm con"
                  subtitle={`Cho ${person.full_name}`}
                  onClose={() => setAddSheet(null)}
                >
                  <AddChildForm
                    clanId={clanId!}
                    personId={personId!}
                    onSaved={() => setAddSheet(null)}
                    onCancel={() => setAddSheet(null)}
                  />
                </RelationSheet>
              </>
            )}
        </>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
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

/**
 * Renders a lunar date row. Prefers the explicitly-stored lunar fields
 * (tombstones often have lunar but not solar), falling back to
 * deriving from a known full solar date — that way we show *something*
 * for users who only entered solar.
 */
function LunarDetailRow({
  label,
  lunarYear,
  lunarMonth,
  lunarDay,
  fallbackSolar,
}: {
  label: string;
  lunarYear: number | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  fallbackSolar: string | null;
}) {
  let lunar: { year: number; month: number; day: number; isLeap: boolean } | null = null;
  if (lunarYear && lunarMonth && lunarDay) {
    lunar = { year: lunarYear, month: lunarMonth, day: lunarDay, isLeap: false };
  } else if (fallbackSolar) {
    lunar = solarStringToLunar(fallbackSolar);
  }
  const text = formatLunarDate(lunar);
  if (!text) return <DetailRow label={label} value={null} />;

  // Resolve the matching solar date so we can compute the day Can Chi.
  const solarForCanChi = fallbackSolar ?? (lunar ? lunarToSolarString(lunar) : null);
  const canChi = getCanChiForSolarDate(solarForCanChi);

  return (
    <DetailRow
      label={label}
      value={
        <span className="space-y-0.5 inline-block align-top">
          <span className="block">{text}</span>
          {canChi && (
            <span className="block text-xs text-muted-foreground">
              {formatCanChiShort(canChi)}
            </span>
          )}
        </span>
      }
    />
  );
}

function RelationshipGroup({
  label,
  items,
  clanId,
  emptyHint,
  action,
}: {
  label: string;
  items: Relationship[];
  clanId: string;
  emptyHint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{label}</h3>
        {action}
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                to={`/clans/${clanId}/people/${r.id}`}
                className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:border-primary transition-colors"
              >
                <PersonAvatar gender={r.gender} photoUrl={null} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.gender === "M" ? "Nam" : "Nữ"}
                    {!r.is_living &&
                      ` · đã mất${r.death_date ? ` ${r.death_date.slice(0, 4)}` : ""}`}
                    {r.is_living &&
                      r.birth_date &&
                      ` · sinh ${r.birth_date.slice(0, 4)}`}
                  </p>
                </div>
                <span
                  className="text-muted-foreground shrink-0"
                  aria-hidden="true"
                >
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Cross-clan link section ─────────────────────────────────────────

/**
 * Renders a Card listing every confirmed person_link this person is
 * part of. Each row peeks the peer through get_link_peek so we never
 * cross RLS on the peer clan's persons table directly. Hides itself
 * entirely when there are no active links.
 */
function InLawLinksSection({
  personId,
  userId,
  viewingClanId,
}: {
  personId: string;
  userId: string;
  viewingClanId: string;
}) {
  const { data: links } = useQuery({
    queryKey: queryKeys.personLinksForPerson(personId, userId),
    queryFn: () => listLinksForPerson(personId),
    enabled: !!userId && !!personId,
  });
  if (!links || links.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <IconLink className="h-5 w-5" />
          Liên kết thông gia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.map((l) => (
          <InLawLinkRow
            key={l.id}
            link={l}
            userId={userId}
            viewingClanId={viewingClanId}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function InLawLinkRow({
  link,
  userId,
  viewingClanId,
}: {
  link: PersonLink;
  userId: string;
  viewingClanId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: peek, isLoading } = useQuery({
    queryKey: queryKeys.personLinkPeek(link.id, userId),
    queryFn: () => peekLink(link.id),
    enabled: !!userId,
  });
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (!peek) return null;
  // Build meta string once so the JSX stays readable.
  const metaBits: string[] = [peek.clan_name];
  if (!peek.masked) {
    if (peek.gender) metaBits.push(peek.gender === "M" ? "Nam" : "Nữ");
    if (peek.generation) metaBits.push(`Đời ${peek.generation}`);
    if (peek.birth_year && peek.death_year) {
      metaBits.push(`${peek.birth_year}–${peek.death_year}`);
    } else if (peek.birth_year) {
      metaBits.push(`sinh ${peek.birth_year}`);
    } else if (peek.death_year) {
      metaBits.push(`mất ${peek.death_year}`);
    }
  }

  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      {/* Identity row — full width, no horizontal squeeze from buttons. */}
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">
          {peek.masked
            ? "Người còn sống"
            : (peek.full_name ?? "—")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          <span className="text-foreground">{metaBits[0]}</span>
          {metaBits.slice(1).map((bit) => (
            <span key={bit}> · {bit}</span>
          ))}
        </p>
        {peek.masked && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Họ này chưa công khai thông tin người sống.
          </p>
        )}
      </div>

      {/* Action row — buttons split full width on narrow screens, hug
          their content on sm+. Previously the row was a single flex
          row that squeezed the name into character-per-line wrap. */}
      <div className="flex gap-2 flex-wrap">
        {!peek.masked && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <Link to={`/clans/${peek.clan_id}/people/${peek.person_id}`}>
              Xem trang
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          className="flex-1 sm:flex-none"
        >
          {expanded ? "Thu gọn" : "Gia đình bên đó"}
        </Button>
      </div>

      {expanded && (
        <div className="pt-2 border-t">
          <InlawFamilyCard linkId={link.id} viewingClanId={viewingClanId} />
        </div>
      )}
    </div>
  );
}

// Subtle inline hint listing the missing-but-fixable fields. Pure
// gentle nudge — no full progress bar here. We only flag the hard
// gaps that drive the clan-wide completion percentage (năm sinh,
// năm mất/giỗ, cha/mẹ) plus `ảnh` because it's a one-tap upload
// that pays off visually. Excluded persons (todo_excluded = true)
// are intentionally silent — admin has already said "leave them
// alone".
function MissingFieldsHint({
  person,
  parentsCount,
  editHref,
}: {
  person: PersonDetailT;
  /** null = relationships still loading, [] = loaded with no parents. */
  parentsCount: number | null;
  editHref: string;
}) {
  if (person.todo_excluded) return null;

  const missing: string[] = [];

  if (!person.birth_date && !person.birth_lunar_year) {
    missing.push("năm sinh");
  }
  if (!person.is_living) {
    const hasDeath =
      !!person.death_date ||
      !!person.death_lunar_year ||
      !!person.death_anniv_lunar_month;
    if (!hasDeath) missing.push("năm mất/giỗ");
  }
  if (!person.is_root && parentsCount === 0) {
    missing.push("cha/mẹ");
  }
  if (!person.photo_path) missing.push("ảnh");

  if (missing.length === 0) return null;

  return (
    <Link
      to={editHref}
      className="block rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
    >
      <span className="text-muted-foreground">Hồ sơ này còn thiếu: </span>
      <span>{missing.join(" · ")}</span>
      <span className="text-primary ml-1.5">→ Sửa</span>
    </Link>
  );
}

export type { PersonDetailT };
