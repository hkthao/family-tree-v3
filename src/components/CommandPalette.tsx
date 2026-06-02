import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { IconSearch } from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { queryKeys } from "@/lib/queries/keys";
import { listPersons } from "@/lib/queries/persons";

const MAX_RESULTS = 8;

/**
 * Global Cmd/Ctrl+K palette — fast lookup of any person in the
 * current clan via name / nickname / place / bio (full-text search
 * over persons.search_text). Esc / backdrop closes. Arrow keys +
 * Enter navigate the result list.
 *
 * Mounted in ClanLayout so it's only active inside a clan context
 * where there's a useful corpus to search. Outside a clan (the
 * /clans index, account pages) Cmd+K is a no-op — would expand
 * to cross-clan search in a future revision.
 */
export function CommandPalette() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focus, setFocus] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input + reset state when opening
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDebounced("");
    setFocus(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(h);
  }, [query]);

  // Esc / arrows / enter
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocus((i) => Math.min(i + 1, MAX_RESULTS - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocus((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { data } = useQuery({
    queryKey: queryKeys.persons(clan.id, userId, {
      search: debounced,
      page: 1,
      pageSize: MAX_RESULTS,
      sort: "name",
    }),
    queryFn: () =>
      listPersons(clan.id, {
        search: debounced,
        page: 1,
        pageSize: MAX_RESULTS,
        sort: "name",
      }),
    enabled: open && debounced.length > 0,
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];

  function pick(personId: string) {
    setOpen(false);
    navigate(`/clans/${clan.id}/people/${personId}`);
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tìm nhanh"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-lg bg-card shadow-xl border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b">
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
              if (e.key === "Enter") {
                const selected = rows[focus];
                if (selected) pick(selected.id);
              }
            }}
            placeholder="Tìm tên, biệt danh, nơi sinh, tiểu sử…"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 border rounded text-muted-foreground">
            esc
          </kbd>
        </div>

        {debounced && rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Không tìm thấy ai khớp "{debounced}"
          </p>
        )}

        {!debounced && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Gõ tên người để tìm trong dòng họ <strong>{clan.name}</strong>
          </p>
        )}

        {rows.length > 0 && (
          <ul className="max-h-[50vh] overflow-y-auto">
            {rows.slice(0, MAX_RESULTS).map((p, i) => {
              const isFocused = i === focus;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    onMouseEnter={() => setFocus(i)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 ${
                      isFocused ? "bg-muted/60" : ""
                    }`}
                  >
                    <PersonAvatar
                      gender={p.gender}
                      photoUrl={null}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.generation !== null ? `Đời ${p.generation}` : ""}
                        {!p.is_living && p.generation !== null ? " · " : ""}
                        {!p.is_living ? "đã mất" : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="px-4 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center gap-4">
          <span><kbd className="font-mono">↑↓</kbd> chọn</span>
          <span><kbd className="font-mono">↵</kbd> mở</span>
          <span className="ml-auto"><kbd className="font-mono">⌘K</kbd> mở/đóng</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
