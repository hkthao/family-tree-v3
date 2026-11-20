import { currentIntlTag } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { HomeCustomizeDrawer } from "@/components/HomeCustomizeDrawer";
import { NextStepCard } from "@/components/NextStepCard";
import { OverviewSearch } from "@/components/OverviewSearch";
import {
  QuickActionsCard,
  useQuickEntries,
} from "@/components/QuickActionsCard";
import { useHomePrefs } from "@/hooks/useHomePrefs";
import { PodcastTodayCard } from "@/components/PodcastTodayCard";
import { upcomingFestivals } from "@/lib/festivals";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  IconCheck,
  IconSettings,
  IconHome,
  IconLink,
  IconPencil,
  IconSliders,
  IconTree,
} from "@/components/icons";
import { ClanStatsPanel } from "@/components/ClanStatsPanel";
import {
  CommunityCard,
  useCommunitySummary,
} from "@/components/community/CommunityCard";
import { recordMemberVisit } from "@/lib/queries/community";
import { MyProfileCard } from "@/components/MyProfileCard";
import { FamilyPhotoCard } from "@/components/mosaic/FamilyPhotoCard";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { EnablePushPrompt } from "@/components/EnablePushPrompt";
import { MapOverviewCard } from "@/components/MapOverviewCard";
import { RecentActivityPanel } from "@/components/RecentActivityPanel";
import { TodayHubCard } from "@/components/TodayHubCard";
import { RefreshButton } from "@/components/RefreshButton";
import { Button } from "@/components/ui/button";
import { VideoEmptyState } from "@/components/VideoEmptyState";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureEnabled, type ClanFeatureKey } from "@/lib/clanFeatures";
import {
  canEditClan,
  effectiveRole,
  isClanAdmin,
  useClanContext,
} from "@/hooks/useClanContext";
import { getClanContentCounts, getClanStats } from "@/lib/queries/clan-stats";
import { getClansInlawLinks } from "@/lib/queries/clans";
import {
  getClansLinkedClans,
  LINKED_CLAN_RELATION_LABEL,
} from "@/lib/queries/person-links";
import { listAnniversaryCandidates, listEvents } from "@/lib/queries/events";
import {
  getClanCompletion,
  getClanTodoSummary,
  type ClanCompletion,
  type TodoCategory,
  type TodoSummaryRow,
} from "@/lib/queries/todo";
import { track } from "@/lib/analytics";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
export default function Dashboard() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const { show } = useHomePrefs();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // Todo + completion RPCs are member-only (they raise 42501 for
  // anyone not in clan_members). Skip the queries entirely for
  // non-member visitors of a public clan — they shouldn't see the
  // progress tile anyway, and the 403s pollute the console.
  const isMember = effectiveRole(clan) !== null;
  const quick = useQuickEntries(clan, canEdit, isMember);
  const [searchParams, setSearchParams] = useSearchParams();
  const showWelcome = searchParams.get("welcome") === "1" && isMember;
  function dismissWelcome() {
    const n = new URLSearchParams(searchParams);
    n.delete("welcome");
    setSearchParams(n, { replace: true });
  }

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.clanStats(clan.id, userId),
    queryFn: () => getClanStats(clan.id),
    enabled: !!userId,
  });
  // Số phòng ký ức / mộ phần / di sản — member-only (RLS trả 0 cho người ngoài).
  const { data: contentCounts } = useQuery({
    queryKey: ["clan-content-counts", clan.id, userId],
    queryFn: () => getClanContentCounts(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });
  // Ký ức cộng đồng: hàng số trong thẻ Số liệu + thẻ "Đóng góp mới" (gia phả lịch sử không có).
  const communityOn = isMember && clan.kind !== "historical";
  const { data: community } = useCommunitySummary(clan.id, !!userId && communityOn);
  useEffect(() => {
    if (!userId || !isMember) return;
    // Server bỏ qua admin dòng họ / admin hệ thống; client chỉ gọi 1 lần / ngày.
    recordMemberVisit(clan.id).catch(() => {
      /* đếm lượt không quan trọng bằng trang */
    });
  }, [clan.id, userId, isMember]);
  // Non-members of a public clan need the masked view; raw `persons`
  // RLS would return zero rows for them. Same pattern as /tree.
  const treeSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId, treeSource),
    queryFn: () => getTreeData(clan.id, treeSource),
    enabled: !!userId,
  });
  const { data: events } = useQuery({
    queryKey: queryKeys.events(clan.id, userId),
    queryFn: () => listEvents(clan.id),
    enabled: !!userId,
  });
  const { data: anniversaries } = useQuery({
    queryKey: [
      ...queryKeys.anniversaries(clan.id, userId),
      treeSource,
    ] as const,
    queryFn: () => listAnniversaryCandidates(clan.id, undefined, treeSource),
    enabled: !!userId,
  });
  const { data: completion } = useQuery({
    queryKey: queryKeys.clanCompletion(clan.id, userId),
    queryFn: () => getClanCompletion(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });
  const { data: todoSummary } = useQuery({
    queryKey: queryKeys.clanTodoSummary(clan.id, userId),
    queryFn: () => getClanTodoSummary(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });
  const { data: inlawMap } = useQuery({
    queryKey: ["clan-inlaw-links", [clan.id]],
    queryFn: () => getClansInlawLinks([clan.id]),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
  const inlaws = inlawMap?.get(clan.id) ?? [];
  const { data: linkedMap } = useQuery({
    queryKey: ["clan-linked-clans", clan.id],
    queryFn: () => getClansLinkedClans([clan.id]),
    staleTime: 5 * 60 * 1000,
  });
  const linked = linkedMap?.get(clan.id) ?? [];

  // Sự kiện 30 ngày tới cho thẻ "Hôm nay". Lễ tết ghép ở TẦNG HIỂN THỊ (không nằm trong computeUpcomingEvents —
  // hàm đó là nguồn cho cron gửi mail, mà không ai đăng ký nhận thư nhắc Trung Thu).
  const cardEvents: UpcomingEvent[] = useMemo(() => {
    if (!tree || !events || !anniversaries) return [];
    const today = new Date();
    const a = computeUpcomingEvents({
      today,
      daysAhead: 30,
      persons: tree.persons,
      events,
    });
    const b = computeUpcomingAnniversaries({
      today,
      daysAhead: 30,
      anniversaries,
      generationOffset: clan.generation_offset,
    });
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return [...a, ...b, ...upcomingFestivals(iso, 30)].sort(
      (x, y) =>
        x.daysUntil - y.daysUntil || x.title.localeCompare(y.title, "vi"),
    );
  }, [tree, events, anniversaries, clan.generation_offset]);
  const nextStepInput = useMemo(
    () => ({
      persons: tree?.persons ?? [],
      todo: todoSummary,
      counts: contentCounts,
      customEvents: events?.length,
      canEdit,
      isEnabled: (k: ClanFeatureKey) =>
        isFeatureEnabled(clan.disabled_features, k),
      // Giỗ / sự kiện của họ trong 7 ngày tới (không tính lễ tết chung): có thì gợi ý lịch & chia sẻ được nâng lên.
      soonEvents: cardEvents.filter(
        (e) => e.daysUntil <= 7 && e.kind !== "festival",
      ).length,
    }),
    [
      tree,
      todoSummary,
      contentCounts,
      events,
      canEdit,
      clan.disabled_features,
      cardEvents,
    ],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<IconHome className="h-7 w-7" />}
        title={t`Tổng quan`}
        description={t`Trang chủ của ${clan.name}.`}
        actionsBelow="mobile"
        // Tuỳ chỉnh / sửa / cài đặt / liên kết / làm mới nay là ô CÓ CHỮ trong thẻ Thao tác nhanh (dễ dùng với người lớn
        // tuổi, người mới). Chỉ khi người dùng ẩn thẻ đó mới giữ hàng nút icon ở đây làm lối vào dự phòng.
        actions={
          show("quick") ? undefined : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCustomizeOpen(true)}
                aria-label={t`Tuỳ chỉnh trang chủ`}
                title={t`Tuỳ chỉnh trang chủ`}
                data-testid="dashboard-customize"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground hover:border-primary hover:text-primary"
              >
                <IconSliders className="h-4 w-4" />
              </button>
              {/* Lối tắt tới Cài đặt dòng họ — chỉ quản trị mới thấy (trang đó chỉ
                quản trị vào được), khỏi phải mở menu trái. */}
              {isClanAdmin(clan) &&
                isFeatureEnabled(clan.disabled_features, "inlaws") && (
                  <Link
                    to={`/clans/${clan.id}/inlaws`}
                    aria-label={t`Liên kết dòng họ`}
                    title={t`Liên kết dòng họ`}
                    data-testid="dashboard-inlaws-link"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <IconLink className="h-4 w-4" />
                  </Link>
                )}
              {canEditClan(clan) && (
                <Link
                  to={`/clans/${clan.id}/so-gia-pha`}
                  aria-label={t`Chỉnh sửa thông tin dòng họ`}
                  title={t`Chỉnh sửa thông tin dòng họ`}
                  data-testid="dashboard-edit-clan-link"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <IconPencil className="h-4 w-4" />
                </Link>
              )}
              {isClanAdmin(clan) && (
                <Link
                  to={`/clans/${clan.id}/settings`}
                  aria-label={t`Cài đặt dòng họ`}
                  title={t`Cài đặt dòng họ`}
                  data-testid="dashboard-settings-link"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <IconSettings className="h-4 w-4" />
                </Link>
              )}
              <RefreshButton
                clanId={clan.id}
                cachedVersion={clan.data_version}
                compact
              />
            </div>
          )
        }
      />

      {/* Ô tìm người ở ĐẦU trang: tìm người là thao tác dùng nhiều thứ hai của app. */}
      {tree &&
        tree.persons.length > 0 &&
        (isMember || clan.public_show_tree) && (
          <OverviewSearch clanId={clan.id} />
        )}

      {showWelcome && (
        <section
          aria-label={t`Chào mừng`}
          className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
        >
          <div>
            <p className="font-semibold">
              <Trans>Chào mừng bạn đến với dòng họ {clan.name}! 🎉</Trans>
            </p>
            <p className="text-sm text-muted-foreground">
              <Trans>
                <Trans>
                  <Trans>
                    Hai bước để cùng vun đắp gia phả: cho biết bạn là ai trong
                    cây, rồi bổ sung người thân của mình.
                  </Trans>
                </Trans>
              </Trans>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link
                to={`/clans/${clan.id}/tree?view=lineage`}
                onClick={() => {
                  track("onboarding_lineage_click");
                  dismissWelcome();
                }}
              >
                <IconTree className="h-4 w-4 mr-1.5" />
                {t`Tôi là ai trong cây?`}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={dismissWelcome}>
              {t`Để sau`}
            </Button>
          </div>
        </section>
      )}

      {clan.description && <ClanDescription text={clan.description} />}

      {inlaws.length > 0 && (
        <section className="rounded-xl border bg-card shadow-sm p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <IconLink className="h-4 w-4 text-primary" />
            {t`Đã kết thông gia với ${inlaws.length} dòng họ`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {inlaws.map((c) => (
              <Link
                key={c.clan_id}
                to={`/clans/${c.clan_id}`}
                className="inline-flex items-center rounded-full border bg-muted/40 px-3 py-1 text-sm hover:border-primary transition-colors"
              >
                {c.clan_name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {linked.length > 0 && (
        <section className="rounded-xl border bg-card shadow-sm p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <IconLink className="h-4 w-4 text-primary" />
            {t`Liên kết với ${linked.length} dòng họ khác`}
          </h2>
          <div className="flex flex-wrap gap-2">
            {linked.map((c) => (
              <Link
                key={`${c.linked_clan_id}-${c.relation}`}
                to={`/clans/${c.linked_clan_id}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm hover:border-primary transition-colors"
              >
                <span className="text-xs text-muted-foreground">
                  {LINKED_CLAN_RELATION_LABEL[c.relation]}
                </span>
                {c.linked_clan_name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Gợi ý "Bước tiếp theo" (một việc / một tính năng, xáo ngẫu nhiên) nằm TRÊN thẻ Hôm nay. */}
      {tree && tree.persons.length > 0 && isMember && show("nextstep") && (
        <NextStepCard clanId={clan.id} input={nextStepInput} />
      )}

      {/* Thẻ "Hôm nay" — GỘP trang Hôm nay cũ, đặt ngay dưới phần tiêu đề, mô tả và gợi ý: lịch
          âm/ngày tốt xấu, giỗ & sinh nhật & lễ tết hôm nay / 7 ngày / 30 ngày. Đổi mỗi ngày → lý do mở app hằng ngày. */}
      {tree && tree.persons.length > 0 && show("today") && (
        <TodayHubCard clanId={clan.id} events={cardEvents} />
      )}

      {/* "Đóng góp mới" — ký ức / đóng góp cộng đồng, dưới gợi ý + Hôm nay (giữ đầu trang như cũ) (docs/plan-dong-gop-cong-dong.md). */}
      {tree &&
        tree.persons.length > 0 &&
        communityOn &&
        show("community") && (
          <CommunityCard clanId={clan.id} canModerate={canEdit} />
        )}

      {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}

      {/* Empty-state check uses the tree query (which goes through the
          masked view for non-members of public clans) — `stats` runs
          as security_invoker so it'd return 0 for non-members even
          when the clan has people, producing a misleading "no one in
          this clan yet" message on real, populated public clans. */}
      {tree && tree.persons.length === 0 ? (
        canEdit ? (
          <VideoEmptyState
            videoId="them-thuy-to"
            title={t`Chưa có ai trong dòng họ`}
            description={t`Bắt đầu bằng cách thêm Thuỷ tổ. Xem video 1 phút bên dưới rồi vào trang Thêm người.`}
            ctaLabel={t`Thêm Thuỷ tổ`}
            ctaTo={`/clans/${clan.id}/people/new`}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t`Chưa có ai trong dòng họ`}</CardTitle>
              <CardDescription>
                {t`Quản trị/biên tập viên sẽ thêm thành viên trước.`}
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : tree && tree.persons.length > 0 ? (
        <>
          {/* Lời mời bật thông báo — mở khoá mọi nhắc nhở (giỗ/sinh nhật/sự
              kiện). Tự ẩn khi đã bật hoặc người dùng bỏ qua. */}
          {isMember && <EnablePushPrompt />}

          {/* Số liệu dòng họ — chỉ số chính + biểu đồ cơ cấu; kho tư liệu: hàng nút nhỏ bấm được. */}
          {show("stats") &&
            (() => {
              const useStatsRpc = isMember && stats && stats.total_persons > 0;
              const counts = useStatsRpc
                ? {
                    total: stats!.total_persons,
                    maxGen: stats!.max_generation,
                    males: stats!.males,
                    females: stats!.females,
                    living: stats!.living,
                    deceased: stats!.deceased,
                  }
                : {
                    total: tree.persons.length,
                    maxGen: tree.persons.reduce<number | null>(
                      (m, p) =>
                        p.generation == null
                          ? m
                          : m == null || p.generation > m
                            ? p.generation
                            : m,
                      null,
                    ),
                    males: tree.persons.filter((p) => p.gender === "M").length,
                    females: tree.persons.filter((p) => p.gender === "F")
                      .length,
                    living: tree.persons.filter((p) => p.is_living).length,
                    deceased: tree.persons.filter((p) => !p.is_living).length,
                  };
              return (
                <ClanStatsPanel counts={counts} persons={tree.persons}>
                  {isMember && contentCounts && (
                    <div className="grid grid-cols-3 gap-2 border-t pt-4">
                      <ResourceLink
                        to={`/clans/${clan.id}/memory-room`}
                        label={t`Phòng ký ức`}
                        value={contentCounts.memory_rooms}
                      />
                      <ResourceLink
                        to={`/clans/${clan.id}/graves`}
                        label={t`Mộ phần & tro cốt`}
                        value={contentCounts.resting_places}
                      />
                      <ResourceLink
                        to={`/clans/${clan.id}/heritage`}
                        label={t`Di sản văn hoá`}
                        value={contentCounts.heritage_items}
                      />
                    </div>
                  )}
                  {communityOn && community && (
                    <div className="grid grid-cols-3 gap-2 border-t pt-4">
                      <ResourceLink
                        to={`/clans/${clan.id}/dong-gop`}
                        label={t`Lượt ghé tuần này`}
                        value={community.visits_week}
                      />
                      <ResourceLink
                        to={`/clans/${clan.id}/dong-gop`}
                        label={t`Người góp tuần này`}
                        value={community.contributors_week}
                      />
                      <ResourceLink
                        to={`/clans/${clan.id}/dong-gop`}
                        label={t`Đóng góp mới`}
                        value={community.memories_week}
                      />
                    </div>
                  )}
                </ClanStatsPanel>
              );
            })()}

          {/* Bản đồ dòng họ: nơi ở của con cháu, mộ phần, di sản theo tỉnh — ngay dưới số liệu. */}
          {isMember && show("map") && <MapOverviewCard clanId={clan.id} />}

          {/* Thao tác nhanh — tối đa 12 ô, người dùng tự ghim / tự học theo lượt bấm (xem QuickActionsCard). */}
          {show("quick") && (
            <QuickActionsCard
              clan={clan}
              canEdit={canEdit}
              isMember={isMember}
              onCustomize={() => setCustomizeOpen(true)}
            />
          )}

          {/* Hồ sơ của tôi: nhận vị trí trên cây + tự cập nhật (quản trị duyệt). */}
          {isMember && userId && show("profile") && (
            <MyProfileCard
              clanId={clan.id}
              userId={userId}
              persons={tree?.persons}
            />
          )}

          {/* Ảnh gia đình: bức ảnh ghép mới nhất của họ. */}
          {isMember &&
            userId &&
            show("photos") &&
            isFeatureEnabled(clan.disabled_features, "mosaic") && (
              <FamilyPhotoCard clanId={clan.id} userId={userId} />
            )}

          {/* Tiến độ hoàn thiện — nhắc bổ sung thông tin. */}
          {completion && completion.total > 0 && show("completion") && (
            <CompletionTile
              clanId={clan.id}
              completion={completion}
              summary={todoSummary ?? []}
            />
          )}

          {show("podcast") && <PodcastTodayCard />}

          {effectiveRole(clan) !== null && show("activity") && (
            <RecentActivityPanel clanId={clan.id} />
          )}
        </>
      ) : null}

      <HomeCustomizeDrawer
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        catalog={quick.catalog}
        shown={quick.shown}
        pinned={quick.pinned}
      />
    </div>
  );
}

/** Ô kho tư liệu bấm được (nhỏ gọn): số + nhãn, trong thẻ thống kê. */
function ResourceLink({
  to,
  label,
  value,
}: {
  to: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center rounded-md border bg-muted/20 px-2 py-2 text-center hover:border-primary hover:bg-muted/40 transition-colors"
    >
      <span className="text-lg font-semibold tabular-nums leading-none">
        {value}
      </span>
      <span className="mt-1 text-xs text-muted-foreground leading-tight">
        {label}
      </span>
    </Link>
  );
}

/**
 * Clan description block. Long family histories (multi-paragraph)
 * push the rest of the dashboard below the fold on mobile, so we
 * clamp to ~3 lines + a "Xem thêm" toggle. Desktop (sm+) shows
 * the whole text — there's plenty of vertical room.
 */
function ClanDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <p
        className={`text-muted-foreground whitespace-pre-line ${
          expanded ? "" : "line-clamp-3 sm:line-clamp-none"
        }`}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="mt-1 text-sm text-primary hover:underline sm:hidden"
      >
        {expanded ? t`Thu gọn` : t`Xem thêm`}
      </button>
    </div>
  );
}

// Short hint surfaced after the percentage — "Còn 12 người thiếu
// năm sinh →". Phrasing is intentionally inclusive ("còn") not
// accusatory ("bạn còn thiếu"). Picks the single biggest gap; the
// /todo page handles the rest.
const CATEGORY_CTA: Record<TodoCategory, string> = lazyMessages({
  missing_parents: msg`thiếu cha/mẹ`,
  missing_dates: msg`thiếu năm sinh/mất`,
  dead_end: msg`có thể còn thiếu con`,
  missing_media: msg`thiếu ảnh / âm lịch`,
}) as Record<TodoCategory, string>;

function CompletionTile({
  clanId,
  completion,
  summary,
}: {
  clanId: string;
  completion: ClanCompletion;
  summary: TodoSummaryRow[];
}) {
  const { percent, complete, total } = completion;
  if (percent === null) return null;
  const tone =
    percent >= 90
      ? "bg-emerald-500"
      : percent >= 50
        ? "bg-primary"
        : "bg-amber-500";

  // Largest open gap → headline CTA. Skip soft categories when a
  // hard one exists so we don't say "thiếu ảnh" while parents are
  // still missing.
  const HARD_ORDER: TodoCategory[] = ["missing_parents", "missing_dates"];
  const counts = new Map<TodoCategory, number>(
    summary.map((r) => [r.category, r.count]),
  );
  const top =
    HARD_ORDER.map((c) => ({ category: c, count: counts.get(c) ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)[0] ??
    [...summary].sort((a, b) => b.count - a.count).find((r) => r.count > 0);

  return (
    <SectionCard
      id="completion"
      icon={<IconCheck />}
      title={t`Tiến độ hoàn thiện`}
    >
      <Link
        to={`/clans/${clanId}/todo`}
        aria-label={t`Mở trang Việc cần làm để bổ sung thông tin`}
        className="block space-y-3 rounded-md hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="font-medium">{t`Họ ta đã hoàn thành`}</h3>
          <span className="text-2xl sm:text-3xl font-semibold tabular-nums">
            {percent}%
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full ${tone} transition-[width] duration-500`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm">
          {top ? (
            <>
              <span className="text-muted-foreground">
                <Trans>
                  Còn <span className="tabular-nums">{top.count}</span> người{" "}
                  {CATEGORY_CTA[top.category]}
                </Trans>
              </span>
              <span className="text-primary"> →</span>
            </>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              <Trans>
                {complete.toLocaleString(currentIntlTag())} /{" "}
                {total.toLocaleString(currentIntlTag())} người đã đủ thông tin.
              </Trans>
            </span>
          )}
        </p>
      </Link>
    </SectionCard>
  );
}
