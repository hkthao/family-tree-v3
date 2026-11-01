import { useMemo, useState, type ReactNode } from "react";

import { IconChart, IconChevronDown, IconChevronUp } from "@/components/icons";
import { SectionHeading } from "@/components/SectionHeading";
import type { PersonForTree } from "@/lib/queries/tree";

const COLLAPSE_KEY = "clan-stats-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export interface ClanCounts {
  total: number;
  maxGen: number | null;
  males: number;
  females: number;
  living: number;
  deceased: number;
}

interface Segment {
  label: string;
  value: number;
  /** Màu nền của đoạn (class Tailwind). */
  className: string;
}

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "0%";
}

/** Một chỉ số lớn: số, nhãn, chú thích nhỏ. */
function Kpi({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-3xl font-semibold leading-none tabular-nums text-primary">
        {value}
      </p>
      <p className="mt-1.5 text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Thanh chia tỉ lệ (2 phần trở lên) + chú giải có số và phần trăm. */
function SplitBar({ title, segments }: { title: string; segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${title}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
      >
        {segments.map(
          (s) =>
            s.value > 0 && (
              <div
                key={s.label}
                className={s.className}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value} (${pct(s.value, total)})`}
              />
            ),
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${s.className}`}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pct(s.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Số liệu dòng họ: chỉ số chính, cơ cấu giới tính / còn sống – đã mất, và số
 * người theo từng đời (thanh ngang). Thanh dẹt, nhãn chữ thường, không có số
 * trên từng điểm ngoài giá trị cuối thanh.
 */
export function ClanStatsPanel({
  counts,
  persons,
  children,
}: {
  counts: ClanCounts;
  persons: PersonForTree[];
  /** Hàng lối tắt kho tư liệu, đặt dưới cùng. */
  children?: ReactNode;
}) {
  const byGen = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of persons) {
      if (p.generation != null)
        m.set(p.generation, (m.get(p.generation) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [persons]);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* bỏ qua: chỉ là tiện ích nhớ trạng thái */
      }
      return !c;
    });
  const maxInGen = Math.max(1, ...byGen.map(([, n]) => n));
  const biggest = byGen.reduce<[number, number] | null>(
    (best, cur) => (!best || cur[1] > best[1] ? cur : best),
    null,
  );

  return (
    <section aria-label="Số liệu dòng họ" className="space-y-2">
      <SectionHeading
        icon={<IconChart />}
        title="Số liệu dòng họ"
        action={
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          >
            {collapsed ? "Mở rộng" : "Thu gọn"}
            {collapsed ? (
              <IconChevronDown className="h-4 w-4" />
            ) : (
              <IconChevronUp className="h-4 w-4" />
            )}
          </button>
        }
      />
      <div className="space-y-5 rounded-lg border border-gold/30 bg-card p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-4">
          <Kpi value={counts.total} label="Thành viên" />
          <Kpi value={counts.maxGen ?? "—"} label="Số đời" />
          <Kpi
            value={biggest ? biggest[1] : "—"}
            label="Đời đông nhất"
            hint={biggest ? `Đời thứ ${biggest[0]}` : undefined}
          />
        </div>

        {!collapsed && (
          <>
            <div className="grid gap-5 border-t pt-4 sm:grid-cols-2">
              <SplitBar
                title="Giới tính"
                segments={[
                  {
                    label: "Nam",
                    value: counts.males,
                    className: "bg-primary",
                  },
                  { label: "Nữ", value: counts.females, className: "bg-gold" },
                ]}
              />
              <SplitBar
                title="Tình trạng"
                segments={[
                  {
                    label: "Còn sống",
                    value: counts.living,
                    className: "bg-primary",
                  },
                  {
                    label: "Đã mất",
                    value: counts.deceased,
                    className: "bg-muted-foreground/40",
                  },
                ]}
              />
            </div>

            {byGen.length > 1 && (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">Số người theo đời</p>
                <ul className="space-y-1.5">
                  {byGen.map(([gen, n]) => (
                    <li
                      key={gen}
                      className="grid grid-cols-[3.25rem_1fr_2rem] items-center gap-2 text-sm"
                      title={`Đời thứ ${gen}: ${n} người (${pct(n, counts.total)})`}
                    >
                      <span className="text-muted-foreground">Đời {gen}</span>
                      <div className="h-2.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(n / maxInGen) * 100}%` }}
                        />
                      </div>
                      <span className="text-right font-semibold tabular-nums">
                        {n}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {children}
          </>
        )}
      </div>
    </section>
  );
}
