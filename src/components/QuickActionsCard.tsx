import { t } from "@lingui/core/macro";

import { exportStageLabel } from "@/lib/pdf/exportStageLabel";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  IconDownload,
  IconGrid,
  IconLink,
  IconPencil,
  IconRefresh,
  IconSettings,
  IconSliders,
} from "@/components/icons";
import { canEditClan, isClanAdmin } from "@/hooks/useClanContext";
import { useClanFreshness } from "@/hooks/useClanFreshness";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import { SectionCard } from "@/components/SectionCard";
import { useNavSections } from "@/hooks/useNavSections";
import { useHomePrefs } from "@/hooks/useHomePrefs";
import { track } from "@/lib/analytics";
import { orderQuick } from "@/lib/homePrefs";
import { buildQuickCatalog, type QuickEntry } from "@/lib/quickCatalog";
import type { ClanDetail } from "@/lib/queries/clan-detail";

/** Số ô tối đa của thẻ Thao tác nhanh, TÍNH CẢ ô lối tắt "Tất cả tính năng" ở cuối. */
export const MAX_QUICK = 12;

/**
 * Danh mục các ô có thể ghim + danh sách đang HIỂN THỊ (đã theo ghim / lượt bấm). Dùng chung cho thẻ và ngăn
 * kéo tuỳ chỉnh để hai nơi luôn nói cùng một chuyện.
 */
export function useQuickEntries(
  clan: ClanDetail,
  canEdit: boolean,
  isMember: boolean,
) {
  const { sections } = useNavSections();
  const { prefs } = useHomePrefs();
  const catalog = useMemo(
    () => buildQuickCatalog(sections, { clanId: clan.id, canEdit, isMember }),
    [sections, clan.id, canEdit, isMember],
  );
  const shown = useMemo(
    () => orderQuick(catalog, prefs, MAX_QUICK - 1),
    [catalog, prefs],
  );
  return { catalog, shown, pinned: prefs.pins !== null };
}

const TILE =
  "group relative flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary hover:bg-muted/30";

