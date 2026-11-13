import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SectionCard } from "@/components/SectionCard";
import { Fab } from "@/components/Fab";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import {
  HERITAGE_CATEGORY_ICON,
  HERITAGE_CATEGORY_TONE,
} from "@/components/heritageCategoryStyle";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { HeritageThumb } from "@/components/HeritageThumb";
import {
  IconCamera,
  IconChart,
  IconMapPin,
  IconMicrophone,
  IconPlay,
  IconPlus,
  IconScroll,
  IconSearch,
  IconTag,
  IconUsers,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PanelLink } from "@/components/panel/PanelLink";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { Select } from "@/components/ui/select";
import { CustomCard } from "@/pages/Customs";
import { listCustomEntries } from "@/lib/queries/customs";
import { useAuth } from "@/hooks/useAuth";
import { MemoryRoomCtaButton } from "@/components/MemoryRoomCta";
import {
  canEditClan,
  effectiveRole,
  useClanContext,
} from "@/hooks/useClanContext";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
} from "@/hooks/useClientPaging";
import { unaccent } from "@/lib/unaccent";
import { useUrlState } from "@/hooks/useUrlState";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import {
  clanHeritageStorageBytes,
  formatBytes,
  HERITAGE_CATEGORY_LABEL,
  HERITAGE_CLAN_QUOTA_BYTES,
  listHeritageItems,
  type HeritageCategory,
} from "@/lib/queries/heritage";

import { t } from "@lingui/core/macro";
const CATEGORIES = Object.keys(HERITAGE_CATEGORY_LABEL) as HeritageCategory[];

