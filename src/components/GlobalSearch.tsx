import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";

import { IconSearch } from "@/components/icons";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { useAuth } from "@/hooks/useAuth";
import {
  PAGE_ENTRIES,
  POLICY_ENTRIES,
  STATIC_GROUP_LABEL,
  filterEntries,
  guideEntries,
  type StaticEntry,
} from "@/lib/globalSearchStatic";
import { buildSections } from "@/lib/navModel";
import { getClanDetail } from "@/lib/queries/clan-detail";
import {
  SEARCH_KIND_ORDER,
  globalSearch,
  hitPath,
  type SearchHit,
} from "@/lib/queries/global-search";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";

interface Row {
  key: string;
  group: string;
  title: string;
  subtitle?: string | null;
  tag?: string | null;
  to: string;
}

const hitRow = (h: SearchHit, label: string): Row => ({
  key: `${h.kind}:${h.id}`,
  group: label,
  title: h.title,
  subtitle: h.subtitle,
  tag: h.kind === "clan" ? null : h.clanName,
  to: hitPath(h),
});

const staticRow = (e: StaticEntry): Row => ({
  key: `${e.group}:${e.to}:${e.title}`,
  group: STATIC_GROUP_LABEL[e.group],
  title: e.title,
  subtitle: e.subtitle,
  to: e.to,
});

/**
 * Tìm kiếm toàn cục (Cmd/Ctrl+K hoặc nút kính lúp ở thanh trên).
 * Gộp: trang trong app (theo quyền ở dòng họ đang mở), dữ liệu của MỌI dòng họ người dùng được xem
 * (người, dòng họ, mộ phần, di sản, sự kiện, bảng tin, đóng góp, thông gia, Sổ tay — qua RPC global_search,
 * RLS quyết định), hướng dẫn sử dụng và các trang quy định / quyền riêng tư.
 */
export function GlobalSearch() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const { clanId } = useParams<{ clanId?: string }>();
  const aiEnabled = useAiEnabled();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focus, setFocus] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDebounced("");
    setFocus(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(h);
  }, [query]);

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: open && !!userId,
  });
  const { data: clan } = useQuery({
    queryKey: queryKeys.clan(clanId ?? "", userId),
    queryFn: () => getClanDetail(clanId!, userId),
    enabled: open && !!userId && !!clanId,
  });

  const { data: hits, isFetching, error } = useQuery({
    queryKey: ["global-search", userId, debounced],
    queryFn: () => globalSearch(debounced),
    enabled: open && !!userId && debounced.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const menuEntries = useMemo<StaticEntry[]>(() => {
    if (!open) return [];
    return buildSections(clanId, clan ?? null, profile ?? null, 0, 0, 0, aiEnabled).flatMap((s) =>
      s.items
        .filter((i) => i.kind !== "feedback")
        .map<StaticEntry>((i) => ({ group: "menu", title: i.label, subtitle: s.label, to: i.to })),
    );
  }, [open, clanId, clan, profile, aiEnabled]);
  const guides = useMemo(() => (open ? guideEntries() : []), [open]);

  const rows = useMemo<Row[]>(() => {
    if (debounced.length < 2) return [];
    const out: Row[] = filterEntries(menuEntries, debounced).map(staticRow);
    const byKind = new Map<string, SearchHit[]>();
    for (const h of hits ?? []) byKind.set(h.kind, [...(byKind.get(h.kind) ?? []), h]);
    for (const { kind, label } of SEARCH_KIND_ORDER) {
      for (const h of byKind.get(kind) ?? []) out.push(hitRow(h, label));
    }
    out.push(...filterEntries(guides, debounced).map(staticRow));
    out.push(...filterEntries(POLICY_ENTRIES, debounced, 5).map(staticRow));
    out.push(...filterEntries(PAGE_ENTRIES, debounced, 3).map(staticRow));
    return out;
  }, [debounced, hits, menuEntries, guides]);

  useEffect(() => {
    if (focus >= rows.length) setFocus(Math.max(0, rows.length - 1));
  }, [rows.length, focus]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${focus}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  function pick(r: Row | undefined) {
    if (!r) return;
    setOpen(false);
    navigate(r.to);
  }

  if (!userId) return null;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Tìm kiếm"
      title="Tìm kiếm (Ctrl/⌘ + K)"
      className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted shrink-0"
    >
      <IconSearch className="h-5 w-5" />
    </button>
  );
  if (!open || typeof document === "undefined") return trigger;

  const searching = debounced.length >= 2;
  return (
    <>
      {trigger}
      {createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tìm kiếm"
          className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-3 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-card shadow-xl border overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0">
              <IconSearch className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
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
                placeholder="Tìm người, mộ phần, di sản, hướng dẫn, quy định…"
                className="flex-1 bg-transparent outline-none text-base"
                aria-label="Từ khoá tìm kiếm"
              />
              <kbd className="hidden sm:inline text-xs text-muted-foreground border rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <div ref={listRef} className="overflow-y-auto">
              {!searching && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Gõ ít nhất 2 ký tự. Tìm trong mọi dòng họ bạn được xem: người, dòng họ, mộ phần, di sản, sự kiện,
                  bảng tin, đóng góp, thông gia, Sổ tay — cùng hướng dẫn sử dụng và các quy định quyền riêng tư.
                </p>
              )}
              {searching && rows.length === 0 && !isFetching && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {error ? "Không tìm được lúc này, thử lại sau." : `Không có kết quả cho "${debounced}".`}
                </p>
              )}
              {rows.map((r, i) => (
                <div key={r.key}>
                  {(i === 0 || rows[i - 1].group !== r.group) && (
                    <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {r.group}
                    </p>
                  )}
                  <button
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setFocus(i)}
                    onClick={() => pick(r)}
                    className={`w-full text-left px-4 py-2 flex flex-col gap-0.5 ${i === focus ? "bg-muted" : ""}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">{r.title}</span>
                      {r.tag && <span className="text-xs text-muted-foreground shrink-0 max-w-[40%] truncate">{r.tag}</span>}
                    </span>
                    {r.subtitle && <span className="text-sm text-muted-foreground truncate">{r.subtitle}</span>}
                  </button>
                </div>
              ))}
              {searching && isFetching && (
                <p className="px-4 py-2 text-xs text-muted-foreground">Đang tìm…</p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
