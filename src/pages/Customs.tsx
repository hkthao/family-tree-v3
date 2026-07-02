import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { CustomsShell } from "@/components/CustomsShell";
import { EmptyState } from "@/components/EmptyState";
import {
  IconBook,
  IconCalendar,
  IconHelp,
  IconPlus,
  IconSearch,
  IconUpload,
} from "@/components/icons";
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
    // Public: chạy cho cả khách chưa đăng nhập (RLS chỉ trả bài published).
    staleTime: 5 * 60 * 1000,
  });

  return (
    <CustomsShell>
        <PageHeader
          icon={<IconBook className="h-7 w-7" />}
          title="Sổ tay Văn hoá"
          description="Tra cứu phong tục, nghi lễ, tín ngưỡng các vùng miền Việt Nam."
          actionsBelow
          actions={
            isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link to="/so-tay/new">
                    <IconPlus className="h-4 w-4 mr-1" /> Thêm bài
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/so-tay/import">
                    <IconUpload className="h-4 w-4 mr-1" /> Nhập Markdown
                  </Link>
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* Desktop: search + 2 dropdown trên 1 hàng. Mobile: 2 hàng
            (search hàng trên, 2 dropdown hàng dưới). */}
        <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          <div className="sm:flex-1 sm:min-w-[200px]">
            <SearchInput
              label="Tìm phong tục"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Gõ tình huống cũng được — vd "nhà mới", "có em bé"…'
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={category}
              onChange={(e) => setCat(e.target.value)}
              aria-label="Lọc theo chủ đề"
              className="h-10 min-w-0 flex-1 sm:flex-none sm:w-48 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Mọi chủ đề</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CUSTOM_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              aria-label="Lọc theo vùng"
              className="h-10 min-w-0 flex-1 sm:flex-none sm:w-40 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Mọi vùng</option>
              {CUSTOM_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

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

        <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
          <IconHelp className="h-3.5 w-3.5 shrink-0" />
          Nội dung mang tính tham khảo; phong tục có thể khác nhau theo vùng.
        </p>
    </CustomsShell>
  );
}

function CustomCard({ entry }: { entry: CustomEntry }) {
  const created = new Date(entry.created_at).toLocaleDateString("vi-VN");
  return (
    <li>
      <Link
        to={`/so-tay/${entry.id}`}
        className="group flex h-full min-w-0 flex-col rounded-xl border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
      >
        <div className="flex min-w-0 gap-3.5">
          {/* Ảnh bìa / placeholder — bo góc, có viền mảnh cho gọn gàng */}
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted/60 ring-1 ring-border">
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
              <IconBook className="h-6 w-6 text-muted-foreground/70" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="clan-name min-w-0 line-clamp-2 font-semibold leading-snug group-hover:text-primary">
                {entry.title}
              </h2>
              {entry.status !== "published" && (
                <span className="mt-0.5 shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  {entry.status === "draft" ? "Nháp" : "Chờ duyệt"}
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary/80">
              <span className="truncate">{CUSTOM_CATEGORY_LABEL[entry.category]}</span>
              {entry.regions.length > 0 && (
                <span className="truncate font-normal text-muted-foreground">
                  · {entry.regions.join(", ")}
                </span>
              )}
            </p>
          </div>
        </div>

        {entry.short_description && (
          <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {entry.short_description}
          </p>
        )}

        {/* Chân card: độ tin cậy · mức bắt buộc · ngày tạo */}
        <div className="mt-auto flex items-center gap-x-3 gap-y-1 border-t pt-2.5 text-[11px] text-muted-foreground">
          {entry.reliability != null && (
            <span className="inline-flex items-center gap-1" title="Độ tin cậy">
              <span className="text-accent" aria-hidden>
                {"★".repeat(entry.reliability)}
              </span>
              <span>{entry.reliability}/5</span>
            </span>
          )}
          {entry.mandatory_level && (
            <span
              className={`rounded-full px-2 py-0.5 ${
                entry.mandatory_level === "bat_buoc"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted"
              }`}
            >
              {CUSTOM_MANDATORY_LABEL[entry.mandatory_level]}
            </span>
          )}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1" title="Ngày tạo">
            <IconCalendar className="h-3.5 w-3.5" />
            {created}
          </span>
        </div>
      </Link>
    </li>
  );
}
