import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { FabGroup } from "@/components/FabGroup";
import { CustomsShell } from "@/components/CustomsShell";
import { EmptyState } from "@/components/EmptyState";
import {
  IconBook,
  IconCalendar,
  IconHelp,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconTag,
  IconUpload,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { SearchInput } from "@/components/SearchInput";
import { Select } from "@/components/ui/select";
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

import { t } from "@lingui/core/macro";
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
  const category = (
    CATEGORIES.includes(catRaw as CustomCategory) ? catRaw : ""
  ) as CustomCategory | "";
  const region = CUSTOM_REGIONS.includes(
    regionRaw as (typeof CUSTOM_REGIONS)[number],
  )
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

  // Phân trang (lọc + tìm đã ở client nên cắt trang ở client luôn).
  const PAGE_SIZE = 12;
  const [pageRaw, setPage] = useUrlState("trang", "");
  const all = entries ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  const paged = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <CustomsShell>
      <PageHeader
        icon={<IconBook className="h-7 w-7" />}
        title={t`Sổ tay Văn hoá`}
        description={t`Tra cứu phong tục, nghi lễ, tín ngưỡng các vùng miền Việt Nam.`}
      />
      {isAdmin && (
        <FabGroup
          label={t`Thêm`}
          actions={[
            {
              label: t`Thêm bài`,
              icon: <IconPlus />,
              to: "/so-tay/new",
              panel: { id: "custom-new" },
            },
            {
              label: t`Nhập Markdown`,
              icon: <IconUpload />,
              to: "/so-tay/import",
              panel: { id: "custom-import" },
            },
          ]}
        />
      )}

      {/* Chủ đề + vùng nằm trong ngăn kéo bên phải (phễu trong ô tìm kiếm). */}
      <div className="space-y-2">
        <CollapsibleFilters
          activeCount={(category ? 1 : 0) + (region ? 1 : 0)}
          onReset={() => {
            setCat("");
            setRegion("");
          }}
          search={(toggle) => (
            <SearchInput
              label={t`Tìm phong tục`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t`Gõ tình huống cũng được — vd "nhà mới", "có em bé"…`}
              rightSlot={toggle}
            />
          )}
        >
          <div className="flex flex-col gap-3">
            <Select
              value={category}
              onChange={(e) => setCat(e.target.value)}
              aria-label={t`Lọc theo chủ đề`}
              icon={<IconTag />}
              className="h-11 w-full text-base"
            >
              <option value="">{t`Mọi chủ đề`}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CUSTOM_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
            <Select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              aria-label={t`Lọc theo vùng`}
              icon={<IconMapPin />}
              className="h-11 w-full text-base"
            >
              <option value="">{t`Mọi vùng`}</option>
              {CUSTOM_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
        </CollapsibleFilters>
      </div>

      {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}

      {entries && entries.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={
            debounced || category || region
              ? t`Không có bài nào khớp`
              : t`Chưa có nội dung`
          }
          description={
            debounced || category || region
              ? t`Thử bỏ bớt bộ lọc hoặc từ khoá.`
              : t`Sổ tay đang được biên soạn.`
          }
        />
      )}

      {all.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {paged.map((e) => (
            <CustomCard key={e.id} entry={e} />
          ))}
        </ul>
      )}

      {all.length > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={all.length}
          pageSize={PAGE_SIZE}
          unit={t`bài`}
          onPageChange={(p) => setPage(p <= 1 ? "" : String(p))}
        />
      )}

      <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
        <IconHelp className="h-3.5 w-3.5 shrink-0" />
        {t`Nội dung mang tính tham khảo; phong tục có thể khác nhau theo vùng.`}
      </p>
    </CustomsShell>
  );
}

export function CustomCard({ entry }: { entry: CustomEntry }) {
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
                  {entry.status === "draft" ? t`Nháp` : t`Chờ duyệt`}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              <span className="font-medium text-primary/80">
                {CUSTOM_CATEGORY_LABEL[entry.category]}
              </span>
              {entry.regions.length > 0 ? ` · ${entry.regions.join(", ")}` : ""}
            </p>
          </div>
        </div>

        {entry.short_description && (
          <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {entry.short_description}
          </p>
        )}

        {/* Chân card: độ tin cậy · mức bắt buộc · ngày tạo */}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-[11px] text-muted-foreground">
          {entry.reliability != null && (
            <span
              className="inline-flex items-center gap-1"
              title={t`Độ tin cậy`}
            >
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
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-1"
            title={t`Ngày tạo`}
          >
            <IconCalendar className="h-3.5 w-3.5" />
            {created}
          </span>
        </div>
      </Link>
    </li>
  );
}