export default function Heritage() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);
  const isMember = effectiveRole(clan) !== null;

  // 2 tab: "clan" = di sản riêng của họ · "sotay" = Sổ tay Văn hoá chung.
  const [tabRaw] = useUrlState("tab", "clan");
  const tab = tabRaw === "sotay" ? "sotay" : "clan";

  const [search, setSearch] = useState("");
  const [debounced] = useUrlState("q", "");
  const [catRaw] = useUrlState("loai", "");
  const category = (
    CATEGORIES.includes(catRaw as HeritageCategory) ? catRaw : ""
  ) as HeritageCategory | "";

  useEffect(() => setSearch(debounced), []); // seed from URL on mount
  useEffect(() => {
    const h = setTimeout(() => {
      if (search !== debounced) patchAndResetPage({ q: search });
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["heritage", clan.id, userId, debounced, category],
    queryFn: () =>
      listHeritageItems(clan.id, {
        search: debounced,
        category: category || null,
      }),
    enabled: !!userId,
    // Danh sách di sản: luôn coi là cũ (ghi đè staleTime 4h toàn cục) → mỗi
    // lần đổi tab lọc / mở trang đều gọi lại, không hiển thị cache rỗng cũ.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: storageBytes } = useQuery({
    queryKey: ["heritage-storage", clan.id, userId],
    queryFn: () => clanHeritageStorageBytes(clan.id),
    enabled: !!userId,
  });

  const { data: photoUrls } = useQuery({
    queryKey: [
      "heritage-thumbs",
      (items ?? []).map((i) => i.cover_media_path).join(","),
    ],
    queryFn: () =>
      // URL ký hạn dài (mặc định 7 ngày) → trình duyệt cache ảnh, giảm tải.
      getSignedPhotoUrlMap(
        (items ?? [])
          .map((i) => i.cover_media_path)
          .filter((p): p is string => !!p),
      ),
    enabled: !!items && items.some((i) => i.cover_media_path),
    staleTime: PHOTO_URL_STALE_MS,
  });

  const {
    page,
    totalPages,
    pageSize,
    total,
    paged,
    setPage,
    setPageSize,
    patchAndResetPage,
  } = useClientPaging(items ?? [], 20);

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Di sản dòng họ` },
        ]}
      />
      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title={t`Di sản dòng họ`}
        description={t`Từ đường, tục lệ, giai thoại, tư liệu — gìn giữ giá trị tinh thần của dòng họ.`}
      />

      {/* Nguồn (Của dòng họ / Sổ tay Văn hoá) và loại di sản nằm trong ngăn kéo bên phải
          (phễu trong ô tìm kiếm) — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={
          (tab !== "clan" ? 1 : 0) + (tab === "clan" && category ? 1 : 0)
        }
        onReset={() => patchAndResetPage({ tab: null, loai: null, sp: null })}
        title={t`Lọc di sản`}
        actions={
          isMember ? (
            <MemoryRoomCtaButton clanId={clan.id} className="h-9" />
          ) : undefined
        }
        search={(toggle) => (
          <SearchInput
            label={tab === "clan" ? t`Tìm di sản` : t`Tìm bài phong tục`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "clan"
                ? t`Tìm theo tên / nội dung…`
                : t`Tìm theo tên / mô tả bài…`
            }
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <fieldset className="space-y-2">
            <legend className="text-base font-medium">{t`Nguồn`}</legend>
            <div role="tablist" className="flex gap-2">
              {(
                [
                  ["clan", t`Của dòng họ`],
                  ["sotay", t`Sổ tay Văn hoá`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={tab === value}
                  onClick={() =>
                    patchAndResetPage({
                      tab: value === "clan" ? null : value,
                      sp: null,
                    })
                  }
                  className={`min-h-[44px] flex-1 rounded-md border px-3 text-sm ${
                    tab === value
                      ? "border-primary bg-primary/5 font-medium"
                      : "hover:bg-muted/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {tab === "clan" && (
            <Select
              value={category}
              onChange={(e) => patchAndResetPage({ loai: e.target.value })}
              aria-label={t`Lọc theo loại`}
              icon={<IconTag />}
              className="h-11 w-full text-base"
            >
              <option value="">{t`Mọi loại`}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {HERITAGE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </div>
      </CollapsibleFilters>

      {tab === "clan" && canEdit && (
        <Fab
          to={`/clans/${clan.id}/heritage/new`}
          panel={{ id: "heritage-new" }}
          label={t`Thêm di sản`}
        />
      )}

      {tab === "sotay" && <SoTayTab search={debounced} />}

      {tab === "clan" && (
        <>
          {/* Thanh dung lượng media của họ */}
          {storageBytes != null &&
            (() => {
              const pct = Math.min(
                100,
                Math.round((storageBytes / HERITAGE_CLAN_QUOTA_BYTES) * 100),
              );
              const near = pct >= 90;
              return (
                <SectionCard
                  id="heritage-storage"
                  icon={<IconChart />}
                  title={t`Dung lượng ảnh & ghi âm`}
                  action={
                    <span
                      className={`shrink-0 text-sm ${near ? "font-medium text-red-600" : "text-muted-foreground"}`}
                    >
                      {formatBytes(storageBytes)} /{" "}
                      {formatBytes(HERITAGE_CLAN_QUOTA_BYTES)}
                    </span>
                  }
                >
                  <div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${near ? "bg-red-600" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {near && (
                      <p className="mt-1 text-xs text-red-600">
                        {t`Sắp đầy. Hãy xoá bớt ảnh/ghi âm cũ trước khi thêm mới.`}
                      </p>
                    )}
                  </div>
                </SectionCard>
              );
            })()}

          {isLoading && (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-muted-foreground">{t`Đang tải…`}</p>
            </div>
          )}

          {items && items.length === 0 && (
            <EmptyState
              icon={<IconSearch className="h-10 w-10" />}
              title={
                debounced || category
                  ? t`Không có mục nào khớp`
                  : t`Chưa có mục di sản nào`
              }
              description={
                debounced || category
                  ? t`Thử bỏ bớt bộ lọc.`
                  : canEdit
                    ? t`Bấm 'Thêm' để ghi lại tục lệ, từ đường, giai thoại đầu tiên của họ.`
                    : t`Chưa có dữ liệu.`
              }
              primary={
                canEdit && !debounced && !category
                  ? {
                      label: t`Thêm`,
                      to: `/clans/${clan.id}/heritage/new`,
                      panel: { id: "heritage-new" as const },
                      icon: <IconPlus className="h-4 w-4 mr-1.5" />,
                    }
                  : undefined
              }
            />
          )}

          {items && items.length > 0 && (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {paged.map((i) => {
                const thumb =
                  i.cover_external_url ??
                  (i.cover_media_path
                    ? photoUrls?.get(i.cover_media_path)
                    : null);
                return (
                  <li key={i.id}>
                    <PanelLink
                      to={`/clans/${clan.id}/heritage/${i.id}`}
                      panel="heritage-view"
                      panelParams={{ pid: i.id }}
                      className="flex min-w-0 items-stretch gap-3 p-3 transition-colors hover:bg-muted/40"
                    >
                      <HeritageThumb category={i.category} src={thumb} flush />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{i.title}</p>
                        {i.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {i.summary}
                          </p>
                        )}
                        <RecordDates
                          createdAt={i.created_at}
                          updatedAt={i.updated_at}
                          className="text-xs text-muted-foreground/80 mt-0.5 truncate"
                        />
                        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                          {(() => {
                            const CatIcon = HERITAGE_CATEGORY_ICON[i.category];
                            return (
                              <Chip
                                tone={HERITAGE_CATEGORY_TONE[i.category]}
                                icon={<CatIcon />}
                              >
                                {HERITAGE_CATEGORY_LABEL[i.category]}
                              </Chip>
                            );
                          })()}
                          {i.location_name && (
                            <Chip tone="teal" icon={<IconMapPin />}>
                              {i.location_name}
                            </Chip>
                          )}
                          {i.photo_count > 0 && (
                            <Chip tone="rose" icon={<IconCamera />}>
                              {i.photo_count} ảnh
                            </Chip>
                          )}
                          {i.audio_count > 0 && (
                            <Chip tone="orange" icon={<IconMicrophone />}>
                              {i.audio_count} ghi âm
                            </Chip>
                          )}
                          {i.video_count > 0 && (
                            <Chip tone="indigo" icon={<IconPlay />}>
                              {i.video_count} video
                            </Chip>
                          )}
                          {i.people_count > 0 && (
                            <Chip tone="success" icon={<IconUsers />}>
                              {i.people_count} người
                            </Chip>
                          )}
                        </div>
                      </div>
                    </PanelLink>
                  </li>
                );
              })}
            </ul>
          )}

          {items && items.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              unit={t`mục`}
              onPageChange={setPage}
              pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Tab "Sổ tay Văn hoá" trong trang Di sản của họ — hiển thị nội dung
 * phong tục CHUNG của hệ thống (bảng custom_entries, chỉ bài published),
 * có phân trang. Bấm một bài mở trang Sổ tay.
 */
function SoTayTab({ search }: { search: string }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["customs-embed"],
    queryFn: () => listCustomEntries({}),
    staleTime: 5 * 60 * 1000,
  });

  const PAGE_SIZE = 8;
  const [pageRaw, setPage] = useUrlState("sp", "");
  const q = unaccent(search.trim()).toLowerCase();
  const all = (entries ?? []).filter(
    (e) =>
      !q ||
      unaccent(`${e.title} ${e.short_description ?? ""}`)
        .toLowerCase()
        .includes(q),
  );
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  const paged = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t`Nội dung chung về phong tục – nghi lễ Việt Nam từ Sổ tay Văn hoá của hệ thống.`}{" "}
        <Link to="/so-tay" className="text-primary hover:underline">
          {t`Mở Sổ tay đầy đủ →`}
        </Link>
      </p>

      {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}

      {!isLoading && all.length === 0 && (
        <EmptyState
          icon={<IconScroll className="h-10 w-10" />}
          title={q ? t`Không có bài nào khớp` : t`Sổ tay đang được biên soạn`}
          description={
            q ? t`Thử bỏ bớt từ khoá.` : t`Chưa có bài phong tục nào.`
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
    </div>
  );
}
