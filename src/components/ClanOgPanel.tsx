import { t } from "@lingui/core/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { ClanOgImage } from "@/components/cards/ClanOgImage";
import { OG_H, OG_W } from "@/components/cards/KhoeOgImage";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  CLAN_OG_STYLES,
  clanOgStyle,
  type ClanOgStyleId,
} from "@/lib/cards/clanOgStyles";
import { nodeToJpegBlob } from "@/lib/cards/exportCard";
import { ensureCardFontsLoaded } from "@/lib/cards/fonts";
import {
  clearClanOg,
  loadClanOgData,
  loadClanOgState,
  saveClanOg,
} from "@/lib/queries/clan-og";
import { cn } from "@/lib/utils";

/**
 * Trung tâm chia sẻ → "Ảnh xem trước khi chia sẻ": admin chọn kiểu, app dựng JPEG 1200×630 lưu lại; từ đó link trang chủ dòng họ
 * (/share/<mã>, /xem/clans/<id>) dán lên Facebook / Zalo hiện đúng tên, mô tả và ảnh này. Chưa lưu → thẻ chung của ứng dụng.
 */
export function ClanOgPanel({
  clan,
}: {
  clan: {
    id: string;
    name: string;
    description: string | null;
    generation_offset: number;
  };
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const state = useQuery({
    queryKey: ["clan-og-state", clan.id],
    queryFn: () => loadClanOgState(clan.id),
  });
  const data = useQuery({
    queryKey: ["clan-og-data", clan.id, clan.name, clan.description],
    queryFn: () => loadClanOgData(clan),
  });
  const [styleId, setStyleId] = useState<ClanOgStyleId>("classic");
  const [touched, setTouched] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    void ensureCardFontsLoaded();
  }, []);
  // Mở lại đúng kiểu đã lưu (chỉ khi người dùng chưa tự chọn).
  useEffect(() => {
    if (!touched && state.data?.style)
      setStyleId(clanOgStyle(state.data.style).id);
  }, [state.data?.style, touched]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setScale(el.getBoundingClientRect().width / OG_W || 0.3);
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const node = exportRef.current?.firstElementChild as HTMLElement | null;
      if (!node) throw new Error(t`Chưa dựng được ảnh.`);
      await ensureCardFontsLoaded();
      const blob = await nodeToJpegBlob(node, OG_W, OG_H);
      await saveClanOg({
        clanId: clan.id,
        styleId,
        blob,
        oldPath: state.data?.path ?? null,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clan-og-state", clan.id] });
      toast.success(t`Đã lưu ảnh chia sẻ`, {
        description: t`Facebook nhớ ảnh cũ: bấm "Scrape Again" ở công cụ gỡ lỗi chia sẻ của Facebook để thấy ảnh mới.`,
      });
    },
    onError: (e) =>
      toast.error(t`Không lưu được ảnh`, { description: (e as Error).message }),
  });
  const clear = useMutation({
    mutationFn: () =>
      clearClanOg({ clanId: clan.id, oldPath: state.data?.path ?? null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clan-og-state", clan.id] });
      toast.success(t`Đã quay về ảnh chung của ứng dụng`);
    },
    onError: (e) =>
      toast.error(t`Không gỡ được`, { description: (e as Error).message }),
  });

  const d = data.data;
  return (
    <section
      className="rounded-xl border bg-card p-4 sm:p-5"
      aria-labelledby="clan-og-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="clan-og-title"
            className="text-base font-semibold"
          >{t`Ảnh xem trước khi chia sẻ`}</h2>
          <p className="text-sm text-muted-foreground">
            {t`Hiện khi dán link trang chủ dòng họ lên Facebook, Zalo… Chưa lưu thì link chỉ hiện ảnh chung của ứng dụng.`}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs",
            state.data?.path
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {state.data?.path ? t`Đang dùng ảnh riêng` : t`Đang dùng ảnh chung`}
        </span>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={t`Kiểu ảnh`}
      >
        {CLAN_OG_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={styleId === s.id}
            onClick={() => {
              setTouched(true);
              setStyleId(s.id);
            }}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm",
              styleId === s.id
                ? "border-primary bg-primary/10 font-semibold"
                : "hover:border-primary/60",
            )}
          >
            <span
              aria-hidden="true"
              className="h-5 w-5 rounded-full border"
              style={{ background: s.background }}
            />
            {s.label}
          </button>
        ))}
      </div>

      <div
        ref={boxRef}
        className="relative mt-4 w-full overflow-hidden rounded-lg border"
        style={{ aspectRatio: `${OG_W} / ${OG_H}` }}
      >
        {d ? (
          <div
            style={{
              width: OG_W,
              height: OG_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <ClanOgImage styleId={styleId} data={d} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t`Đang tải…`}</div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="px-3 text-sm"
          disabled={!d || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? t`Đang lưu…` : t`Lưu ảnh chia sẻ`}
        </Button>
        {state.data?.path && (
          <Button
            size="sm"
            variant="outline"
            className="px-3 text-sm"
            disabled={clear.isPending}
            onClick={() => clear.mutate()}
          >
            {t`Dùng ảnh chung`}
          </Button>
        )}
      </div>

      {/* Bản đủ kích thước 1200×630 ngoài màn hình để xuất JPEG (bản xem trước ở trên bị thu nhỏ). */}
      {d && (
        <div
          style={{
            position: "fixed",
            left: -100000,
            top: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          <div ref={exportRef}>
            <ClanOgImage styleId={styleId} data={d} />
          </div>
        </div>
      )}
    </section>
  );
}