/** Một ô của lưới (liên kết). `tone="muted"`: ô lối tắt "Tất cả tính năng", viền nét đứt. */
export function ActionTile({
  to,
  icon,
  title,
  badge,
  tone = "default",
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  /** Badge số đếm (vd. việc cần làm). 0/undefined → không hiện. */
  badge?: number | string;
  tone?: "default" | "muted";
  onClick?: () => void;
}) {
  const n = typeof badge === "string" ? parseInt(badge, 10) || 1 : badge;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${TILE} ${tone === "muted" ? "border-dashed" : ""}`}
    >
      <span
        className="shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="line-clamp-2 text-sm font-medium leading-tight">
        {title}
      </span>
      {n !== undefined && n > 0 && (
        <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] tabular-nums text-primary-foreground">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}

function ExportPdfTile({
  clan,
  onClick,
}: {
  clan: ClanDetail;
  onClick?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] =
    useState<Parameters<typeof exportStageLabel>[0]>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    onClick?.();
    setBusy(true);
    setErr(null);
    try {
      const { downloadClanBookPdf } = await import("@/lib/pdf/exportClanBook");
      await downloadClanBookPdf(clan, {
        tree: true,
        detail: true,
        onProgress: setStage,
      });
      track("export", { kind: "clan_book_pdf", from: "dashboard" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title={err ?? undefined}
      className={`${TILE} disabled:cursor-wait disabled:opacity-60`}
    >
      <span
        className="shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5"
        aria-hidden="true"
      >
        <IconDownload />
      </span>
      <span className="line-clamp-2 text-sm font-medium leading-tight">
        {busy ? exportStageLabel(stage) : t`Xuất PDF`}
      </span>
    </button>
  );
}

function Tile({
  entry,
  clan,
  onUse,
}: {
  entry: QuickEntry;
  clan: ClanDetail;
  onUse: (key: string) => void;
}) {
  if (entry.special === "pdf") {
    return <ExportPdfTile clan={clan} onClick={() => onUse(entry.key)} />;
  }
  return (
    <ActionTile
      to={entry.to!}
      icon={entry.icon}
      title={entry.short}
      badge={entry.badge}
      onClick={() => onUse(entry.key)}
    />
  );
}

/**
 * "Thao tác nhanh": TỐI ĐA 12 ô. Mặc định = bốn mục lõi + các ô xếp theo mức người này HAY BẤM (tự học, lưu trên
 * máy); người dùng có thể GHIM tự chọn ô và thứ tự ở ngăn kéo "Tuỳ chỉnh". Ô thứ 12 luôn là lối tắt vào "Tất cả
 * tính năng" nên không mục nào mất đường vào. Mỗi lượt bấm ghi sự kiện `quick_tile_click` (khoá ô, không có dữ
 * liệu cá nhân) để biết ô nào thật sự được dùng.
 */
export function QuickActionsCard({
  clan,
  canEdit,
  isMember,
  onCustomize,
}: {
  clan: ClanDetail;
  canEdit: boolean;
  isMember: boolean;
  onCustomize: () => void;
}) {
  const { shown, pinned } = useQuickEntries(clan, canEdit, isMember);
  const { bump } = useHomePrefs();
  const onUse = (key: string) => {
    bump(key);
    track("quick_tile_click", { key, pinned });
  };
  return (
    <SectionCard id="quick" icon={<IconGrid />} title={t`Thao tác nhanh`}>
      {/* Ô NGANG gọn (icon + chữ cùng dòng): 2 cột mobile / 4 cột desktop. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shown.map((e) => (
          <Tile key={e.key} entry={e} clan={clan} onUse={onUse} />
        ))}
        <ActionTile
          to={`/clans/${clan.id}/menu`}
          icon={<IconGrid />}
          title={t`Tất cả tính năng`}
          tone="muted"
          onClick={() => track("quick_tile_click", { key: "menu", pinned })}
        />
      </div>
      <ManageTiles
        clan={clan}
        onCustomize={onCustomize}
        skip={new Set(shown.map((e) => e.to ?? ""))}
      />
    </SectionCard>
  );
}

/**
 * Hàng ô "Quản lý" cuối thẻ — trước là 5 nút chỉ có icon trên đầu trang Tổng quan (khó đoán với người lớn tuổi /
 * người mới). Giờ là ô CÓ CHỮ cùng kiểu các ô thao tác: Tuỳ chỉnh trang chủ, Làm mới dữ liệu, và (theo quyền) Sửa
 * thông tin dòng họ, Cài đặt, Liên kết dòng họ. Ô đã có trong lưới phía trên (`skip`) thì không lặp lại.
 */
function ManageTiles({
  clan,
  onCustomize,
  skip,
}: {
  clan: ClanDetail;
  onCustomize: () => void;
  skip: Set<string>;
}) {
  const { isChecking, refresh } = useClanFreshness(clan.id, clan.data_version);
  const [flash, setFlash] = useState<"fresh" | "updated" | null>(null);
  const links = [
    canEditClan(clan) && {
      to: `/clans/${clan.id}/so-gia-pha`,
      icon: <IconPencil />,
      title: t`Sửa thông tin họ`,
    },
    isClanAdmin(clan) && {
      to: `/clans/${clan.id}/settings`,
      icon: <IconSettings />,
      title: t`Cài đặt dòng họ`,
    },
    isClanAdmin(clan) &&
      isFeatureEnabled(clan.disabled_features, "inlaws") && {
        to: `/clans/${clan.id}/inlaws`,
        icon: <IconLink />,
        title: t`Liên kết họ`,
      },
  ].filter(
    (x): x is { to: string; icon: JSX.Element; title: string } =>
      !!x && !skip.has(x.to),
  );
  return (
    <div className="mt-3 border-t pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t`Quản lý`}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" onClick={onCustomize} className={TILE}>
          <span
            className="shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5"
            aria-hidden="true"
          >
            <IconSliders />
          </span>
          <span className="line-clamp-2 text-sm font-medium leading-tight">
            {t`Tuỳ chỉnh trang`}
          </span>
        </button>
        <button
          type="button"
          disabled={isChecking}
          onClick={async () => {
            setFlash(await refresh());
            window.setTimeout(() => setFlash(null), 3000);
          }}
          className={TILE}
        >
          <span
            className="shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5"
            aria-hidden="true"
          >
            <IconRefresh className={isChecking ? "animate-spin" : ""} />
          </span>
          <span
            className="line-clamp-2 text-sm font-medium leading-tight"
            aria-live="polite"
          >
            {isChecking
              ? t`Đang kiểm tra…`
              : flash === "updated"
                ? t`Đã có dữ liệu mới`
                : flash === "fresh"
                  ? t`Đã là mới nhất`
                  : t`Làm mới`}
          </span>
        </button>
        {links.map((l) => (
          <ActionTile key={l.to} to={l.to} icon={l.icon} title={l.title} />
        ))}
      </div>
    </div>
  );
}
