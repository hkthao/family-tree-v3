import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { IconBook, IconPlus, IconSearch } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUrlState } from "@/hooks/useUrlState";
import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_MANDATORY_LABEL,
  CUSTOM_REGIONS,
  listCustomEntries,
  type CustomCategory,
  type CustomEntry,
} from "@/lib/queries/customs";
import { getMyProfile } from "@/lib/queries/profile";
import { queryKeys } from "@/lib/queries/keys";

const CATEGORIES = Object.keys(CUSTOM_CATEGORY_LABEL) as CustomCategory[];

export default function Customs() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const isAdmin = !!profile?.is_platform_admin;

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useUrlState("q", "");
  const [catRaw, setCat] = useUrlState("loai", "");
  const [regionRaw, setRegion] = useUrlState("vung", "");
  const category = (CATEGORIES.includes(catRaw as CustomCategory) ? catRaw : "") as
    | CustomCategory
    | "";
  const region = CUSTOM_REGIONS.includes(regionRaw as (typeof CUSTOM_REGIONS)[number])
    ? regionRaw
    : "";

  useEffect(() => setSearch(debounced), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = setTimeout(() => {
      if (search !== debounced) setDebounced(search);
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["customs", { debounced, category, region, isAdmin }],
    queryFn: () =>
      listCustomEntries({
        search: debounced || undefined,
        category: category || null,
        region: region || null,
        includeUnpublished: isAdmin,
      }),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <PageHeader
          icon={<IconBook className="h-7 w-7" />}
          title="Sổ tay Văn hoá"
          description="Tra cứu phong tục, nghi lễ, tín ngưỡng các vùng miền Việt Nam."
          actionsBelow
          actions={
            isAdmin ? (
              <Button size="sm" asChild>
                <Link to="/so-tay/new">
                  <IconPlus className="h-4 w-4 mr-1" /> Thêm bài
                </Link>
              </Button>
            ) : undefined
          }
        />

        <SearchInput
          label="Tìm phong tục"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Gõ tình huống cũng được — vd "nhà mới", "có em bé"…'
        />

        <CollapsibleFilters
          activeCount={(category ? 1 : 0) + (region ? 1 : 0)}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <FilterPill active={category === ""} onClick={() => setCat("")}>
                Mọi chủ đề
              </FilterPill>
              {CATEGORIES.map((c) => (
                <FilterPill key={c} active={category === c} onClick={() => setCat(c)}>
                  {CUSTOM_CATEGORY_LABEL[c]}
                </FilterPill>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={region === ""} onClick={() => setRegion("")}>
                Mọi vùng
              </FilterPill>
              {CUSTOM_REGIONS.map((r) => (
                <FilterPill key={r} active={region === r} onClick={() => setRegion(r)}>
                  {r}
                </FilterPill>
              ))}
            </div>
          </div>
        </CollapsibleFilters>

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

        {entries && entries.length === 0 && (
          <EmptyState
            icon={<IconSearch className="h-10 w-10" />}
            title={
              debounced || category || region
                ? "Không có bài nào khớp"
                : "Chưa có nội dung"
            }
            description={
              debounced || category || region
                ? "Thử bỏ bớt bộ lọc hoặc từ khoá."
                : "Sổ tay đang được biên soạn."
            }
          />
        )}

        {entries && entries.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {entries.map((e) => (
              <CustomCard key={e.id} entry={e} />
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground pt-2">
          ⚠️ Nội dung mang tính tham khảo; phong tục có thể khác nhau theo vùng.
        </p>
      </main>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

function CustomCard({ entry }: { entry: CustomEntry }) {
  return (
    <li>
      <Link
        to={`/so-tay/${entry.id}`}
        className="flex min-w-0 gap-3 rounded-lg border bg-card p-3 hover:border-primary transition-colors h-full"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted grid place-items-center">
          {entry.cover_image_url ? (
            <img
              src={entry.cover_image_url}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <IconBook className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{entry.title}</p>
            {entry.status !== "published" && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                {entry.status === "draft" ? "Nháp" : "Chờ duyệt"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {CUSTOM_CATEGORY_LABEL[entry.category]}
            {entry.regions.length > 0 ? ` · ${entry.regions.join(", ")}` : ""}
          </p>
          {entry.short_description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {entry.short_description}
            </p>
          )}
          {entry.mandatory_level && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {CUSTOM_MANDATORY_LABEL[entry.mandatory_level]}
              {entry.reliability ? ` · độ tin cậy ${"★".repeat(entry.reliability)}` : ""}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
