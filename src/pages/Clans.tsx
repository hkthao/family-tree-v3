import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import {
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
  IconSearch,
  IconTree,
  IconUsers,
} from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  CLAN_SIZE_BUCKETS,
  listCommunityClans,
  listMyClans,
  type ClanSizeBucket,
  type ClanSummary,
} from "@/lib/queries/clans";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

const PAGE_SIZE = 20;
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

  const [tab, setTab] = useState<Tab>("mine");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sizeBucket, setSizeBucket] = useState<ClanSizeBucket | "">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const h = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, sizeBucket]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    search: debounced,
    // Size filter only applies to the community tab; keep "Của tôi"
    // unfiltered so the user can always find clans they joined.
    sizeBucket: tab === "community" && sizeBucket ? sizeBucket : null,
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
      <main className="container max-w-4xl py-6 px-4 space-y-6">
        <h1 className="clan-name text-2xl sm:text-3xl font-semibold">
          {isPlatformAdmin ? "Tất cả dòng họ" : "Dòng họ"}
        </h1>

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
            <Link to="/clans/new">
              <IconPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Tạo dòng họ</span>
            </Link>
          </Button>
        </div>

        {/* Filter row — single line on sm+. No external labels; the
            search icon + placeholder, and the dropdown's own default
            label, carry the meaning. h-10 is denser than the default
            h-12 since we're not the primary tap target on this page. */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              label="Tìm dòng họ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm dòng họ — gõ không dấu cũng được"
            />
          </div>
          {tab === "community" && (
            <select
              value={sizeBucket}
              onChange={(e) =>
                setSizeBucket(e.target.value as ClanSizeBucket | "")
              }
              aria-label="Lọc theo quy mô"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
            >
              <option value="">Tất cả quy mô</option>
              {(Object.keys(CLAN_SIZE_BUCKETS) as ClanSizeBucket[]).map((k) => (
                <option key={k} value={k}>
                  {CLAN_SIZE_BUCKETS[k].label}
                </option>
              ))}
            </select>
          )}
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
          <ul className="space-y-2">
            {data.rows.map((c) => (
              <ClanRow key={c.id} clan={c} />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="text-muted-foreground">
              {`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}`}
              {active.isFetching && <span className="ml-2 italic">đang tải…</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <IconArrowLeft className="h-4 w-4 mr-1" />
                Trước
              </Button>
              <span className="px-2">
                {page}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Sau
                <IconArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
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

function roleLabel(role: "admin" | "editor" | "viewer"): string {
  return { admin: "Quản trị", editor: "Biên tập", viewer: "Xem" }[role];
}

