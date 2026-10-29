import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import {
  IconBuildings,
  IconGrid,
  IconLink,
  IconList,
  IconPlus,
  IconSearch,
  IconTree,
  IconUsers,
} from "@/components/icons";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { ClanBadges } from "@/components/ClanBadges";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { HistoricalClansSection } from "@/components/HistoricalClansSection";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { RecordDates } from "@/components/RecordDates";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUrlPatch } from "@/hooks/useUrlState";
import {
  CLAN_SIZE_BUCKETS,
  CLAN_SORT_LABEL,
  getClansInlawLinks,
  getClansLeaderboardStats,
  listCommunityClans,
  listMyClans,
  type ClanLeaderboardStat,
  type ClanSizeBucket,
  type ClanSort,
  type ClanSummary,
  type InlawLinkedClan,
} from "@/lib/queries/clans";
import {
  getClansLinkedClans,
  LINKED_CLAN_RELATION_LABEL,
  type LinkedClan,
} from "@/lib/queries/person-links";
import { listHistoricalClans } from "@/lib/queries/historical";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

const PAGE_SIZE = 15;
type Tab = "mine" | "community" | "historical";

export default function Clans() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const isPlatformAdmin = !!profile?.is_platform_admin;

  // Filters live in the URL so Back from a clan detail restores the
  // tab + search instead of resetting them. See useUrlState.ts.
  const [sp] = useSearchParams();
  const patch = useUrlPatch();
  const rawTab = sp.get("tab");
  const tab: Tab = rawTab === "community" || rawTab === "historical" ? rawTab : "mine";
  const sizeBucket = (sp.get("size") ?? "") as ClanSizeBucket | "";
  const rawSort = sp.get("sort");
  const sort: ClanSort =
    rawSort === "name" || rawSort === "newest" ? rawSort : "members";
  const debounced = sp.get("q") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const view: "list" | "grid" = sp.get("view") === "grid" ? "grid" : "list";

  // The text box keeps its own live value (seeded from the URL); only
  // the debounced value is pushed to the URL + used for the query.
  const [search, setSearch] = useState(debounced);

  const setTab = (next: Tab) =>
    patch({ tab: next === "mine" ? null : next, page: null });
  const setSizeBucket = (next: ClanSizeBucket | "") =>
    patch({ size: next || null, page: null });
  const setSort = (next: ClanSort) =>
    patch({ sort: next === "members" ? null : next, page: null });
  const setPage = (next: number) =>
    patch({ page: next <= 1 ? null : String(next) });
  const setView = (next: "list" | "grid") =>
    patch({ view: next === "list" ? null : "grid" });

  useEffect(() => {
    const h = setTimeout(() => {
      // Skip the initial run (search === URL value) so a Back that
      // restored ?page=2 isn't immediately reset to page 1.
      if (search !== debounced) patch({ q: search || null, page: null });
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    search: debounced,
    // Size filter only applies to the community tab; keep "Của tôi"
    // unfiltered so the user can always find clans they joined.
    sizeBucket: tab === "community" && sizeBucket ? sizeBucket : null,
    sort,
  };

  const mineQ = useQuery({
    queryKey: queryKeys.myClans(userId, params),
    queryFn: () => listMyClans(userId, params),
    enabled: !!userId && tab === "mine",
    placeholderData: keepPreviousData,
  });
  const communityQ = useQuery({
    queryKey: queryKeys.communityClans(userId, params),
    queryFn: () => listCommunityClans(userId, params),
    enabled: !!userId && tab === "community",
    placeholderData: keepPreviousData,
  });

  // Count fetch for the inactive tab (so the tab label always carries
  // an accurate total — a single 1-row request per refocus).
  const mineCount = useQuery({
    queryKey: queryKeys.myClans(userId, { ...params, page: 1, _count: true }),
    queryFn: () => listMyClans(userId, { ...params, page: 1, pageSize: 1 }),
    enabled: !!userId,
  });
  const communityCount = useQuery({
    queryKey: queryKeys.communityClans(userId, {
      ...params,
      page: 1,
      _count: true,
    }),
    queryFn: () =>
      listCommunityClans(userId, { ...params, page: 1, pageSize: 1 }),
    enabled: !!userId,
  });

  // Tab "Gia phả lịch sử" có danh sách riêng (HistoricalClansSection) — không
  // dùng kết quả (kể cả placeholder giữ lại) của hai tab kia.
  const historicalQ = useQuery({
    queryKey: ["historical-clans"],
    queryFn: () => listHistoricalClans(),
    staleTime: 10 * 60 * 1000,
  });
  const active = tab === "mine" ? mineQ : communityQ;
  const data = tab === "historical" ? undefined : active.data;
  const isLoading = tab !== "historical" && active.isLoading;
  const error = tab === "historical" ? null : active.error;

  // Số liệu huy hiệu chất lượng cho các dòng họ đang hiển thị (1 round-trip).
  const rowIds = (data?.rows ?? []).map((r) => r.id);
  const { data: statsMap } = useQuery({
    queryKey: ["clan-leaderboard-stats", rowIds],
    queryFn: () => getClansLeaderboardStats(rowIds),
    enabled: rowIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  // Dòng họ liên kết qua thành viên theo loại khác (họ tổ / họ hậu duệ / họ hàng).
  const { data: linkedMap } = useQuery({
    queryKey: ["clan-linked-clans", rowIds],
    queryFn: () => getClansLinkedClans(rowIds),
    enabled: rowIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  // Dòng họ đã kết thông gia (để hiện "Thông gia: …").
  const { data: inlawMap } = useQuery({
    queryKey: ["clan-inlaw-links", rowIds],
    queryFn: () => getClansInlawLinks(rowIds),
    enabled: rowIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Huy chương thứ hạng chỉ có nghĩa khi đang xếp theo số thành viên ở tab
  // Cộng đồng (bảng "ganh đua" toàn nền tảng). Tab "Của tôi" / sắp theo
  // tên-mới-tạo thì không gắn medal (gây hiểu nhầm).
  const showMedals = tab === "community" && sort === "members";
  const rankBase = (page - 1) * PAGE_SIZE;

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <PageHeader
          icon={<IconBuildings className="h-7 w-7" />}
          title={isPlatformAdmin ? "Tất cả dòng họ" : "Dòng họ"}
          description={
            isPlatformAdmin
              ? "Mọi dòng họ trên nền tảng."
              : "Dòng họ bạn tham gia hoặc theo dõi."
          }
        />

        {/* Tabs left + create-clan CTA right on the same row. Tabs
            already eat ~230 px with the count badges, so the CTA
            collapses to icon + "Tạo" on mobile and expands to
            "Tạo dòng họ" on sm+ to keep both on one line at every
            viewport width. */}
        <div className="flex items-center gap-2">
          <div
            className="inline-flex min-w-0 overflow-x-auto rounded-md border bg-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            <TabButton
              active={tab === "mine"}
              onClick={() => setTab("mine")}
              label={<>Của tôi{tabCount(mineCount.data?.total)}</>}
            />
            <TabButton
              active={tab === "community"}
              onClick={() => setTab("community")}
              label={<>Cộng đồng{tabCount(communityCount.data?.total)}</>}
            />
            {historicalQ.data && historicalQ.data.length > 0 && (
              <TabButton
                active={tab === "historical"}
                onClick={() => setTab("historical")}
                label={
                  <>
                    <span className="sm:hidden">Lịch sử</span>
                    <span className="hidden sm:inline">Gia phả lịch sử</span>
                    {tabCount(historicalQ.data.length)}
                  </>
                }
              />
            )}
          </div>
          <Button asChild size="sm" className="h-10 ml-auto shrink-0">
            <Link to="/clans/new" data-testid="create-clan-link">
              <IconPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Tạo dòng họ</span>
            </Link>
          </Button>
        </div>

        {/* Filter row — single line on sm+. No external labels; the
            search icon + placeholder, and the dropdown's own default
            label, carry the meaning. h-10 is denser than the default
            h-12 since we're not the primary tap target on this page. */}
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          <div className="sm:flex-1 sm:min-w-[200px]">
            <SearchInput
              label="Tìm dòng họ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm dòng họ (gõ không dấu được)"
            />
          </div>
          {/* Sắp xếp + quy mô + kiểu hiển thị. Mobile: thu gọn sau "Bộ lọc". */}
          <CollapsibleFilters
            activeCount={
              (sort !== "members" ? 1 : 0) +
              (tab === "community" && sizeBucket ? 1 : 0)
            }
          >
          {/* Bề ngang các ô chọn: KHÔNG dùng `min-w-*` với `flex-none`.
              Khung bọc của <Select> luôn có `w-full`, nên khi không co
              được (flex-none) mỗi ô đòi 100% bề ngang của hàng → hai ô
              cộng lại tràn khỏi khung. Từ lg mới chốt bề ngang cố định;
              hẹp hơn thì để flex-1 chia đều và co được. */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {tab !== "historical" && (
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as ClanSort)}
                aria-label="Sắp xếp"
                icon={<IconList />}
                className="h-10 min-w-0 flex-1 lg:flex-none lg:w-64 text-sm"
              >
                {(Object.keys(CLAN_SORT_LABEL) as ClanSort[]).map((k) => (
                  <option key={k} value={k}>
                    {CLAN_SORT_LABEL[k]}
                  </option>
                ))}
              </Select>
            )}
            {tab === "community" && (
              <Select
                value={sizeBucket}
                onChange={(e) =>
                  setSizeBucket(e.target.value as ClanSizeBucket | "")
                }
                aria-label="Lọc theo quy mô"
                icon={<IconUsers />}
                className="h-10 min-w-0 flex-1 lg:flex-none lg:w-48 text-sm"
              >
                <option value="">Tất cả quy mô</option>
                {(Object.keys(CLAN_SIZE_BUCKETS) as ClanSizeBucket[]).map((k) => (
                  <option key={k} value={k}>
                    {CLAN_SIZE_BUCKETS[k].label}
                  </option>
                ))}
              </Select>
            )}
            <SegmentedControl ariaLabel="Kiểu hiển thị" className="shrink-0">
              <SegmentedButton
                active={view === "list"}
                onClick={() => setView("list")}
                ariaLabel="Danh sách"
                variant="icon-md"
              >
                <IconList className="h-4 w-4" />
              </SegmentedButton>
              <SegmentedButton
                active={view === "grid"}
                onClick={() => setView("grid")}
                ariaLabel="Lưới"
                variant="icon-md"
              >
                <IconGrid className="h-4 w-4" />
              </SegmentedButton>
            </SegmentedControl>
          </div>
          </CollapsibleFilters>
        </div>

        {tab === "community" && !isPlatformAdmin && (
          <p className="text-xs text-muted-foreground -mt-2">
            Dòng họ công khai bạn chưa tham gia — chỉ xem cây, người còn sống được ẩn.
          </p>
        )}

        {tab === "historical" && <HistoricalClansSection view={view} search={debounced} />}

        {isLoading && <LoadingState />}

        {error && (
          <ErrorState error={error} onRetry={() => active.refetch()} />
        )}

        {data && data.rows.length === 0 && (
          debounced ? (
            <EmptyState
              icon={<IconSearch className="h-10 w-10" />}
              title={`Không có dòng họ nào khớp "${debounced}"`}
              description={
                tab === "mine"
                  ? "Thử bỏ bớt từ khoá hoặc đổi sang tab Cộng đồng."
                  : "Thử bỏ bớt từ khoá. Dòng họ riêng tư không hiện trong tab Cộng đồng."
              }
              primary={{
                label: "Xoá tìm kiếm",
                onClick: () => setSearch(""),
              }}
            />
          ) : tab === "mine" ? (
            <EmptyState
              icon={<IconTree className="h-10 w-10" />}
              title="Bạn chưa tham gia dòng họ nào"
              description="Tạo dòng họ đầu tiên — bạn sẽ là quản trị, có thể mời người thân vào sau. Hoặc duyệt các dòng họ công khai ở tab Cộng đồng."
              primary={{
                label: "Tạo dòng họ",
                to: "/clans/new",
                icon: <IconPlus className="h-4 w-4 mr-1.5" />,
              }}
              secondary={{
                label: "Xem cộng đồng",
                onClick: () => setTab("community"),
                icon: <IconUsers className="h-4 w-4 mr-1.5" />,
              }}
            />
          ) : (
            <EmptyState
              icon={<IconUsers className="h-10 w-10" />}
              title="Chưa có dòng họ công khai để duyệt"
              description="Khi có dòng họ chuyển sang chế độ công khai, họ sẽ xuất hiện ở đây."
            />
          )
        )}

        {data && data.rows.length > 0 && (
          view === "grid" ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.rows.map((c, i) => (
                <ClanCard
                  key={c.id}
                  clan={c}
                  rank={showMedals ? rankBase + i + 1 : undefined}
                  stat={statsMap?.get(c.id)}
                  inlaws={inlawMap?.get(c.id)}
                  linked={linkedMap?.get(c.id)}
                />
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {data.rows.map((c, i) => (
                <ClanRow
                  key={c.id}
                  clan={c}
                  rank={showMedals ? rankBase + i + 1 : undefined}
                  stat={statsMap?.get(c.id)}
                  inlaws={inlawMap?.get(c.id)}
                  linked={linkedMap?.get(c.id)}
                />
              ))}
            </ul>
          )
        )}

        {total > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            unit="dòng họ"
            isFetching={active.isFetching}
            onPageChange={setPage}
          />
        )}
      </main>
    </div>
  );
}

/** Số lượng nhỏ, mờ, trong ngoặc sau nhãn tab. */
function tabCount(n: number | undefined) {
  if (!n) return null;
  return <span className="ml-1 text-xs opacity-70">({n})</span>;
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-3 sm:px-4 h-10 text-sm border-l first:border-l-0 ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
      }`}
    >
      {label}
    </button>
  );
}

/** Dòng "Thông gia: X, Y" — ẩn khi chưa kết thông gia với ai. */
function InlawLine({
  inlaws,
  className,
}: {
  inlaws?: InlawLinkedClan[];
  className: string;
}) {
  if (!inlaws || inlaws.length === 0) return null;
  const names = inlaws.map((c) => c.clan_name).join(", ");
  return (
    <p
      className={className}
      title={`Đã kết thông gia với: ${names}`}
    >
      <IconLink className="inline h-3 w-3 mr-1 -mt-0.5" />
      Thông gia: {names}
    </p>
  );
}

/** Dòng "Họ tổ: X · Họ hậu duệ: Y · Họ hàng: Z" — ẩn khi không có. */
function LinkedLine({ linked, className }: { linked?: LinkedClan[]; className: string }) {
  if (!linked || linked.length === 0) return null;
  const order: LinkedClan["relation"][] = ["descendant_of", "ancestor_of", "related"];
  const parts = order
    .map((rel) => {
      const names = linked.filter((l) => l.relation === rel).map((l) => l.linked_clan_name);
      return names.length ? `${LINKED_CLAN_RELATION_LABEL[rel]}: ${names.join(", ")}` : null;
    })
    .filter(Boolean);
  return (
    <p className={className} title={parts.join(" · ")}>
      <IconLink className="inline h-3 w-3 mr-1 -mt-0.5" />
      {parts.join(" · ")}
    </p>
  );
}

function ClanRow({
  clan,
  rank,
  stat,
  inlaws,
  linked,
}: {
  clan: ClanSummary;
  rank?: number;
  stat?: ClanLeaderboardStat;
  inlaws?: InlawLinkedClan[];
  linked?: LinkedClan[];
}) {
  return (
    <li>
      <Link
        to={`/clans/${clan.id}`}
        className="block rounded-lg border bg-card px-3 py-2.5 sm:px-4 sm:py-3 hover:border-primary transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3 min-w-0">
          <h2 className="clan-name text-lg font-semibold truncate">
            {clan.name}
          </h2>
          <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
            {clan.person_count.toLocaleString("vi-VN")} thành viên
          </span>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-1 sm:line-clamp-2 mt-0.5">
            {clan.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          <span className="sm:hidden">
            {clan.person_count.toLocaleString("vi-VN")} thành viên{" • "}
          </span>
          {clan.role ? (
            <span className="text-foreground">{roleLabel(clan.role)}</span>
          ) : (
            <span>Khách</span>
          )}
          {" • "}
          {clan.visibility === "public" ? "Công khai" : "Riêng tư"}
        </p>
        <ClanDates clan={clan} className="hidden sm:block text-xs text-muted-foreground/80 mt-0.5" />
        <InlawLine
          inlaws={inlaws}
          className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
        />
        <LinkedLine
          linked={linked}
          className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
        />
        {/* Huy hiệu ở dòng cuối, căn lề phải. */}
        <ClanBadges clan={clan} rank={rank} stat={stat} />
      </Link>
    </li>
  );
}

function ClanCard({
  clan,
  rank,
  stat,
  inlaws,
  linked,
}: {
  clan: ClanSummary;
  rank?: number;
  stat?: ClanLeaderboardStat;
  inlaws?: InlawLinkedClan[];
  linked?: LinkedClan[];
}) {
  return (
    <li>
      <Link
        to={`/clans/${clan.id}`}
        className="flex h-full flex-col rounded-lg border bg-card p-3 sm:p-4 hover:border-primary transition-colors"
      >
        <div className="flex items-start gap-2 min-w-0">
          <IconTree className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <h2 className="clan-name text-base font-semibold leading-snug line-clamp-2 min-w-0">
            {clan.name}
          </h2>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-1 sm:line-clamp-2 mt-1.5">
            {clan.description}
          </p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{clan.person_count.toLocaleString("vi-VN")} thành viên</span>
          <span>
            {clan.role ? (
              <span className="text-foreground">{roleLabel(clan.role)}</span>
            ) : (
              "Khách"
            )}
            {" • "}
            {clan.visibility === "public" ? "Công khai" : "Riêng tư"}
          </span>
        </div>
        <ClanDates clan={clan} className="hidden sm:block mt-1 text-xs text-muted-foreground/80" />
        <InlawLine
          inlaws={inlaws}
          className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
        />
        <LinkedLine
          linked={linked}
          className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
        />
        {/* Huy hiệu ở dòng cuối, căn lề phải. */}
        <ClanBadges clan={clan} rank={rank} stat={stat} />
      </Link>
    </li>
  );
}

function roleLabel(role: "admin" | "editor" | "viewer"): string {
  return { admin: "Quản trị", editor: "Biên tập", viewer: "Xem" }[role];
}

/** Dòng "Tạo … • Cập nhật …" — chỉ render phần có ngày hợp lệ. */
function ClanDates({ clan, className }: { clan: ClanSummary; className: string }) {
  return (
    <RecordDates
      createdAt={clan.created_at}
      updatedAt={clan.updated_at}
      className={className}
    />
  );
}

