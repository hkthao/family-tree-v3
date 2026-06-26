import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import {
  IconBuildings,
  IconGrid,
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
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useUrlPatch } from "@/hooks/useUrlState";
import {
  CLAN_SIZE_BUCKETS,
  CLAN_SORT_LABEL,
  listCommunityClans,
  listMyClans,
  type ClanSizeBucket,
  type ClanSort,
  type ClanSummary,
} from "@/lib/queries/clans";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

const PAGE_SIZE = 15;
type Tab = "mine" | "community";

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
  const tab: Tab = sp.get("tab") === "community" ? "community" : "mine";
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

  const active = tab === "mine" ? mineQ : communityQ;
  const data = active.data;
  const isLoading = active.isLoading;
  const error = active.error;

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <PageHeader
          icon={<IconBuildings className="h-7 w-7" />}
          title={isPlatformAdmin ? "Tất cả dòng họ" : "Dòng họ"}
          description={
            isPlatformAdmin
              ? "Mọi dòng họ trên nền tảng — bạn xem được tất cả."
              : "Dòng họ bạn tham gia hoặc đang theo dõi."
          }
        />

        {/* Tabs left + create-clan CTA right on the same row. Tabs
            already eat ~230 px with the count badges, so the CTA
            collapses to icon + "Tạo" on mobile and expands to
            "Tạo dòng họ" on sm+ to keep both on one line at every
            viewport width. */}
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-md border bg-card overflow-hidden"
            role="tablist"
          >
            <TabButton
              active={tab === "mine"}
              onClick={() => setTab("mine")}
              label={`Của tôi${mineCount.data ? ` (${mineCount.data.total})` : ""}`}
            />
            <TabButton
              active={tab === "community"}
              onClick={() => setTab("community")}
              label={`Cộng đồng${communityCount.data ? ` (${communityCount.data.total})` : ""}`}
            />
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
              placeholder="Tìm dòng họ — gõ không dấu cũng được"
            />
          </div>
          {/* Sắp xếp + quy mô + kiểu hiển thị: 1 hàng kể cả mobile —
              2 select co giãn chia đều (min-w-0), nút hiển thị cố định. */}
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ClanSort)}
              aria-label="Sắp xếp"
              className="h-10 min-w-0 flex-1 sm:flex-none sm:min-w-[160px] rounded-md border border-input bg-background px-2 sm:px-3 text-sm"
            >
              {(Object.keys(CLAN_SORT_LABEL) as ClanSort[]).map((k) => (
                <option key={k} value={k}>
                  {CLAN_SORT_LABEL[k]}
                </option>
              ))}
            </select>
            {tab === "community" && (
              <select
                value={sizeBucket}
                onChange={(e) =>
                  setSizeBucket(e.target.value as ClanSizeBucket | "")
                }
                aria-label="Lọc theo quy mô"
                className="h-10 min-w-0 flex-1 sm:flex-none sm:min-w-[160px] rounded-md border border-input bg-background px-2 sm:px-3 text-sm"
              >
                <option value="">Tất cả quy mô</option>
                {(Object.keys(CLAN_SIZE_BUCKETS) as ClanSizeBucket[]).map((k) => (
                  <option key={k} value={k}>
                    {CLAN_SIZE_BUCKETS[k].label}
                  </option>
                ))}
              </select>
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
        </div>

        {tab === "community" && !isPlatformAdmin && (
          <p className="text-xs text-muted-foreground -mt-2">
            Dòng họ công khai bạn chưa tham gia — chỉ xem cây, người còn sống được ẩn.
          </p>
        )}

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

        {error && (
          <Card>
            <CardContent className="pt-6 text-destructive">
              Lỗi: {(error as Error).message}
            </CardContent>
          </Card>
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
              {data.rows.map((c) => (
                <ClanCard key={c.id} clan={c} />
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {data.rows.map((c) => (
                <ClanRow key={c.id} clan={c} />
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

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 h-10 text-sm border-l first:border-l-0 ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
      }`}
    >
      {label}
    </button>
  );
}

function ClanRow({ clan }: { clan: ClanSummary }) {
  return (
    <li>
      <Link
        to={`/clans/${clan.id}`}
        className="block rounded-lg border bg-card px-4 py-3 hover:border-primary transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3 min-w-0">
          <h2 className="clan-name text-lg font-semibold truncate">
            {clan.name}
          </h2>
          <span className="text-xs text-muted-foreground shrink-0">
            {clan.person_count} thành viên
          </span>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm truncate mt-0.5">
            {clan.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {clan.role ? (
            <span className="text-foreground">{roleLabel(clan.role)}</span>
          ) : (
            <span>Khách</span>
          )}
          {" • "}
          {clan.visibility === "public" ? "Công khai" : "Riêng tư"}
        </p>
      </Link>
    </li>
  );
}

function ClanCard({ clan }: { clan: ClanSummary }) {
  return (
    <li>
      <Link
        to={`/clans/${clan.id}`}
        className="flex h-full flex-col rounded-lg border bg-card p-4 hover:border-primary transition-colors"
      >
        <div className="flex items-start gap-2 min-w-0">
          <IconTree className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <h2 className="clan-name text-base font-semibold leading-snug line-clamp-2 min-w-0">
            {clan.name}
          </h2>
        </div>
        {clan.description && (
          <p className="text-muted-foreground text-sm line-clamp-2 mt-1.5">
            {clan.description}
          </p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{clan.person_count} thành viên</span>
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
      </Link>
    </li>
  );
}

function roleLabel(role: "admin" | "editor" | "viewer"): string {
  return { admin: "Quản trị", editor: "Biên tập", viewer: "Xem" }[role];
}

