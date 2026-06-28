import {
  IconBell,
  IconCheck,
  IconShield,
  IconSparkles,
  IconTree,
  IconUserPlus,
} from "@/components/icons";
import type { ClanLeaderboardStat, ClanSummary } from "@/lib/queries/clans";

/**
 * Huy hiệu "ganh đua" cho danh sách dòng họ — biến số liệu khô thành
 * hạng/nhãn nổi bật để các họ có động lực bổ sung dữ liệu, mời thêm
 * thành viên. Dùng icon outline (đồng bộ toàn app), không dùng emoji.
 */

interface Tier {
  label: string;
  /** màu chip (light + dark). */
  className: string;
}

/** Mốc thành viên → hạng (Đồng → Kim cương). null nếu < 50. */
export function memberTier(count: number): Tier | null {
  if (count >= 5000)
    return {
      label: "Kim cương",
      className:
        "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    };
  if (count >= 1000)
    return {
      label: "Bạch kim",
      className:
        "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    };
  if (count >= 500)
    return {
      label: "Vàng",
      className:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    };
  if (count >= 200)
    return {
      label: "Bạc",
      className:
        "bg-zinc-400/15 text-zinc-600 dark:text-zinc-300 border-zinc-400/30",
    };
  if (count >= 50)
    return {
      label: "Đồng",
      className:
        "bg-orange-700/15 text-orange-800 dark:text-orange-300 border-orange-700/30",
    };
  return null;
}

const DAY = 86_400_000;

function isRecent(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * DAY;
}

const ICON_CLS = "h-3 w-3 shrink-0";

function Chip({
  className,
  title,
  children,
}: {
  className: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Hàng huy hiệu cho một dòng họ.
 * - rank: thứ hạng trong danh sách (1-based) — chỉ truyền khi đang sắp
 *   theo "số thành viên" ở tab Cộng đồng để huy chương có ý nghĩa.
 * - stat: số liệu chất lượng (số đời, % năm sinh, tăng trưởng).
 */
export function ClanBadges({
  clan,
  rank,
  stat,
}: {
  clan: ClanSummary;
  rank?: number;
  stat?: ClanLeaderboardStat;
}) {
  const tier = memberTier(clan.person_count);
  const showTop = rank != null && rank <= 3;
  // Chỉ giữ "Đang sôi nổi" (có cập nhật gần đây) — bỏ "Mới nổi" vì gần
  // như họ nào mới tạo cũng có, không phân biệt được gì.
  const isActive = isRecent(clan.updated_at, 7);

  // Huy hiệu chất lượng (từ batch stats).
  const doi =
    stat?.max_generation != null
      ? stat.max_generation - clan.generation_offset
      : null;
  const showDoi = doi != null && doi >= 5;
  const pctBirth =
    stat && stat.persons_total > 0
      ? Math.round((stat.persons_with_birth / stat.persons_total) * 100)
      : null;
  const showComplete =
    stat != null && stat.persons_total >= 10 && pctBirth != null && pctBirth >= 80;
  const grow = stat?.persons_30d ?? 0;
  const showGrow = grow >= 1;

  if (!tier && !showTop && !isActive && !showDoi && !showComplete && !showGrow)
    return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
      {showTop && (
        <Chip
          title={`Hạng ${rank} theo số thành viên`}
          className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        >
          <IconShield className={ICON_CLS} /> Top {rank}
        </Chip>
      )}
      {tier && (
        <Chip title={`${clan.person_count} thành viên`} className={tier.className}>
          <IconSparkles className={ICON_CLS} /> {tier.label}
        </Chip>
      )}
      {showDoi && (
        <Chip
          title={`Cây sâu ${doi} đời`}
          className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
        >
          <IconTree className={ICON_CLS} /> {doi} đời
        </Chip>
      )}
      {showComplete && (
        <Chip
          title={`${pctBirth}% thành viên đã có năm sinh`}
          className="bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30"
        >
          <IconCheck className={ICON_CLS} /> Đầy đủ {pctBirth}%
        </Chip>
      )}
      {showGrow && (
        <Chip
          title={`Thêm ${grow} người trong 30 ngày qua`}
          className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
        >
          <IconUserPlus className={ICON_CLS} /> +{grow} tháng này
        </Chip>
      )}
      {isActive && (
        <Chip
          title="Có cập nhật trong 7 ngày qua"
          className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
        >
          <IconBell className={ICON_CLS} /> Đang sôi nổi
        </Chip>
      )}
    </div>
  );
}
