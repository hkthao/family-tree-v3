import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { FilterableSelect } from "@/components/FilterableSelect";
import {
  IconDownload,
  IconTree,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { getRelationsData } from "@/lib/queries/relations";
import {
  ancestorLabel,
  buildRelationsIndex,
  buildRelationsReport,
  deathLabel,
  levelName,
  yearOf,
  type RelPerson,
} from "@/lib/relations";

/**
 * Tra cứu quan hệ của một người — như bảng Excel gia phả: thông tin cá nhân, vợ/chồng, tổ tiên
 * (cha, ông, cụ, kỵ), mẹ, anh chị em, bác–chú–cô–cậu–dì, và bảng con cháu theo từng đời (tải CSV được).
 * Bấm tên bất kỳ để chuyển sang người đó; địa chỉ có `?p=<id>` nên chia sẻ / quay lại được.
 */
export default function Relations() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const isMember = effectiveRole(clan) !== null;
  const [params, setParams] = useSearchParams();
  const off = clan.generation_offset ?? 0;

  const { data, isLoading, error } = useQuery({
    queryKey: ["relations-data", clan.id, userId],
    queryFn: () => getRelationsData(clan.id),
    enabled: !!userId && isMember,
    staleTime: 60_000,
  });

  const idx = useMemo(
    () => (data ? buildRelationsIndex(data.persons, data.families) : null),
    [data],
  );

  const options = useMemo(() => {
    if (!data) return [];
    return [...data.persons]
      .sort(
        (x, y) =>
          (x.generation ?? 999) - (y.generation ?? 999) ||
          x.full_name.localeCompare(y.full_name, "vi"),
      )
      .map((p) => {
        const born = yearOf(p.birth_date);
        return {
          value: p.id,
          label: [
            p.full_name,
            p.generation !== null ? `Đời ${p.generation - off}` : null,
            born ? `sinh ${born}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      });
  }, [data, off]);

  if (!isMember) return <Navigate to={`/clans/${clan.id}`} replace />;

  const wanted = params.get("p");
  const focal: RelPerson | null =
    (wanted && idx?.byId.get(wanted)) ||
    data?.persons.find((p) => p.is_root) ||
    data?.persons.find(
      (p) =>
        p.generation ===
        Math.min(...data.persons.map((x) => x.generation ?? 999)),
    ) ||
    data?.persons[0] ||
    null;

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("p", id);
    setParams(next, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const Person = ({ p, children }: { p: RelPerson; children?: string }) => (
    <button
      type="button"
      onClick={() => select(p.id)}
      className="text-left font-medium text-primary hover:underline underline-offset-2"
    >
      {children ?? p.full_name}
    </button>
  );

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Tra cứu quan hệ" },
        ]}
      />
      <PageHeader
        icon={<IconTree className="h-7 w-7" />}
        title="Tra cứu quan hệ"
        description="Chọn một người để xem tổ tiên, vợ/chồng, anh chị em và toàn bộ con cháu."
      />

      {error && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}
      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {data && data.persons.length === 0 && (
        <EmptyState
          icon={<IconUsers className="h-10 w-10" />}
          title="Chưa có ai trong dòng họ"
          description="Thêm người vào cây gia phả rồi quay lại đây tra cứu."
        />
      )}

      {idx && focal && (
        <>
          <FilterableSelect
            id="relations-person"
            icon={<IconUser />}
            value={focal.id}
            onChange={(v) => v && select(v)}
            options={options}
            emptyLabel="Chọn người cần xem"
            filterPlaceholder="Gõ tên để tìm (không cần dấu)"
            filterLabel="Tìm người cần xem quan hệ"
            className="h-10 text-sm"
          />
          <RelationsBody
            clanId={clan.id}
            off={off}
            focal={focal}
            idx={idx}
            Person={Person}
          />
        </>
      )}
    </div>
  );
}

/** Ô "Sinh", "Mất", "Quê quán" dùng chung cho mọi bảng người. */
function personCells(p: RelPerson): string[] {
  return [yearOf(p.birth_date) || "—", deathLabel(p), p.birth_place || "—"];
}

/** Bảng cùng kiểu với bảng Con cháu: tiêu đề cột nhỏ nền nhạt, hàng ngăn bằng đường kẻ. */
function RelTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: { key: string; cells: React.ReactNode[] }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground sm:p-4">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.key}>
              {r.cells.map((c, i) => (
                <td key={i} className="px-3 py-2 first:whitespace-nowrap">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelationsBody({
  clanId,
  off,
  focal,
  idx,
  Person,
}: {
  clanId: string;
  off: number;
  focal: RelPerson;
  idx: ReturnType<typeof buildRelationsIndex>;
  Person: (props: { p: RelPerson; children?: string }) => React.ReactElement;
}) {
  const report = useMemo(
    () => buildRelationsReport(idx, focal, off),
    [idx, focal, off],
  );
  const { line, siblings, fatherSiblings, motherSiblings, rows, summary } =
    report;
  const spouses = report.spouses;
  const gen = report.generation;
  const { clan } = useClanContext();
  const toast = useToast();
  const pdfM = useMutation({
    mutationFn: async () => {
      // @react-pdf/renderer nặng (~1,5MB): chỉ nạp khi bấm xuất.
      const { downloadRelationsPdf } =
        await import("@/lib/pdf/exportRelations");
      return downloadRelationsPdf(clan, report);
    },
    onSuccess: (r) => toast.success("Đã xuất PDF", { description: r.filename }),
    onError: (e) =>
      toast.error("Không xuất được PDF", { description: (e as Error).message }),
  });

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = [
      "Đời",
      "Họ tên",
      "Năm sinh",
      "Vợ/chồng",
      "Năm sinh vợ/chồng",
      "Quê quán",
      "Bố",
      "Mẹ",
    ];
    const lines = rows.map((r) => [
      r.person.generation !== null ? String(r.person.generation - off) : "",
      r.person.full_name,
      yearOf(r.person.birth_date),
      r.spouses.map((s) => s.full_name).join("; "),
      r.spouses.map((s) => yearOf(s.birth_date)).join("; "),
      r.person.birth_place ??
        r.spouses.map((s) => s.birth_place).find(Boolean) ??
        "",
      r.father?.full_name ?? "",
      r.mother?.full_name ?? "",
    ]);
    const csv = [head, ...lines].map((l) => l.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `quan-he-${focal.full_name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <SectionCard
        id="rel-info"
        icon={<IconUser />}
        title={focal.full_name}
        bodyClassName="p-0"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pdfM.mutate()}
              disabled={pdfM.isPending}
            >
              <IconDownload className="mr-1.5 h-4 w-4" />
              {pdfM.isPending ? "Đang xuất…" : "Xuất PDF"}
            </Button>
            <Link
              to={`/clans/${clanId}/people/${focal.id}`}
              className="shrink-0 text-sm text-primary hover:underline"
            >
              Mở hồ sơ →
            </Link>
          </>
        }
      >
        {/* Cùng kiểu bảng với phần Con cháu: tiêu đề cột nhỏ, một hàng thông tin. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-2 font-medium">Đời</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Giới tính
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Sinh
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Mất</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Hưởng thọ
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Quê quán
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Nơi an táng
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="whitespace-nowrap px-3 py-2">
                  {gen !== null ? gen : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {focal.gender === "M" ? "Nam" : "Nữ"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {yearOf(focal.birth_date) || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {focal.death_date
                    ? yearOf(focal.death_date)
                    : focal.is_living
                      ? "—"
                      : "đã mất"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {focal.lifespan_years ? `${focal.lifespan_years} tuổi` : "—"}
                </td>
                <td className="px-3 py-2">{focal.birth_place || "—"}</td>
                <td className="px-3 py-2">{focal.burial_place || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        id="rel-ancestors"
        icon={<IconTree />}
        title="Tổ tiên (dòng cha)"
        bodyClassName="p-0"
      >
        <RelTable
          head={["Quan hệ", "Họ tên", "Sinh", "Mất", "Quê quán"]}
          empty="Chưa ghi nhận cha mẹ."
          rows={[
            ...line.map((a, i) => ({
              key: a.id,
              cells: [
                ancestorLabel(i + 1),
                <Person key="n" p={a} />,
                ...personCells(a),
              ],
            })),
            ...(report.mother
              ? [
                  {
                    key: report.mother.id,
                    cells: [
                      "Mẹ",
                      <Person key="n" p={report.mother} />,
                      ...personCells(report.mother),
                    ],
                  },
                ]
              : []),
          ]}
        />
      </SectionCard>

      <SectionCard
        id="rel-spouses"
        icon={<IconUsers />}
        title={`Vợ / chồng (${spouses.length})`}
        bodyClassName="p-0"
      >
        <RelTable
          head={["Họ tên", "Sinh", "Mất", "Quê quán"]}
          empty="Chưa ghi nhận vợ/chồng."
          rows={spouses.map((sp) => ({
            key: sp.id,
            cells: [<Person key="n" p={sp} />, ...personCells(sp)],
          }))}
        />
      </SectionCard>

      <SectionCard
        id="rel-siblings"
        icon={<IconUsers />}
        title={`Anh chị em (${siblings.length})`}
        bodyClassName="p-0"
      >
        <RelTable
          head={["Họ tên", "Giới tính", "Sinh", "Mất", "Quê quán"]}
          empty="Không có anh chị em được ghi nhận."
          rows={siblings.map((sb) => ({
            key: sb.id,
            cells: [
              <Person key="n" p={sb} />,
              sb.gender === "M" ? "Nam" : "Nữ",
              ...personCells(sb),
            ],
          }))}
        />
      </SectionCard>

      <SectionCard
        id="rel-uncles"
        icon={<IconUsers />}
        title={`Bác, chú, cô, cậu, dì (${fatherSiblings.length + motherSiblings.length})`}
        bodyClassName="p-0"
      >
        <RelTable
          head={["Bên", "Họ tên", "Giới tính", "Sinh", "Mất", "Quê quán"]}
          empty="Chưa ghi nhận anh chị em của cha mẹ."
          rows={[
            ...fatherSiblings.map((u) => ({
              key: `f-${u.id}`,
              cells: [
                "Bên cha",
                <Person key="n" p={u} />,
                u.gender === "M" ? "Nam" : "Nữ",
                ...personCells(u),
              ],
            })),
            ...motherSiblings.map((u) => ({
              key: `m-${u.id}`,
              cells: [
                "Bên mẹ",
                <Person key="n" p={u} />,
                u.gender === "M" ? "Nam" : "Nữ",
                ...personCells(u),
              ],
            })),
          ]}
        />
      </SectionCard>

      <SectionCard
        id="rel-descendants"
        icon={<IconTree />}
        title="Con cháu"
        action={rows.length > 0 ? `${rows.length} người` : undefined}
        bodyClassName="p-0"
        footer={
          rows.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportCsv}
            >
              <IconDownload className="mr-1.5 h-4 w-4" />
              Tải bảng (CSV)
            </Button>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Chưa ghi nhận con cháu.
          </p>
        ) : (
          <>
            <p className="border-b px-3 py-2 text-sm text-muted-foreground sm:px-4">
              Có {summary}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      Đời
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      Họ tên
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      Năm sinh
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      Vợ / chồng
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      Quê quán
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">
                      Bố / Mẹ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => {
                    const newLevel = i === 0 || rows[i - 1].level !== r.level;
                    return (
                      <tr
                        key={r.person.id}
                        className={newLevel ? "border-t-2 border-border" : ""}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {r.person.generation !== null
                            ? r.person.generation - off
                            : "—"}
                          {newLevel && r.level <= 4 && (
                            <span className="ml-1 text-xs">
                              ({levelName(r.level)})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Person p={r.person} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {yearOf(r.person.birth_date) || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {r.spouses.length === 0
                            ? "—"
                            : r.spouses.map((s) => (
                                <div key={s.id}>
                                  <Person p={s} />
                                  {yearOf(s.birth_date) && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {yearOf(s.birth_date)}
                                    </span>
                                  )}
                                </div>
                              ))}
                        </td>
                        <td className="px-3 py-2">
                          {r.person.birth_place ??
                            r.spouses.map((s) => s.birth_place).find(Boolean) ??
                            "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[r.father?.full_name, r.mother?.full_name]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
