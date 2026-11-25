import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { IconSearch } from "@/components/icons";
import { fetchSiteSearchIndex, type SiteSearchItem } from "@/lib/queries/site-parts";
import { buildSiteMenu, sitePagePath, type SitePageKey } from "@/lib/siteSections";
import { unaccent } from "@/lib/unaccent";
import { cn } from "@/lib/utils";

import { useSite } from "./siteContext";

interface Row {
  key: string;
  group: string;
  title: string;
  subtitle?: string;
  to: string;
}

/** Thứ tự các nhóm kết quả. */
const GROUP_ORDER = ["page", "person", "post", "heritage", "grave", "honor"] as const;
const groupLabel = (k: string) =>
  k === "page" ? t`Trang` : k === "person" ? t`Người` : k === "post" ? t`Bài viết` : k === "heritage" ? t`Di sản` : k === "grave" ? t`Mộ phần` : t`Bảng vàng`;

/**
 * Tìm kiếm toàn trang kiểu hộp thoại (Ctrl/⌘ + K hoặc nút kính lúp), giống Tìm kiếm toàn cục trong app: gõ ≥ 2 ký tự,
 * không cần dấu, kết quả chia nhóm, ↑ ↓ chọn, Enter mở, Esc đóng. Tìm trong trang, người trong cây, và (tải lười khi mở)
 * bài viết / di sản / mộ phần / bảng vàng.
 */
export function SiteSearch({ pageLabel }: { pageLabel: (p: SitePageKey) => string }) {
  const { base, access, data, sections, canContribute } = useSite();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl/⌘ + K bật/tắt, đăng ký một lần.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!openRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    setQ("");
    setFocus(0);
    const h = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(h);
  }, [open]);

  const hasIndex = sections.some((s) => ["board", "heritage", "graves", "honor"].includes(s));
  const index = useQuery({
    queryKey: ["site", access.token ?? access.clanId, "search_index"],
    queryFn: () => fetchSiteSearchIndex(access),
    enabled: open && hasIndex,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const needle = unaccent(q);
  const searching = needle.length >= 2;
  const rows = useMemo<Row[]>(() => {
    if (!searching) return [];
    const out: Row[] = [];
    const pages = buildSiteMenu(sections, { canContribute }).flatMap((e) => (e.kind === "group" ? e.pages : [e.page]));
    for (const p of pages) if (unaccent(pageLabel(p)).includes(needle)) out.push({ key: `page-${p}`, group: "page", title: pageLabel(p), to: sitePagePath(base, p) });
    const off = data.generation_offset ?? 0;
    let people = 0;
    for (const p of data.persons) {
      if (people >= 12) break;
      if (!unaccent(p.full_name).includes(needle)) continue;
      people++;
      out.push({ key: `person-${p.id}`, group: "person", title: p.full_name, subtitle: p.generation != null ? t`Đời ${p.generation - off}` : undefined, to: `${sitePagePath(base, "tree")}?p=${p.id}` });
    }
    const per: Record<string, number> = {};
    for (const it of (index.data?.items ?? []) as SiteSearchItem[]) {
      if ((per[it.kind] ?? 0) >= 6 || !unaccent(`${it.title} ${it.sub ?? ""}`).includes(needle)) continue;
      per[it.kind] = (per[it.kind] ?? 0) + 1;
      const to = it.kind === "post" ? sitePagePath(base, "board", it.id) : it.kind === "heritage" ? sitePagePath(base, "heritage", it.id) : it.kind === "grave" ? sitePagePath(base, "graves") : sitePagePath(base, "honor");
      out.push({ key: `${it.kind}-${it.id}`, group: it.kind, title: it.title, subtitle: it.sub, to });
    }
    return out.sort((a, b) => GROUP_ORDER.indexOf(a.group as (typeof GROUP_ORDER)[number]) - GROUP_ORDER.indexOf(b.group as (typeof GROUP_ORDER)[number]));
  }, [needle, searching, sections, canContribute, base, data, index.data, pageLabel]);

  useEffect(() => {
    if (focus >= rows.length) setFocus(Math.max(0, rows.length - 1));
  }, [rows.length, focus]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${focus}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [focus]);

  const pick = (r: Row | undefined) => {
    if (!r) return;
    setOpen(false);
    nav(r.to);
  };

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t`Tìm kiếm`}
      title={t`Tìm kiếm (Ctrl/⌘ + K)`}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-muted"
    >
      <IconSearch className="h-5 w-5" />
    </button>
  );
  if (!open || typeof document === "undefined") return trigger;

  return (
    <>
      {trigger}
      {createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t`Tìm kiếm`}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 pt-[8vh] sm:pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <IconSearch className="h-5 w-5 shrink-0 text-muted-foreground" />
              {/* autoFocus: focus ngay trong cú chạm mở tìm kiếm — iOS Safari chỉ bật bàn phím khi focus() chạy trong thao tác người dùng. */}
              <input
                ref={inputRef}
                autoFocus
                type="text"
                role="combobox"
                aria-expanded={searching && rows.length > 0}
                aria-controls="site-search-list"
                aria-label={t`Từ khoá tìm kiếm`}
                placeholder={t`Tìm người, bài viết, di sản, mộ phần…`}
                autoComplete="off"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setFocus(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setFocus((i) => Math.min(i + 1, rows.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setFocus((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") pick(rows[focus]);
                }}
                className="flex-1 bg-transparent text-base outline-none"
              />
              <kbd className="hidden rounded border px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">Esc</kbd>
            </div>
            <div ref={listRef} id="site-search-list" role="listbox" className="overflow-y-auto">
              {!searching && <p className="px-4 py-6 text-sm text-muted-foreground">{t`Gõ ít nhất 2 ký tự để tìm người trong cây, bài viết, di sản, mộ phần, bảng vàng và các trang của dòng họ.`}</p>}
              {searching && rows.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">{index.isFetching ? t`Đang tìm…` : t`Không có kết quả cho "${q.trim()}".`}</p>
              )}
              {rows.map((r, i) => (
                <div key={r.key}>
                  {(i === 0 || rows[i - 1].group !== r.group) && (
                    <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{groupLabel(r.group)}</p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === focus}
                    data-idx={i}
                    onMouseEnter={() => setFocus(i)}
                    onClick={() => pick(r)}
                    className={cn("flex w-full flex-col gap-0.5 px-4 py-2 text-left", i === focus && "bg-muted")}
                  >
                    <span className="truncate font-medium">{r.title}</span>
                    {r.subtitle && <span className="truncate text-sm text-muted-foreground">{r.subtitle}</span>}
                  </button>
                </div>
              ))}
              {searching && index.isFetching && rows.length > 0 && <p className="px-4 py-2 text-xs text-muted-foreground">{t`Đang tìm…`}</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
