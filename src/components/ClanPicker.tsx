import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Chip } from "@/components/Chip";
import { IconBuildings, IconCheck, IconChevronDown, IconSearch, IconUsers } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

import { t } from "@lingui/core/macro";

export interface ClanOption {
  id: string;
  name: string;
  description: string | null;
  person_count: number;
}

const LIMIT = 20;

/**
 * Chọn một dòng họ trong danh sách có thể lên tới hàng nghìn: tìm PHÍA MÁY CHỦ (gõ tên, tối đa
 * 20 kết quả, nhiều người nhất lên trước) thay vì tải hết vào một ô `<select>`. Mỗi kết quả có
 * mô tả, số người và mã ngắn để phân biệt các dòng họ trùng tên.
 */
export function ClanPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: ClanOption | null;
  onChange: (clan: ClanOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(h);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const q = useQuery({
    queryKey: ["clan-picker", debounced],
    enabled: open,
    staleTime: 30_000,
    queryFn: async (): Promise<ClanOption[]> => {
      let req = supabase
        .from("clans")
        .select("id, name, description, person_count")
        .order("person_count", { ascending: false })
        .order("name", { ascending: true })
        .limit(LIMIT);
      if (debounced) req = req.ilike("name", `%${debounced.replace(/[%_]/g, "")}%`);
      const { data, error } = await req;
      if (error) throw new Error(error.message);
      return (data ?? []) as ClanOption[];
    },
  });

  return (
    <div ref={boxRef} className="space-y-2">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="relative flex min-h-12 w-full items-center rounded-md border border-input bg-background py-2 pl-10 pr-9 text-left text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <IconBuildings className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {value ? (
          <span className="min-w-0">
            <span className="block truncate">{value.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {t`${value.person_count} người`} · {t`mã`} {value.id.slice(0, 8)}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t`Tìm và chọn dòng họ…`}</span>
        )}
        <IconChevronDown
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b p-2">
            <Input
              autoFocus
              icon={<IconSearch />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t`Gõ tên dòng họ…`}
              aria-label={t`Tìm dòng họ`}
            />
          </div>
          <ul role="listbox" className="max-h-72 divide-y overflow-y-auto">
            {q.isLoading && <li className="p-3 text-sm text-muted-foreground">{t`Đang tìm…`}</li>}
            {q.error && <li className="p-3 text-sm text-destructive">{(q.error as Error).message}</li>}
            {!q.isLoading && !q.error && (q.data ?? []).length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">{t`Không có dòng họ nào khớp.`}</li>
            )}
            {(q.data ?? []).map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === value?.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
                      <span className="mr-auto font-mono text-xs text-muted-foreground">
                        {c.id.slice(0, 8)}
                      </span>
                      <Chip tone="info" icon={<IconUsers />}>
                        {t`${c.person_count} người`}
                      </Chip>
                    </div>
                  </div>
                  {c.id === value?.id && <IconCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
          {(q.data?.length ?? 0) >= LIMIT && (
            <p className="border-t p-2 text-center text-xs text-muted-foreground">
              {t`Hiện ${LIMIT} kết quả đầu — gõ thêm để thu hẹp.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
