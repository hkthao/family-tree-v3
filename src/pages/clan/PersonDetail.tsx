import { CollapsibleCard } from "@/components/CollapsibleCard";
import { CollapsibleBio } from "@/components/BioText";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { AddSpouseForm } from "@/pages/clan/AddSpouse";
import { AddChildForm } from "@/pages/clan/AddChild";
import { AddParentForm } from "@/pages/clan/AddParent";
import { PanelLink } from "@/components/panel/PanelLink";
import { RelationSheet } from "@/components/RelationSheet";
import { RelationshipGroup } from "@/components/RelationshipGroup";

import {
  IconBell,
  IconChevronUp,
  IconLink,
  IconPencil,
  IconPlus,
  IconQrCode,
  IconScroll,
  IconTrash,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { Breadcrumb } from "@/components/Breadcrumb";
import { HistoricalPersonSections } from "@/components/HistoricalPersonSections";
import { useConfirm } from "@/components/ConfirmDialog";
import { ContributeDialog } from "@/components/ContributeDialog";
import { PersonAvatar } from "@/components/PersonAvatar";
import { QrCodeModal } from "@/components/QrCodeModal";
import { KhoeButton } from "@/components/KhoeButton";
import { SubscribeToggle } from "@/components/SubscribeToggle";
import { useToast } from "@/components/Toast";
import { getOrCreatePersonShareLink } from "@/lib/queries/share-links";
import {
  getSignedPhotoUrl,
  getSignedPhotoUrlMap,
  PHOTO_URL_STALE_MS,
} from "@/lib/photoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import { InlawFamilyCard } from "@/components/InlawFamilyCard";
import {
  linkTypeFromSide,
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
import { computeLifespanYears, lifespanLabel } from "@/lib/lifespan";
import { listPostsForPerson } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";
import {
  getPersonRelationships,
  reorderSpouseFamilies,
  removeChildLink,
  removeParentLink,
  removeSpouseLink,
  type Relationship,
  type SpouseRelationship,
} from "@/lib/queries/families";
import {
  getRestingPlacesForPerson,
  RESTING_PLACE_KIND_LABEL,
} from "@/lib/queries/restingPlaces";
import {
  getHeritageItemsForPerson,
  HERITAGE_CATEGORY_LABEL,
} from "@/lib/queries/heritage";
import {
  deletePerson,
  getPerson,
  type PersonDetail as PersonDetailT,
} from "@/lib/queries/persons";

import { PersonNavButtons } from "@/components/PersonNavButtons";

import { t } from "@lingui/core/macro";
/** Đang chạy trong ngăn kéo: bấm người thân → đổi sang chi tiết người đó (cùng panel). */
const EmbeddedPersonContext = createContext(false);

export interface EmbeddedPerson {
  id: string;
  /** Đóng ngăn kéo (sau khi xoá người này…). */
  onClose: () => void;
}

export default function PersonDetail({
  embedded,
}: { embedded?: EmbeddedPerson } = {}) {
  const routeParams = useParams<{ clanId: string; personId: string }>();
  const { clan } = useClanContext();
  const clanId = embedded ? clan.id : routeParams.clanId;
  const personId = embedded ? embedded.id : routeParams.personId;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const askConfirm = useConfirm();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  // Đo lượt xem chi tiết người (không gửi id — theo quy ước không PII).
  useEffect(() => {
    track("person_viewed");
  }, [personId]);

  // Where to send the breadcrumb back. Tree action icons append
  // ?from=tree; everything else (e.g. clicking from /people) leaves
  // it absent and we fall back to Danh bạ.
  const fromTree = searchParams.get("from") === "tree";
  const backTo = fromTree ? `/clans/${clanId}/tree` : `/clans/${clanId}/people`;
  // Append the same ?from when navigating onward so the chain holds
  // through Edit / AddSpouse / AddChild.
  const fromQs = fromTree ? "?from=tree" : "";

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

  const { data: heritageItems } = useQuery({
    queryKey: ["person-heritage", personId, userId],
    queryFn: () => getHeritageItemsForPerson(personId!),
    enabled: !!personId && !!userId,
  });
  const { data: restingPlaces } = useQuery({
    queryKey: ["person-resting-places", personId, userId],
    queryFn: () => getRestingPlacesForPerson(personId!),
    enabled: !!personId && effectiveRole(clan) !== null,
  });

  const { data: relationships } = useQuery({
    queryKey: [
      ...queryKeys.personRelationships(personId ?? "", userId),
      personSource,
    ],
    queryFn: () => getPersonRelationships(personId!, undefined, personSource),
    enabled: !!personId && !!person,
  });

  // Ảnh của cha mẹ / vợ chồng / con trong mục Quan hệ. Ký MỘT lượt cho
  // cả nhóm; trước đây mục này luôn vẽ hình minh hoạ dù người thân có ảnh.
  const relationPhotoPaths = relationships
    ? [
        ...relationships.parents,
        ...relationships.spouses,
        ...relationships.children,
      ]
        .map((r) => r.photo_path)
        .filter((p): p is string => !!p)
        .sort()
    : [];
  const { data: relationPhotoUrls } = useQuery({
    queryKey: ["signed-photos", relationPhotoPaths.join(",")],
    queryFn: () => getSignedPhotoUrlMap(relationPhotoPaths),
    enabled: relationPhotoPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });

  const { data: photoUrl } = useQuery({
    queryKey: ["signed-photo", personId, person?.photo_path ?? null],
    queryFn: () => getSignedPhotoUrl(person?.photo_path ?? null),
    enabled: !!person?.photo_path,
    staleTime: PHOTO_URL_STALE_MS,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePerson(personId!),
    onSuccess: async () => {
      track("person_deleted");
      await invalidateClanData(queryClient, clanId!);
      toast.success(t`Đã xoá ${person?.full_name ?? t`người này`}`, {
        description: t`Có thể khôi phục từ nhật ký.`,
      });
      if (embedded) embedded.onClose();
      else navigate(backTo);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  const reorderSpousesMutation = useMutation({
    mutationFn: (orderedFamilyIds: string[]) =>
      reorderSpouseFamilies(orderedFamilyIds),
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
    },
    onError: (e) =>
      toast.error(t`Không đổi được thứ tự`, {
        description: (e as Error).message,
      }),
  });

  // Gỡ liên kết quan hệ nhập nhầm (người không bị xoá khỏi dòng họ).
  const removeRelationMutation = useMutation({
    mutationFn: async (args: {
      kind: "parent" | "spouse" | "child";
      rel: Relationship;
    }) => {
      if (args.kind === "parent")
        return removeParentLink(personId!, args.rel.id);
      if (args.kind === "spouse") {
        return removeSpouseLink(
          (args.rel as SpouseRelationship).family_id,
          personId!,
        );
      }
      return removeChildLink(args.rel.id);
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
      toast.success(t`Đã gỡ liên kết`);
    },
    onError: (e) =>
      toast.error(t`Không gỡ được`, { description: (e as Error).message }),
  });

  async function removeRelation(
    kind: "parent" | "spouse" | "child",
    rel: Relationship,
  ) {
    const name = person?.full_name ?? t`người này`;
    const text = {
      parent: {
        title: t`Gỡ ${rel.full_name} khỏi cha mẹ của ${name}?`,
        description: t`${rel.full_name} vẫn còn trong dòng họ, chỉ không còn là cha/mẹ của ${name} (và anh chị em cùng cha mẹ). Có thể nhập lại sau.`,
      },
      spouse: {
        title: t`Gỡ liên kết vợ/chồng với ${rel.full_name}?`,
        description: t`${rel.full_name} vẫn còn trong dòng họ. Nếu hai người đã có con, các con vẫn giữ liên kết với ${name}.`,
      },
      child: {
        title: t`Gỡ ${rel.full_name} khỏi con cái của ${name}?`,
        description: t`${rel.full_name} vẫn còn trong dòng họ, chỉ không còn là con của ${name}. Có thể nhập lại sau.`,
      },
    }[kind];
    const ok = await askConfirm({
      ...text,
      confirmLabel: t`Gỡ liên kết`,
      destructive: true,
    });
    if (ok) removeRelationMutation.mutate({ kind, rel });
  }

  // Swap a spouse with its neighbour and persist the whole list's
  // ranking. `relationships.spouses` is already in display order.
  function moveSpouse(index: number, dir: -1 | 1) {
    if (!relationships) return;
    const ids = relationships.spouses.map((s) => s.family_id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorderSpousesMutation.mutate(ids);
  }

  const [qrOpen, setQrOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  // Which inline relation sheet is open. null = none.
  const [addSheet, setAddSheet] = useState<
    "parent" | "spouse" | "child" | null
  >(null);
  const qrM = useMutation({
    mutationFn: () => getOrCreatePersonShareLink(clanId!, personId!),
    onError: (e) =>
      toast.error(t`Không tạo được QR`, { description: (e as Error).message }),
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
    <EmbeddedPersonContext.Provider value={!!embedded}>
      <div className="space-y-3">
        {!embedded && (
          <Breadcrumb
            items={[
              { label: clan.name, to: `/clans/${clanId}` },
              { label: t`Danh bạ`, to: `/clans/${clanId}/people` },
              { label: person?.full_name ?? t`Người` },
            ]}
          />
        )}
        {!embedded && clanId && personId && (
          <PersonNavButtons clanId={clanId} personId={personId} />
        )}

        {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}

        {!isLoading && !person && (
          <Alert variant="destructive">
            <AlertDescription>{t`Không tìm thấy người này.`}</AlertDescription>
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
                  {person.generation !== null && (
                    <>Đời {person.generation - clan.generation_offset}</>
                  )}
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
                  labelOff={
                    <span className="hidden sm:inline">{t`Theo dõi`}</span>
                  }
                  labelOn={
                    <span className="hidden sm:inline">{t`Đang theo dõi`}</span>
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

            <CollapsibleCard
              title={
                <>
                  <IconUser className="h-5 w-5" />
                  {t`Thông tin cơ bản`}
                </>
              }
              titleClassName="inline-flex items-center gap-2"
              contentClassName="space-y-2 text-base"
            >
              <DetailRow
                label={t`Giới tính`}
                value={person.gender === "M" ? t`Nam` : t`Nữ`}
              />
              <DetailRow label={t`Tên tự`} value={person.courtesy_name} />
              <DetailRow label={t`Tên húy`} value={person.nickname} />
              <DetailRow label={t`Tên thụy`} value={person.posthumous_name} />
              <DetailRow
                label={t`Ngày sinh`}
                value={
                  formatPartialDate({
                    date: person.birth_date,
                    precision: person.birth_date_precision,
                  }) || null
                }
              />
              {/* Lunar birth: prefer the explicitly-stored lunar
                    fields (tombstones often record only lunar). If
                    those are absent but we have a full solar day, we
                    auto-derive — it's deterministic so showing both
                    helps elderly users orient by whichever calendar
                    they know. */}
              <LunarDetailRow
                historical={clan.kind === "historical"}
                label={t`Ngày sinh (âm)`}
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
                    label={t`Ngày mất`}
                    value={
                      formatPartialDate({
                        date: person.death_date,
                        precision: person.death_date_precision,
                      }) || null
                    }
                  />
                  <LunarDetailRow
                    historical={clan.kind === "historical"}
                    label={t`Ngày mất (âm)`}
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
                    label={t`Ngày giỗ`}
                    value={
                      formatLunarAnniversary({
                        month: person.death_anniv_lunar_month ?? undefined,
                        day: person.death_anniv_lunar_day ?? undefined,
                      }) || null
                    }
                  />
                  {(() => {
                    // ≥60 tuổi: "Hưởng thọ"; dưới 60: "Hưởng dương".
                    const tho = computeLifespanYears(
                      person.lifespan_years,
                      person.birth_date,
                      person.death_date,
                    );
                    return tho == null ? null : (
                      <DetailRow
                        label={lifespanLabel(tho)}
                        value={t`${tho} tuổi`}
                      />
                    );
                  })()}
                </>
              )}
              <DetailRow label={t`Nơi sinh`} value={person.birth_place} />
              <DetailRow label={t`Nơi an táng`} value={person.burial_place} />
              {restingPlaces && restingPlaces.length > 0 && (
                <DetailRow
                  label={t`Mộ phần / tro cốt`}
                  value={
                    <span className="flex flex-col gap-0.5">
                      {restingPlaces.map((rp) => (
                        <Link
                          key={rp.id}
                          to={`/clans/${clanId}/graves/${rp.id}`}
                          className="text-primary hover:underline"
                        >
                          {rp.name ||
                            rp.location_name ||
                            RESTING_PLACE_KIND_LABEL[rp.kind]}
                          <span className="text-muted-foreground">
                            {" "}
                            · {RESTING_PLACE_KIND_LABEL[rp.kind]}
                          </span>
                        </Link>
                      ))}
                    </span>
                  }
                />
              )}
              {heritageItems && heritageItems.length > 0 && (
                <DetailRow
                  label={t`Di sản liên quan`}
                  value={
                    <span className="flex flex-col gap-0.5">
                      {heritageItems.map((h) => (
                        <Link
                          key={h.id}
                          to={`/clans/${clanId}/heritage/${h.id}`}
                          className="text-primary hover:underline"
                        >
                          {h.title}
                          <span className="text-muted-foreground">
                            {" "}
                            · {HERITAGE_CATEGORY_LABEL[h.category]}
                          </span>
                        </Link>
                      ))}
                    </span>
                  }
                />
              )}
              {person.bio && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-1">{t`Tiểu sử`}</p>
                  <CollapsibleBio text={person.bio} />
                </div>
              )}
            </CollapsibleCard>

            {clan.kind === "historical" && (
              <HistoricalPersonSections
                personId={person.id}
                clanId={clanId!}
                userId={userId}
                only="reign"
              />
            )}

            {relationships && (
              <CollapsibleCard
                title={
                  <>
                    <IconUsers className="h-5 w-5" />
                    {t`Quan hệ`}
                  </>
                }
                titleClassName="inline-flex items-center gap-2"
                contentClassName="space-y-5"
              >
                <RelationshipGroup
                  LinkComponent={PersonLink}
                  label={t`Cha mẹ`}
                  items={relationships.parents}
                  clanId={clanId}
                  photoUrls={relationPhotoUrls}
                  emptyHint={t`Chưa nhập cha mẹ`}
                  onRemove={
                    canEdit ? (rel) => removeRelation("parent", rel) : undefined
                  }
                  action={
                    canEdit && relationships.parents.length < 2 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="add-parent-button"
                        onClick={() => setAddSheet("parent")}
                      >
                        <IconPlus className="h-4 w-4 mr-1" />
                        {t`Thêm`}
                      </Button>
                    ) : null
                  }
                />
                <RelationshipGroup
                  LinkComponent={PersonLink}
                  label={t`Vợ / chồng`}
                  items={relationships.spouses}
                  clanId={clanId}
                  photoUrls={relationPhotoUrls}
                  emptyHint={t`Chưa có vợ / chồng.`}
                  onRemove={
                    canEdit ? (rel) => removeRelation("spouse", rel) : undefined
                  }
                  reorder={
                    canEdit && relationships.spouses.length > 1
                      ? {
                          onMove: moveSpouse,
                          busy: reorderSpousesMutation.isPending,
                        }
                      : undefined
                  }
                  action={
                    canEdit ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="add-spouse-button"
                        onClick={() => setAddSheet("spouse")}
                      >
                        <IconPlus className="h-4 w-4 mr-1" />
                        {t`Thêm`}
                      </Button>
                    ) : null
                  }
                />
                <RelationshipGroup
                  LinkComponent={PersonLink}
                  label={t`Con cái`}
                  items={relationships.children}
                  clanId={clanId}
                  photoUrls={relationPhotoUrls}
                  emptyHint={t`Chưa có con cái.`}
                  onRemove={
                    canEdit ? (rel) => removeRelation("child", rel) : undefined
                  }
                  action={
                    canEdit ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="add-child-button"
                        onClick={() => setAddSheet("child")}
                      >
                        <IconPlus className="h-4 w-4 mr-1" />
                        {t`Thêm`}
                      </Button>
                    ) : null
                  }
                />
              </CollapsibleCard>
            )}

            {/* Dòng thời gian: ngay dưới thẻ Quan hệ. */}
            {clan.kind === "historical" && (
              <HistoricalPersonSections
                personId={person.id}
                bio={person.bio}
                birthDate={person.birth_date}
                deathDate={person.death_date}
                clanId={clanId!}
                userId={userId}
                only="timeline"
              />
            )}

            <InLawLinksSection
              personId={personId!}
              userId={userId}
              viewingClanId={clan.id}
            />
            <RelatedPostsSection personId={personId!} clanId={clan.id} />

            {/* Actions row — desktop: nút rộng cố định 100px, dạt phải; mobile: các nút
                chia đều bề ngang để cả hàng nằm gọn một dòng (cố định 100px thì 4 nút
                tràn xuống dòng thứ hai). Xưng hô đã chuyển xuống thẻ "Quan hệ" (mỗi người
                thân đã có nút tra cứu cạnh tên), bỏ ở đây.

                flex-wrap: bốn nút × 100px + khoảng cách vượt khung 360px,
                không cho xuống dòng thì nút đầu bị đẩy khuất mép trái. */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="min-w-0 flex-1 px-2 sm:w-[100px] sm:flex-none"
                >
                  <PanelLink
                    to={`/clans/${clanId}/people/${personId}/edit${fromQs}`}
                    panel="person-edit"
                    panelParams={{ pid: personId }}
                    data-testid="edit-person-link"
                    aria-label={t`Sửa thông tin`}
                    title={t`Sửa thông tin`}
                  >
                    <IconPencil className="h-4 w-4 mr-1.5" />
                    {t`Sửa`}
                  </PanelLink>
                </Button>
              ) : (
                canContribute && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-0 flex-1 px-2 sm:w-[100px] sm:flex-none"
                    onClick={() => setContribOpen(true)}
                    aria-label={t`Đề xuất sửa`}
                    title={t`Đề xuất sửa`}
                  >
                    <IconScroll className="h-4 w-4 mr-1.5" />
                    {t`Đề xuất`}
                  </Button>
                )
              )}
              {effectiveRole(clan) !== null && (
                <KhoeButton
                  clanId={clan.id}
                  clanName={clan.name}
                  genOffset={clan.generation_offset}
                  canCreateQr={effectiveRole(clan) !== null}
                  person={{
                    id: person.id,
                    full_name: person.full_name,
                    generation: person.generation,
                    photo_path: person.photo_path,
                  }}
                  className="min-w-0 flex-1 px-2 sm:w-[100px] sm:flex-none"
                />
              )}
              {canCreateQr && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 flex-1 px-2 sm:w-[100px] sm:flex-none"
                  data-testid="person-qr-button"
                  onClick={() => {
                    setQrOpen(true);
                    if (!qrM.data) qrM.mutate();
                  }}
                  aria-label={t`QR cá nhân`}
                  title={t`QR cá nhân`}
                >
                  <IconQrCode className="h-4 w-4 mr-1.5" />
                  QR
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="destructive-outline"
                  size="sm"
                  data-testid="delete-person-button"
                  className="min-w-0 flex-1 px-2 hover:bg-destructive/10 sm:w-[100px] sm:flex-none"
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: t`Xoá ${person.full_name}?`,
                      description: t`Có thể khôi phục từ nhật ký.`,
                      confirmLabel: t`Xoá`,
                      destructive: true,
                    });
                    if (ok) deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                  aria-label={t`Xoá người này`}
                  title={t`Xoá người này`}
                >
                  <IconTrash className="h-4 w-4 mr-1.5" />
                  {deleteMutation.isPending ? t`Đang xoá…` : t`Xoá`}
                </Button>
              )}
            </div>

            <QrCodeModal
              open={qrOpen}
              onClose={() => setQrOpen(false)}
              url={qrUrl}
              loading={qrM.isPending}
              title={`QR · ${person.full_name}`}
              description={t`Quét để mở trang cá nhân (chỉ-đọc). Có thể in lên bia, sổ gia phả, danh thiếp.`}
              onDownloadPdf={async () => {
                try {
                  // Lazy-load @react-pdf/renderer (~1.5MB) on demand
                  // so the initial app payload doesn't carry it.
                  const { downloadSinglePersonQrPdf } =
                    await import("@/lib/pdf/exportPersonQrPdf");
                  await downloadSinglePersonQrPdf(clan.name, {
                    clanId: clan.id,
                    personId: person.id,
                    fullName: person.full_name,
                    courtesyName: person.courtesy_name,
                    // generation = display value (đã trừ offset),
                    // PDF chỉ in lại như-là.
                    generation:
                      person.generation !== null
                        ? person.generation - clan.generation_offset
                        : null,
                    birthYear: person.birth_date?.slice(0, 4) ?? null,
                    deathYear: person.death_date?.slice(0, 4) ?? null,
                    isLiving: person.is_living,
                  });
                  toast.success(t`Đã tải PDF danh thiếp`);
                } catch (e) {
                  toast.error(t`Không tạo được PDF`, {
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
                  title={t`Thêm cha / mẹ`}
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
                  title={t`Thêm vợ / chồng`}
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
                  title={t`Thêm con`}
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
    </EmbeddedPersonContext.Provider>
  );
}

/** Link tới người thân: trong ngăn kéo thì đổi sang chi tiết người đó (cùng panel), ngoài trang thì chuyển route như cũ. */
function PersonLink({
  personId,
  ...rest
}: ComponentProps<typeof Link> & { personId: string }) {
  const embedded = useContext(EmbeddedPersonContext);
  if (embedded)
    return (
      <PanelLink
        {...rest}
        panel="person-view"
        panelParams={{ pid: personId }}
      />
    );
  return <Link {...rest} />;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === false
  ) {
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
  historical = false,
}: {
  label: string;
  lunarYear: number | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  fallbackSolar: string | null;
  /** Dòng họ lịch sử: ngày trước 1800 không hiện can chi ngày/tháng — tính bằng
   *  thuật toán hiện đại có thể khác lịch thời đó (sử cũ chép can chi ngày
   *  riêng); can chi năm đã có trong dòng chính. */
  historical?: boolean;
}) {
  let lunar: {
    year: number;
    month: number;
    day: number;
    isLeap: boolean;
  } | null = null;
  if (lunarYear && lunarMonth && lunarDay) {
    lunar = {
      year: lunarYear,
      month: lunarMonth,
      day: lunarDay,
      isLeap: false,
    };
  } else if (fallbackSolar) {
    lunar = solarStringToLunar(fallbackSolar);
  }
  const text = formatLunarDate(lunar);
  if (!text) return <DetailRow label={label} value={null} />;

  // Resolve the matching solar date so we can compute the day Can Chi.
  const solarForCanChi =
    fallbackSolar ?? (lunar ? lunarToSolarString(lunar) : null);
  const canChi =
    historical && lunar && lunar.year < 1800
      ? null
      : getCanChiForSolarDate(solarForCanChi);

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
    queryFn: () => listLinksForPerson(personId, undefined, "all"),
    enabled: !!userId && !!personId,
  });
  if (!links || links.length === 0) return null;
  const onlyInlaw = links.every((l) => l.link_type === "same_person");
  return (
    <CollapsibleCard
      title={
        <>
          <IconLink className="h-5 w-5" />
          {onlyInlaw ? t`Liên kết thông gia` : t`Liên kết dòng họ`}
        </>
      }
      titleClassName="inline-flex items-center gap-2"
      contentClassName="space-y-3"
    >
      {links.map((l) => (
        <InLawLinkRow
          key={l.id}
          link={l}
          userId={userId}
          viewingClanId={viewingClanId}
        />
      ))}
    </CollapsibleCard>
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
    return <p className="text-sm text-muted-foreground">{t`Đang tải…`}</p>;
  }
  if (!peek) return null;
  // Build meta string once so the JSX stays readable.
  const metaBits: string[] = [peek.clan_name];
  if (!peek.masked) {
    if (peek.gender) metaBits.push(peek.gender === "M" ? t`Nam` : t`Nữ`);
    if (peek.generation !== null && peek.generation !== undefined) {
      metaBits.push(t`Đời ${peek.generation - (peek.generation_offset ?? 0)}`);
    }
    if (peek.birth_year && peek.death_year) {
      metaBits.push(`${peek.birth_year}–${peek.death_year}`);
    } else if (peek.birth_year) {
      metaBits.push(t`sinh ${peek.birth_year}`);
    } else if (peek.death_year) {
      metaBits.push(t`mất ${peek.death_year}`);
    }
  }

  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      {/* Identity row — full width, no horizontal squeeze from buttons. */}
      <div className="min-w-0">
        {link.link_type !== "same_person" && (
          <p className="mb-1">
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              {linkTypeFromSide(
                link.link_type,
                link.clan_a_id === viewingClanId,
              )}
            </span>
          </p>
        )}
        <p className="font-medium text-sm truncate">
          {peek.masked ? t`Người còn sống` : (peek.full_name ?? "—")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          <span className="text-foreground">{metaBits[0]}</span>
          {metaBits.slice(1).map((bit) => (
            <span key={bit}> · {bit}</span>
          ))}
        </p>
        {peek.masked && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t`Họ này chưa công khai thông tin người sống.`}
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
              <IconUser className="h-4 w-4 mr-1.5" />
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
          {expanded ? (
            <>
              <IconChevronUp className="h-4 w-4 mr-1.5" />
              {t`Thu gọn`}
            </>
          ) : (
            <>
              <IconUsers className="h-4 w-4 mr-1.5" />
              {t`Gia đình bên đó`}
            </>
          )}
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
    missing.push(t`năm sinh`);
  }
  if (!person.is_living) {
    const hasDeath =
      !!person.death_date ||
      !!person.death_lunar_year ||
      !!person.death_anniv_lunar_month;
    if (!hasDeath) missing.push(t`năm mất/giỗ`);
  }
  if (!person.is_root && parentsCount === 0) {
    missing.push(t`cha/mẹ`);
  }
  if (!person.photo_path) missing.push(t`ảnh`);

  if (missing.length === 0) return null;

  return (
    <Link
      to={editHref}
      className="block rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
    >
      <span className="text-muted-foreground">Hồ sơ này còn thiếu: </span>
      <span>{missing.join(" · ")}</span>
      <span className="text-primary ml-1.5">{t`→ Sửa`}</span>
    </Link>
  );
}

/**
 * Bài bảng tin đính kèm người này — cáo phó (`type='death'`), tin sinh
 * (`type='birth'`), hoặc bất kỳ post nào set `person_id`. Chỉ
 * `published`. Ẩn khi không có gì để khỏi tạo card rỗng.
 */
function RelatedPostsSection({
  personId,
  clanId,
}: {
  personId: string;
  clanId: string;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.clanPostsForPerson(personId),
    queryFn: () => listPostsForPerson(personId),
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  return (
    <CollapsibleCard
      title={
        <>
          <IconBell className="h-5 w-5" />
          {t`Tin liên quan`}
        </>
      }
      titleClassName="inline-flex items-center gap-2 text-base"
    >
      <ul className="space-y-3">
        {data.map((p) => (
          <li
            key={p.id}
            className="border-l-2 border-primary/40 pl-3 space-y-1"
          >
            <Link
              to={`/clans/${clanId}/board`}
              className="font-medium hover:underline block"
            >
              {p.title ?? (p.type === "death" ? t`Cáo phó` : t`Tin`)}
            </Link>
            <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-line">
              {p.body}
            </p>
            <time
              className="text-xs text-muted-foreground tabular-nums"
              dateTime={p.created_at}
            >
              {new Date(p.created_at).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </time>
          </li>
        ))}
      </ul>
    </CollapsibleCard>
  );
}

export type { PersonDetailT };
