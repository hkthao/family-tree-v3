import { useEffect, useMemo, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { VideoModal } from "@/components/HelpVideoButton";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { unaccent } from "@/lib/unaccent";
import {
  formatDuration,
  getPosterUrl,
  pickViewport,
  VIDEO_GROUPS,
  VIDEO_TUTORIALS,
  type VideoGroup,
  type VideoTutorial,
} from "@/lib/videoTutorials";

const PAGE_SIZE = 9;

/**
 * `/huong-dan-video` — trang trung tâm tất cả video hướng dẫn.
 *
 * Layout: search + filter group + grid cards. Click card → modal
 * player. Pattern khớp `/docs` (chia theo group).
 */
export default function Videos() {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<VideoGroup | "all">("all");
  const [playing, setPlaying] = useState<VideoTutorial | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = unaccent(query.trim());
    return VIDEO_TUTORIALS.filter((v) => {
      if (activeGroup !== "all" && v.group !== activeGroup) return false;
      if (!needle) return true;
      const hay = unaccent(`${v.title} ${v.description}`);
      return hay.includes(needle);
    });
  }, [query, activeGroup]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page khi filter / search đổi.
  useEffect(() => {
    setPage(1);
  }, [query, activeGroup]);

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-4">
        <Breadcrumb
          items={[
            { label: "Hướng dẫn", to: "/docs" },
            { label: "Video" },
          ]}
        />

        <header className="space-y-1">
          <h1 className="clan-name text-2xl sm:text-3xl font-semibold">
            Video hướng dẫn
          </h1>
          <p className="text-sm text-muted-foreground">
            {VIDEO_TUTORIALS.length} video ngắn (~30-70 giây). Bấm card
            để xem.
          </p>
        </header>

        {/* Search */}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo từ khoá…"
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        />

        {/* Group filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={activeGroup === "all"}
            onClick={() => setActiveGroup("all")}
          >
            Tất cả ({VIDEO_TUTORIALS.length})
          </FilterChip>
          {(Object.keys(VIDEO_GROUPS) as VideoGroup[]).map((g) => {
            const count = VIDEO_TUTORIALS.filter((v) => v.group === g).length;
            return (
              <FilterChip
                key={g}
                active={activeGroup === g}
                onClick={() => setActiveGroup(g)}
              >
                {VIDEO_GROUPS[g]} ({count})
              </FilterChip>
            );
          })}
        </div>

        {/* Grid — auto-rows-fr để mọi row trong grid có chiều cao
            bằng row tallest. flex-col bên trong card cho phần meta
            ở dưới cùng pinned khi description ngắn. */}
        {filtered.length === 0 ? (
          <p className="text-muted-foreground italic py-8 text-center">
            Không có video nào khớp.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr">
            {pageItems.map((v) => (
              <li key={v.id} className="h-full">
                <VideoCard tutorial={v} onPlay={() => setPlaying(v)} />
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav
            className="flex items-center justify-between pt-3 border-t"
            aria-label="Phân trang"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Trang trước"
              title="Trang trước"
              className="h-9 w-9 p-0"
            >
              <IconArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              Trang {page} / {totalPages} · {filtered.length} video
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Trang sau"
              title="Trang sau"
              className="h-9 w-9 p-0"
            >
              <IconArrowRight className="h-4 w-4" />
            </Button>
          </nav>
        )}
      </main>

      {playing && (
        <VideoModal tutorial={playing} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-9 rounded-md border text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

function VideoCard({
  tutorial,
  onPlay,
}: {
  tutorial: VideoTutorial;
  onPlay: () => void;
}) {
  const viewport = pickViewport();
  const poster = getPosterUrl(tutorial.spec, viewport);

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group flex flex-col h-full w-full text-left rounded-lg border bg-card hover:bg-muted/30 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video bg-muted overflow-hidden shrink-0">
        <img
          src={poster}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-12 w-12 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs tabular-nums">
          {formatDuration(tutorial.duration)}
        </span>
      </div>
      <div className="flex-1 flex flex-col p-3 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {VIDEO_GROUPS[tutorial.group]}
        </p>
        <h3 className="font-semibold leading-tight line-clamp-2 min-h-[2.5rem]">
          {tutorial.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {tutorial.description}
        </p>
      </div>
    </button>
  );
}
