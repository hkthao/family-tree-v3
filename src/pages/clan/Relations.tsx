import { useQuery } from "@tanstack/react-query";
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
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { getRelationsData } from "@/lib/queries/relations";
import {
  ancestorLabel,
  buildRelationsIndex,
  descendantRows,
  descendantSummary,
  levelName,
  parentsOf,
  paternalLine,
  siblingsOf,
  spousesOf,
  yearOf,
  type RelPerson,
} from "@/lib/relations";

/** "Lê Văn Mùi (1894)" → phần phụ: năm sinh – năm mất. */
function lifeYears(p: RelPerson): string {
  const b = yearOf(p.birth_date);
  const d = yearOf(p.death_date);
  if (b && d) return `${b}–${d}`;
  if (b) return p.is_living ? `sinh ${b}` : `${b}–?`;
  if (d) return `?–${d}`;
  return "";
}

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  if (children === null || children === undefined || children === "")
    return null;
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
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
  const parents = parentsOf(idx, focal.id);
  const line = paternalLine(idx, focal.id);
  const spouses = spousesOf(idx, focal.id);
  const siblings = siblingsOf(idx, focal.id);
  const fatherSiblings = parents.father
    ? siblingsOf(idx, parents.father.id)
    : [];
  const motherSiblings = parents.mother
    ? siblingsOf(idx, parents.mother.id)
    : [];
  const rows = useMemo(() => descendantRows(idx, focal.id), [idx, focal.id]);
  const summary = descendantSummary(rows);
  const gen = focal.generation !== null ? focal.generation - off : null;

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
        footer={
          <Link
            to={`/clans/${clanId}/people/${focal.id}`}
            className="shrink-0 text-sm text-primary hover:underline"
          >
            Mở hồ sơ →
          </Link>
        }
      >
        <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <Field label="Đời">{gen !== null ? String(gen) : null}</Field>
          <Field label="Giới tính">{focal.gender === "M" ? "Nam" : "Nữ"}</Field>
          <Field label="Sinh">{yearOf(focal.birth_date) || null}</Field>
          <Field label="Mất">
            {focal.death_date
              ? yearOf(focal.death_date)
              : focal.is_living
                ? null
                : "đã mất"}
          </Field>
          <Field label="Hưởng thọ">
            {focal.lifespan_years ? `${focal.lifespan_years} tuổi` : null}
          </Field>
          <Field label="Quê quán">{focal.birth_place}</Field>
          <Field label="Nơi an táng">{focal.burial_place}</Field>
        </dl>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SectionCard
          id="rel-ancestors"
          icon={<IconTree />}
          title="Tổ tiên (dòng cha)"
        >
          {line.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa ghi nhận cha.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {line.map((a, i) => (
                <li key={a.id} className="flex gap-2">
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {ancestorLabel(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Person p={a} />
                    {lifeYears(a) && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {lifeYears(a)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2 border-t pt-2 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">Mẹ</span>
            <span className="min-w-0 flex-1">
              {parents.mother ? (
                <>
                  <Person p={parents.mother} />
                  {lifeYears(parents.mother) && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {lifeYears(parents.mother)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Chưa ghi nhận</span>
              )}
            </span>
          </div>
        </SectionCard>

        <SectionCard
          id="rel-spouses"
          icon={<IconUsers />}
          title={`Vợ / chồng (${spouses.length})`}
        >
          {spouses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa ghi nhận vợ/chồng.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {spouses.map(({ person: s }) => (
                <li key={s.id}>
                  <Person p={s} />
                  <p className="text-muted-foreground">
                    {[lifeYears(s), s.birth_place]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SectionCard
          id="rel-siblings"
          icon={<IconUsers />}
          title={`Anh chị em (${siblings.length})`}
        >
          {siblings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có anh chị em được ghi nhận.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Person p={s} />
                  {lifeYears(s) && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {lifeYears(s)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          id="rel-uncles"
          icon={<IconUsers />}
          title={`Bác, chú, cô, cậu, dì (${fatherSiblings.length + motherSiblings.length})`}
        >
          {fatherSiblings.length + motherSiblings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa ghi nhận anh chị em của cha mẹ.
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              {fatherSiblings.length > 0 && (
                <div>
                  <p className="text-muted-foreground">
                    Bên cha ({fatherSiblings.length})
                  </p>
                  <ul className="space-y-1">
                    {fatherSiblings.map((s) => (
                      <li key={s.id}>
                        <Person p={s} />
                        {lifeYears(s) && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {lifeYears(s)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {motherSiblings.length > 0 && (
                <div>
                  <p className="text-muted-foreground">
                    Bên mẹ ({motherSiblings.length})
                  </p>
                  <ul className="space-y-1">
                    {motherSiblings.map((s) => (
                      <li key={s.id}>
                        <Person p={s} />
                        {lifeYears(s) && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {lifeYears(s)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

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
