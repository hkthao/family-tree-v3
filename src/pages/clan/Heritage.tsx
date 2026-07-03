import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { HeritageThumb } from "@/components/HeritageThumb";
import { IconPlus, IconScroll, IconSearch } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { CustomCard } from "@/pages/Customs";
import { listCustomEntries } from "@/lib/queries/customs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
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

const CATEGORIES = Object.keys(HERITAGE_CATEGORY_LABEL) as HeritageCategory[];

export default function Heritage() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const canEdit = canEditClan(clan);

  // 2 tab: "clan" = di sản riêng của họ · "sotay" = Sổ tay Văn hoá chung.
  const [tabRaw, setTab] = useUrlState("tab", "clan");
  const tab = tabRaw === "sotay" ? "sotay" : "clan";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useUrlState("q", "");
  const [catRaw, setCat] = useUrlState("loai", "");
  const category = (CATEGORIES.includes(catRaw as HeritageCategory) ? catRaw : "") as
    | HeritageCategory
    | "";

  useEffect(() => setSearch(debounced), []); // seed from URL on mount
  useEffect(() => {
    const h = setTimeout(() => {
      if (search !== debounced) setDebounced(search);
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["heritage", clan.id, userId, debounced, category],
    queryFn: () =>
      listHeritageItems(clan.id, { search: debounced, category: category || null }),
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
    queryKey: ["heritage-thumbs", (items ?? []).map((i) => i.cover_media_path).join(",")],
    queryFn: () =>
      // URL ký hạn dài (mặc định 7 ngày) → trình duyệt cache ảnh, giảm tải.
      getSignedPhotoUrlMap(
        (items ?? []).map((i) => i.cover_media_path).filter((p): p is string => !!p),
      ),
    enabled: !!items && items.some((i) => i.cover_media_path),
    staleTime: PHOTO_URL_STALE_MS,
  });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Di sản & Văn hoá" },
        ]}
      />
      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title="Di sản & Văn hoá"
        description="Từ đường, tục lệ, giai thoại, tư liệu — gìn giữ giá trị tinh thần của dòng họ."
      />

      {/* Tab + nút Thêm CÙNG MỘT HÀNG cho tiết kiệm diện tích. Nút Thêm
          chỉ hiện ở tab "Của dòng họ" (thêm di sản của họ). */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex w-fit gap-1 rounded-lg border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab("clan")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "clan"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Của dòng họ
          </button>
          <button
            type="button"
            onClick={() => setTab("sotay")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "sotay"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sổ tay Văn hoá
          </button>
        </div>
        {tab === "clan" && canEdit && (
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => navigate(`/clans/${clan.id}/heritage/new`)}
          >
            <IconPlus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        )}
      </div>

      {tab === "sotay" && <SoTayTab />}

      {tab === "clan" && (
        <>
      {/* Thanh dung lượng media của họ */}
      {storageBytes != null && (() => {
        const pct = Math.min(100, Math.round((storageBytes / HERITAGE_CLAN_QUOTA_BYTES) * 100));
        const near = pct >= 90;
        return (
          <div className="rounded-md border bg-card px-3 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dung lượng ảnh & ghi âm</span>
              <span className={near ? "font-medium text-red-600" : "font-medium"}>
                {formatBytes(storageBytes)} / {formatBytes(HERITAGE_CLAN_QUOTA_BYTES)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${near ? "bg-red-600" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {near && (
              <p className="mt-1 text-xs text-red-600">
                Sắp đầy. Hãy xoá bớt ảnh/ghi âm cũ trước khi thêm mới.
              </p>
            )}
          </div>
        );
      })()}

      {/* Lọc theo loại — mobile: 1 hàng cuộn ngang (tiết kiệm chỗ); sm+: xuống dòng.
          -mx-4 px-4 để cuộn sát mép màn; scrollbar ẩn cho gọn. */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        style={{ scrollbarWidth: "none" }}
      >
        <button
          type="button"
          onClick={() => setCat("")}
          className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${
            category === "" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"
          }`}
        >
          Tất cả
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${
              category === c ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"
            }`}
          >
            {HERITAGE_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <SearchInput
        label="Tìm di sản"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo tên / nội dung…"
      />

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {items && items.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={debounced || category ? "Không có mục nào khớp" : "Chưa có mục di sản nào"}
          description={
            debounced || category
              ? "Thử bỏ bớt bộ lọc."
              : canEdit
                ? "Bấm 'Thêm' để ghi lại tục lệ, từ đường, giai thoại đầu tiên của họ."
                : "Chưa có dữ liệu."
          }
          primary={
            canEdit && !debounced && !category
              ? { label: "Thêm", to: `/clans/${clan.id}/heritage/new`, icon: <IconPlus className="h-4 w-4 mr-1.5" /> }
              : undefined
          }
        />
      )}

      {items && items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((i) => {
            const thumb = i.cover_external_url
              ?? (i.cover_media_path ? photoUrls?.get(i.cover_media_path) : null);
            return (
              <li key={i.id} className="min-w-0">
                <Link
                  to={`/clans/${clan.id}/heritage/${i.id}`}
                  className="flex min-w-0 gap-3 rounded-lg border bg-card p-3 hover:border-primary transition-colors h-full"
                >
                  <HeritageThumb category={i.category} src={thumb} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{i.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {HERITAGE_CATEGORY_LABEL[i.category]}
                      {i.location_name ? ` · ${i.location_name}` : ""}
                    </p>
                    {i.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{i.summary}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[
                        i.photo_count ? `${i.photo_count} ảnh` : null,
                        i.audio_count ? `${i.audio_count} ghi âm` : null,
                        i.video_count ? `${i.video_count} video` : null,
                        i.people_count ? `${i.people_count} người` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                    <RecordDates
                      createdAt={i.created_at}
                      updatedAt={i.updated_at}
                      className="text-xs text-muted-foreground/80 mt-0.5 truncate"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
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
function SoTayTab() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["customs-embed"],
    queryFn: () => listCustomEntries({}),
    staleTime: 5 * 60 * 1000,
  });

  const PAGE_SIZE = 8;
  const [pageRaw, setPage] = useUrlState("sp", "");
  const all = entries ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  const paged = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Nội dung chung về phong tục – nghi lễ Việt Nam từ Sổ tay Văn hoá của hệ thống.{" "}
        <Link to="/so-tay" className="text-primary hover:underline">
          Mở Sổ tay đầy đủ →
        </Link>
      </p>

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {!isLoading && all.length === 0 && (
        <EmptyState
          icon={<IconScroll className="h-10 w-10" />}
          title="Sổ tay đang được biên soạn"
          description="Chưa có bài phong tục nào."
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
          unit="bài"
          onPageChange={(p) => setPage(p <= 1 ? "" : String(p))}
        />
      )}
    </div>
  );
}
